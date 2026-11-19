import type { SpellId } from '../spells/catalog';
import { rivals } from './matchStats';
import type { EntityId, MatchState } from './state';

/**
 * La mejor jugada de cada ronda y de la partida.
 *
 * Una **jugada** es una seguidilla de golpes de un mago a magos rivales sin pausas largas: cada
 * golpe nuevo dentro de `gapTicks` del anterior la alarga; después de esa pausa se cierra. El
 * daño que gotea paso a paso (quemaduras, zonas) suma a la jugada abierta pero no la empieza ni
 * la alarga: si no, una quemadura larga la estiraba diez segundos. Y dura a lo más `maxTicks`:
 * un asedio largo se parte en tramos, así se comparan ráfagas parecidas. Vale
 * por el daño que hizo, los rivales que derribó, a cuántos distintos alcanzó, las reacciones que
 * provocó y si su derribo cerró la ronda. Se cuenta solo con los avisos de cada paso, igual que
 * las estadísticas: en red la calcula la Sala y la manda, así todos ven la misma.
 */

/** Cuánto vale cada cosa y cuánto dura una jugada. Los números están en `@crisol/content`. */
export interface HighlightRules {
  /** Pasos sin golpear a un rival tras los que la jugada se cierra. */
  readonly gapTicks: number;
  /** Un golpe desde este daño cuenta como golpe; lo de menos es daño que gotea por paso. */
  readonly minHit: number;
  /** Lo más que dura una jugada; el golpe siguiente empieza otra. */
  readonly maxTicks: number;
  /** Los hechizos lanzados hasta esta cantidad de pasos antes del primer golpe son parte de ella. */
  readonly leadTicks: number;
  /** Puntos por cada punto de daño. */
  readonly damage: number;
  readonly knockout: number;
  /** Por cada rival alcanzado además del primero. */
  readonly extraTarget: number;
  readonly reaction: number;
  /** Si uno de sus derribos terminó la ronda. */
  readonly decisive: number;
  /** Cuántos hechizos se muestran de una jugada (los últimos antes del último golpe, en orden). */
  readonly maxSpells: number;
}

/** Una jugada terminada, lista para mostrarse. */
export interface Highlight {
  readonly wizardId: EntityId;
  /** La ronda en que pasó, desde 1. */
  readonly round: number;
  readonly damage: number;
  readonly hits: number;
  readonly knockouts: number;
  /** Rivales distintos que alcanzó. */
  readonly targets: number;
  readonly reactions: number;
  /** Los hechizos que lanzó en la jugada, en orden (los repetidos seguidos van una vez). */
  readonly spells: readonly SpellId[];
  /** Del primer golpe al último, en pasos. */
  readonly ticks: number;
  /** El paso (de su ronda) del último golpe: con `ticks`, dónde está la jugada para repetirla. */
  readonly endTick: number;
  /** Uno de sus derribos terminó la ronda. */
  readonly decisive: boolean;
  readonly score: number;
}

interface OpenPlay {
  readonly wizardId: EntityId;
  readonly startTick: number;
  lastTick: number;
  damage: number;
  hits: number;
  knockouts: number;
  readonly targets: Set<EntityId>;
  reactions: number;
  decisive: boolean;
  readonly releases: { readonly spell: SpellId; readonly tick: number }[];
}

/** Hechizos que recuerda una jugada abierta: los de más atrás no se alcanzan a mostrar. */
const RELEASES_MAX = 16;

export interface HighlightTracker {
  readonly rules: HighlightRules;
  /** La ronda que se está jugando, desde 1. */
  round: number;
  readonly open: Map<EntityId, OpenPlay>;
  /** Los últimos hechizos de cada mago, para sumar a la jugada los que salieron antes del golpe. */
  readonly recent: Map<EntityId, { readonly spell: SpellId; readonly tick: number }[]>;
  roundBest: Highlight | null;
  matchBest: Highlight | null;
}

export function createHighlightTracker(rules: HighlightRules): HighlightTracker {
  return { rules, round: 1, open: new Map(), recent: new Map(), roundBest: null, matchBest: null };
}

