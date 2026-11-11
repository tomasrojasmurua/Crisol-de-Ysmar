import {
  COMBO_DETECT,
  COMBO_TIMING,
  COMBO_UNDETECTABLE,
  COMBOS,
  type Combo,
  type ComboStep,
} from '@crisol/content';
import {
  type EntityId,
  type GameEvent,
  type MatchState,
  SPELL_WEAVES,
  type SpellId,
  type StatusId,
  TICK_RATE,
} from '@crisol/core';

/** Un combo del catálogo que acaba de salir. */
export interface ComboHit {
  readonly combo: Combo;
  /** Sobre quién mostrar el nombre: el rival golpeado o, si el remate no es un golpe, tú. */
  readonly targetId: EntityId;
}

interface Release {
  readonly wizardId: EntityId;
  readonly spell: SpellId;
  readonly tick: number;
}

/** Un combo con todos sus pasos lanzados que espera su remate. */
interface Pending {
  readonly combo: Combo;
  readonly finisher: EntityId;
  readonly casters: ReadonlySet<EntityId>;
  readonly deadline: number;
}

/** Los combos de hechizos que el detector sabe reconocer (las reacciones van por su evento). */
const DETECTABLE = COMBOS.filter((c) => !c.reaction && !COMBO_UNDETECTABLE.has(c.id));
const MAX_STEPS = Math.max(...DETECTABLE.map((c) => c.steps.length));
const MAX_GAP = Math.round(COMBO_TIMING.maxGap * TICK_RATE);
const FINISH_WINDOW = Math.round(COMBO_TIMING.finishWindow * TICK_RATE);

/** Combos de equipo con un paso del aliado: los pasos los ponen dos magos distintos. */
const isTeamPlay = (combo: Combo): boolean => combo.steps.some((s) => s.ally);

function stepMatches(step: ComboStep, spell: SpellId): boolean {
  if ('spell' in step) return step.spell === spell;
  if ('element' in step) return SPELL_WEAVES[spell][0] === step.element;
  return true;
}

/**
 * Reconoce en partida los combos de hechizos del catálogo, leyendo solo los eventos que la
 * simulación ya emite (`release`, `hit`, `combo`) y los estados de los magos: no agrega nada a
 * la red. Los pasos son los hechizos que lanza el jugador en orden, sin otro hechizo suyo entre
 * medio y sin pasar `maxGap` entre uno y otro; después tiene que llegar el remate (ver
 * `COMBO_DETECT`). En los combos con paso de aliado, ese paso lo lanza un compañero.
 */
export class ComboDetector {
  /** Hechizos recientes de tu equipo, del más viejo al más nuevo. */
  private releases: Release[] = [];
  private pending: Pending[] = [];
  /** Los estados de cada mago al terminar el paso anterior: así se ve si dormía antes del golpe. */
  private statusesBefore = new Map<EntityId, ReadonlySet<StatusId>>();
  /**
   * Quiénes terminaron de tejer y todavía no sueltan el hechizo. Un `release` sin tejido antes
   * es una repetición (el segundo meteoro del Eco ardiente) y no cuenta como paso.
   */
  private woven = new Set<EntityId>();

  private readonly sequences: readonly Combo[];

  /**
   * `withUnverified` también busca los que faltan por confirmar con la simulación: solo para las
   * pruebas que los confirman, nunca en partida.
   */
  constructor(
    readonly playerId: EntityId,
    withUnverified = false,
  ) {
    this.sequences = DETECTABLE.filter((c) => withUnverified || !c.unverified);
  }

  reset(): void {
    this.releases = [];
    this.pending = [];
    this.statusesBefore.clear();
    this.woven.clear();
  }

