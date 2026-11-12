import {
  COMBO_DETECT,
  COMBO_TIMING,
  COMBO_UNDETECTABLE,
  COMBOS,
  type Combo,
  type ComboDetect,
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
  readonly detect: ComboDetect;
  readonly finisher: EntityId;
  readonly casters: ReadonlySet<EntityId>;
  readonly deadline: number;
}

/** Cómo estaba cada mago al terminar el paso anterior de la simulación. */
interface Snapshot {
  readonly statuses: ReadonlySet<StatusId>;
  readonly hp: number;
  readonly shield: number;
}

/** Los combos de hechizos que el detector sabe reconocer (las reacciones van por su evento). */
const DETECTABLE = COMBOS.filter((c) => !c.reaction && !COMBO_UNDETECTABLE.has(c.id));
const MAX_STEPS = Math.max(...DETECTABLE.map((c) => c.steps.length));
const MAX_GAP = Math.round(COMBO_TIMING.maxGap * TICK_RATE);
const FINISH_WINDOW = Math.round(COMBO_TIMING.finishWindow * TICK_RATE);
/** Un golpe así de grande entre pasos es el de la Venganza (45). */
const BIG_HIT = 40;
/** Hasta dónde se acepta que un golpe sea de los rayos del Orbe errático (dan a 4 m). */
const ORB_REACH = 5;

/** Combos de equipo con un paso del aliado: los pasos los ponen dos magos distintos. */
const isTeamPlay = (combo: Combo): boolean => combo.steps.some((s) => s.ally);

function stepMatches(step: ComboStep, spell: SpellId): boolean {
  if ('spell' in step) return step.spell === spell;
  if ('element' in step) return SPELL_WEAVES[spell][0] === step.element;
  return true;
}

/**
 * Reconoce en partida los combos de hechizos del catálogo, leyendo solo los eventos que la
 * simulación ya emite (`cast`, `release`, `hit`, `combo`) y cómo quedan los magos: no agrega
 * nada a la red. Los pasos son los hechizos que lanza el jugador en orden, sin otro hechizo
 * suyo entre medio y sin pasar `maxGap` entre uno y otro; después tiene que llegar el remate
 * (ver `COMBO_DETECT`). En los combos con paso de aliado, ese paso lo lanza un compañero.
 */