/** Suma lo que pasó en el último paso (`state.events`) y cierra las jugadas que se enfriaron. */
export function recordHighlights(tracker: HighlightTracker, state: MatchState): void {
  const tick = state.tick;
  const rules = tracker.rules;
  // Primero se cierran las que se enfriaron: un golpe tras la pausa empieza otra jugada.
  for (const play of [...tracker.open.values()]) {
    if (tick - play.lastTick > rules.gapTicks) close(tracker, play);
  }
  let lastHit: Map<EntityId, EntityId> | null = null;
  for (const event of state.events) {
    switch (event.type) {
      case 'release': {
        const recent = tracker.recent.get(event.wizardId) ?? [];
        recent.push({ spell: event.spell, tick });
        if (recent.length > rules.maxSpells) recent.shift();
        tracker.recent.set(event.wizardId, recent);
        const open = tracker.open.get(event.wizardId);
        if (open) {
          open.releases.push({ spell: event.spell, tick });
          if (open.releases.length > RELEASES_MAX) open.releases.shift();
        }
        break;
      }
      case 'hit': {
        lastHit ??= new Map();
        lastHit.set(event.targetId, event.sourceId);
        if (event.amount <= 0 || !rivals(state, event.sourceId, event.targetId)) break;
        if (event.amount < rules.minHit) {
          const open = tracker.open.get(event.sourceId);
          if (open) open.damage += event.amount;
          break;
        }
        const play = playOf(tracker, event.sourceId, tick);
        play.damage += event.amount;
        play.hits++;
        play.targets.add(event.targetId);
        play.lastTick = tick;
        break;
      }
      case 'combo': {
        if (rivals(state, event.sourceId, event.targetId))
          playOf(tracker, event.sourceId, tick).reactions++;
        break;
      }
      case 'defeated': {
        const by = lastHit?.get(event.wizardId);
        if (by === undefined || !rivals(state, by, event.wizardId)) break;
        const play = playOf(tracker, by, tick);
        play.knockouts++;
        play.lastTick = tick;
        if (state.winnerTeam !== null) play.decisive = true;
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Terminó la ronda: cierra lo que quedaba abierto y devuelve su mejor jugada (null si nadie
 * golpeó a un rival). La de la partida queda en `tracker.matchBest`.
 */
export function finishHighlightRound(tracker: HighlightTracker): Highlight | null {
  for (const play of [...tracker.open.values()]) close(tracker, play);
  const best = tracker.roundBest;
  tracker.recent.clear();
  tracker.roundBest = null;
  tracker.round++;
  return best;
}

function playOf(tracker: HighlightTracker, wizardId: EntityId, tick: number): OpenPlay {
  const open = tracker.open.get(wizardId);
  if (open && tick - open.startTick <= tracker.rules.maxTicks) return open;
  if (open) close(tracker, open);
  const lead = tick - tracker.rules.leadTicks;
  const play: OpenPlay = {
    wizardId,
    startTick: tick,
    lastTick: tick,
    damage: 0,
    hits: 0,
    knockouts: 0,
    targets: new Set(),
    reactions: 0,
    decisive: false,
    releases: (tracker.recent.get(wizardId) ?? []).filter((r) => r.tick >= lead),
  };
  tracker.open.set(wizardId, play);
  return play;
}

function close(tracker: HighlightTracker, play: OpenPlay): void {
  tracker.open.delete(play.wizardId);
  if (play.hits === 0 && play.knockouts === 0) return;
  const rules = tracker.rules;
  const spells: SpellId[] = [];
  for (const release of play.releases) {
    // Lo que lanzó después del último golpe ya no es parte de la jugada.
    if (release.tick > play.lastTick) break;
    if (spells[spells.length - 1] !== release.spell) spells.push(release.spell);
  }
  // Se muestran los últimos: los que remataron la jugada.
  spells.splice(0, Math.max(0, spells.length - rules.maxSpells));
  const damage = Math.round(play.damage);
  const targets = play.targets.size;
  const score =
    damage * rules.damage +
    play.knockouts * rules.knockout +
    Math.max(0, targets - 1) * rules.extraTarget +
    play.reactions * rules.reaction +
    (play.decisive ? rules.decisive : 0);
  const highlight: Highlight = {
    wizardId: play.wizardId,
    round: tracker.round,
    damage,
    hits: play.hits,
    knockouts: play.knockouts,
    targets,
    reactions: play.reactions,
    spells,
    ticks: play.lastTick - play.startTick,
    endTick: play.lastTick,
    decisive: play.decisive,
    score,
  };
  // En empate gana la que pasó antes: así todos los celulares eligen la misma.
  if (!tracker.roundBest || score > tracker.roundBest.score) tracker.roundBest = highlight;
  if (!tracker.matchBest || score > tracker.matchBest.score) tracker.matchBest = highlight;
}