  /** Procesa un paso de la partida y devuelve los combos del jugador que salieron. */
  onStep(events: readonly GameEvent[], state: MatchState): ComboHit[] {
    const tick = state.tick;
    const teamOf = new Map(state.wizards.map((w) => [w.id, w.team]));
    const myTeam = teamOf.get(this.playerId);
    const hits: ComboHit[] = [];
    this.pending = this.pending.filter((p) => p.deadline >= tick);

    for (const event of events) {
      if (event.type === 'cast') {
        this.woven.add(event.wizardId);
      } else if (event.type === 'release') {
        if (teamOf.get(event.wizardId) !== myTeam) continue;
        if (!this.woven.delete(event.wizardId)) continue;
        // Un hechizo nuevo de quien debía rematar deja sin efecto lo que esperaba.
        this.pending = this.pending.filter((p) => p.finisher !== event.wizardId);
        this.releases.push({ wizardId: event.wizardId, spell: event.spell, tick });
        this.releases = this.releases.slice(-MAX_STEPS * 4);
        for (const combo of this.sequences) {
          const casters = this.matchSteps(combo);
          if (!casters) continue;
          if ((COMBO_DETECT[combo.id]?.finish ?? 'hit') === 'cast') {
            if (casters.has(this.playerId)) hits.push({ combo, targetId: event.wizardId });
          } else {
            this.pending.push({
              combo,
              finisher: event.wizardId,
              casters,
              deadline: tick + FINISH_WINDOW,
            });
          }
        }
      } else if (event.type === 'hit' || event.type === 'combo') {
        const targetTeam = teamOf.get(event.targetId);
        if (targetTeam === undefined || targetTeam === myTeam) continue;
        for (const pending of [...this.pending]) {
          if (pending.finisher !== event.sourceId) continue;
          const detect = COMBO_DETECT[pending.combo.id] ?? {};
          const finish = detect.finish ?? 'hit';
          if (event.type === 'hit' && finish !== 'hit') continue;
          if (event.type === 'hit' && event.amount < COMBO_TIMING.minHit && !detect.trickle) {
            continue;
          }
          if (
            event.type === 'combo' &&
            (finish !== 'reaction' || detect.reaction !== event.combo)
          ) {
            continue;
          }
          if (detect.status && !this.statusesBefore.get(event.targetId)?.has(detect.status)) {
            continue;
          }
          this.pending = this.pending.filter((p) => p !== pending);
          if (pending.casters.has(this.playerId)) {
            hits.push({ combo: pending.combo, targetId: event.targetId });
          }
        }
      }
    }

    this.statusesBefore = new Map(
      state.wizards.map((w) => [w.id, new Set(Object.keys(w.statuses) as StatusId[])]),
    );
    return dedupe(hits);
  }

  /**
   * Si los últimos hechizos del equipo completan los pasos del combo, devuelve quiénes los
   * lanzaron. En un combo de un solo mago cuentan solo los hechizos de quien lanzó el último.
   */
  private matchSteps(combo: Combo): Set<EntityId> | null {
    const last = this.releases[this.releases.length - 1];
    if (!last) return null;
    const team = isTeamPlay(combo);
    const pool = team ? this.releases : this.releases.filter((r) => r.wizardId === last.wizardId);
    const window = pool.slice(-combo.steps.length);
    if (window.length < combo.steps.length) return null;
    const casters = new Set<EntityId>();
    for (let i = 0; i < combo.steps.length; i++) {
      const step = combo.steps[i];
      const release = window[i];
      if (!step || !release || !stepMatches(step, release.spell)) return null;
      const previous = window[i - 1];
      if (previous && release.tick - previous.tick > MAX_GAP) return null;
      casters.add(release.wizardId);
    }
    if (team) {
      // El paso del aliado lo pone otro mago que los demás pasos.
      const allyIndex = combo.steps.findIndex((s) => s.ally);
      const ally = window[allyIndex]?.wizardId;
      if (window.some((r, i) => i !== allyIndex && r.wizardId === ally)) return null;
    }
    return casters;
  }
}

function dedupe(hits: ComboHit[]): ComboHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.combo.id) && seen.add(h.combo.id));
}