export class ComboDetector {
  /** Hechizos recientes de tu equipo, del más viejo al más nuevo. */
  private releases: Release[] = [];
  private pending: Pending[] = [];
  private before = new Map<EntityId, Snapshot>();
  /**
   * Quiénes terminaron de tejer y todavía no sueltan el hechizo. Un `release` sin tejido antes
   * es una repetición (el segundo meteoro del Eco ardiente) y no cuenta como paso.
   */
  private woven = new Set<EntityId>();
  /** Cuándo hizo cada mago de tu equipo su último golpe grande (ver `priorBigHit`). */
  private bigHits = new Map<EntityId, number>();
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
    this.before.clear();
    this.woven.clear();
    this.bigHits.clear();
  }

  /** Procesa un paso de la partida y devuelve los combos del jugador que salieron. */
  onStep(events: readonly GameEvent[], state: MatchState): ComboHit[] {
    const tick = state.tick;
    const teamOf = new Map(state.wizards.map((w) => [w.id, w.team]));
    const myTeam = teamOf.get(this.playerId);
    const hits: ComboHit[] = [];
    const succeed = (pending: Pending, targetId: EntityId): void => {
      this.pending = this.pending.filter((p) => p !== pending);
      if (pending.casters.has(this.playerId)) hits.push({ combo: pending.combo, targetId });
    };
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
          const matched = this.matchSteps(combo);
          if (!matched) continue;
          const detect = COMBO_DETECT[combo.id] ?? {};
          if (
            detect.check === 'priorBigHit' &&
            (this.bigHits.get(event.wizardId) ?? -1) < matched.firstTick
          ) {
            continue;
          }
          const pending: Pending = {
            combo,
            detect,
            finisher: event.wizardId,
            casters: matched.casters,
            deadline:
              tick + (detect.window ? Math.round(detect.window * TICK_RATE) : FINISH_WINDOW),
          };
          if ((detect.finish ?? 'hit') !== 'cast') {
            this.pending.push(pending);
          } else if (this.castHolds(pending, state) && matched.casters.has(this.playerId)) {
            hits.push({ combo, targetId: event.wizardId });
          }
        }
      } else if (event.type === 'hit') {
        const sourceTeam = teamOf.get(event.sourceId);
        const targetTeam = teamOf.get(event.targetId);
        if (targetTeam === undefined) continue;
        if (sourceTeam === myTeam && targetTeam !== myTeam && event.amount >= BIG_HIT) {
          this.bigHits.set(event.sourceId, tick);
        }
        for (const pending of [...this.pending]) {
          if (this.hitFinishes(pending, event, targetTeam === myTeam, state)) {
            succeed(pending, event.targetId);
          }
        }
      } else if (event.type === 'combo') {
        const targetTeam = teamOf.get(event.targetId);
        if (targetTeam === undefined || targetTeam === myTeam) continue;
        for (const pending of [...this.pending]) {
          const { finish, reaction } = pending.detect;
          if (pending.finisher !== event.sourceId) continue;
          if (finish === 'reaction' && reaction === event.combo) succeed(pending, event.targetId);
        }
      }
    }

    // Remates que son un estado sin daño (dormirlo): se ven comparando con el paso anterior.
    for (const pending of [...this.pending]) {
      const status = pending.detect.status;
      if (pending.detect.finish !== 'status' || !status) continue;
      const victim = state.wizards.find(
        (w) =>
          w.team !== myTeam &&
          w.statuses[status] !== undefined &&
          !this.before.get(w.id)?.statuses.has(status),
      );
      if (!victim) continue;
      if (
        pending.detect.check === 'sleepWhileStunned' &&
        victim.statuses.stunned === undefined &&
        !this.before.get(victim.id)?.statuses.has('stunned')
      ) {
        continue;
      }
      succeed(pending, victim.id);
    }

    this.before = new Map(
      state.wizards.map((w) => [
        w.id,
        {
          statuses: new Set(Object.keys(w.statuses) as StatusId[]),
          hp: w.hp,
          shield: w.shield,
        },
      ]),
    );
    return dedupe(hits);
  }

  /** Si un golpe remata el combo que espera. `onMyTeam`: el golpeado es de tu equipo. */
  private hitFinishes(
    pending: Pending,
    event: Extract<GameEvent, { type: 'hit' }>,
    onMyTeam: boolean,
    state: MatchState,
  ): boolean {
    const detect = pending.detect;
    if ((detect.finish ?? 'hit') !== 'hit') return false;

    if (detect.check === 'sharedShield') {
      // Te pegan a ti y la burbuja de tu aliado injertado se come su parte.
      if (event.targetId !== pending.finisher) return false;
      const team = state.wizards.find((w) => w.id === pending.finisher)?.team;
      return state.wizards.some(
        (w) =>
          w.id !== pending.finisher &&
          w.team === team &&
          w.statuses.grafted !== undefined &&
          w.shield < (this.before.get(w.id)?.shield ?? 0),
      );
    }

    if (onMyTeam || pending.finisher !== event.sourceId) return false;
    if (event.amount < COMBO_TIMING.minHit && !detect.trickle) return false;
    if (detect.status && !this.before.get(event.targetId)?.statuses.has(detect.status)) {
      return false;
    }
    switch (detect.check) {
      case 'shackledOrb':
        return this.shackledOrb(pending.finisher, event.targetId, state);
      case 'seedOnAlly':
        // La Semilla la llevaba un aliado (no tú) y se gastó al explotar.
        return state.wizards.some(
          (w) =>
            w.id !== pending.finisher &&
            this.before.get(w.id)?.statuses.has('emberSeed') === true &&
            w.statuses.emberSeed === undefined,
        );
      case 'selfShield':
        return (this.before.get(pending.finisher)?.shield ?? 0) > 0;
      default:
        return true;
    }
  }

  /** Para los remates `cast`: lo que además tiene que cumplirse al lanzar el último paso. */
  private castHolds(pending: Pending, state: MatchState): boolean {
    const me = state.wizards.find((w) => w.id === pending.finisher);
    switch (pending.detect.check) {
      case 'selfGain':
        return me !== undefined && me.hp > (this.before.get(me.id)?.hp ?? me.hp);
      case 'ringActive':
        return state.spells.some((s) => s.kind === 'thornRing' && s.ownerId === pending.finisher);
      default:
        return true;
    }
  }

  /** El rival tiene tu Grillete y tu Orbe errático pasa a su lado. */
  private shackledOrb(ownerId: EntityId, targetId: EntityId, state: MatchState): boolean {
    const target = state.wizards.find((w) => w.id === targetId);
    if (!target) return false;
    const shackled = state.spells.some(
      (s) => s.kind === 'shackle' && s.ownerId === ownerId && s.targetId === targetId,
    );
    const orbNear = state.spells.some(
      (s) =>
        s.kind === 'sweeper' &&
        s.mode === 'orb' &&
        s.ownerId === ownerId &&
        Math.hypot(s.pos.x - target.pos.x, s.pos.z - target.pos.z) <= ORB_REACH,
    );
    return shackled && orbNear;
  }

  /**
   * Si los últimos hechizos del equipo completan los pasos del combo, devuelve quiénes los
   * lanzaron y cuándo fue el primero. En un combo de un solo mago cuentan solo los hechizos de
   * quien lanzó el último.
   */
  private matchSteps(combo: Combo): { casters: Set<EntityId>; firstTick: number } | null {
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
    return { casters, firstTick: window[0]?.tick ?? 0 };
  }
}

function dedupe(hits: ComboHit[]): ComboHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.combo.id) && seen.add(h.combo.id));
}
