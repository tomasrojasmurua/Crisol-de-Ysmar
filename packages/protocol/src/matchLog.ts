import {
  type BotLevel,
  type GameMode,
  MATCH_LOG_ROW_LIMIT,
  type MatchLogRound,
  SPELL_IDS,
  type SpellId,
} from '@crisol/core';

/**
 * El registro de una partida terminada, sin nombres ni nada del celular: los magos van por
 * número, con su equipo y si los jugaba una persona. Lo manda el celular al terminar contra la
 * IA y la Sala al terminar en red; el servidor lo guarda en D1 (ver docs/partidas.md).
 */
export interface MatchLog {
  /** Versión del formato: si cambia, el script que busca combinaciones lo sabe. */
  readonly format: 1;
  /** 'ia': en el celular contra la IA; 'red': en una Sala. */
  readonly source: 'ia' | 'red';
  /** Modo corto: 'duel', 'teams2', 'ffa4'. */
  readonly mode: string;
  /** Dificultad de la IA que ocupó los puestos sin persona. */
  readonly botLevel: BotLevel;
  readonly wizards: readonly MatchLogWizard[];
  readonly rounds: readonly MatchLogRound[];
  /** Equipo que ganó la serie (-1 empate). */
  readonly winnerTeam: number;
  /** Versión del juego o de la Sala ("v79 · abc1234", "protocolo 24"). */
  readonly version: string;
}

export interface MatchLogWizard {
  readonly id: number;
  readonly team: number;
  /** false si lo jugó la IA toda la partida. */
  readonly human: boolean;
}

export const MATCH_LOG_LIMITS = {
  /** Bytes por registro: una serie larga de 6 magos cabe con holgura. */
  bytes: 400_000,
  rounds: 9,
  wizards: 6,
} as const;

/** El modo corto que va en el registro. */
export function modeKey(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return 'duel';
    case 'teams':
      return `teams${mode.size}`;
    case 'ffa':
      return `ffa${mode.players}`;
  }
}

const LEVELS: readonly BotLevel[] = ['apprentice', 'duelist', 'master'];
const SPELLS = new Set<string>(SPELL_IDS);
const COMBOS = new Set(['conduction', 'shatter', 'kindling', 'steam', 'ashenCurse', 'mire']);

const int = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const num = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 10_000;

/** Filas de largo fijo cuyas columnas pasan cada una su prueba; las demás se descartan. */
function rows<T>(raw: unknown, checks: readonly ((v: unknown) => boolean)[]): T[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MATCH_LOG_ROW_LIMIT)
    .filter(
      (row): row is T =>
        Array.isArray(row) && row.length === checks.length && checks.every((ok, i) => ok(row[i])),
    );
}

const tick = (v: unknown): boolean => int(v, 0, 1_000_000);
const entity = (v: unknown): boolean => int(v, 0, 1_000_000);

function cleanRound(raw: unknown): MatchLogRound | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!tick(r.ticks)) return null;
  return {
    ticks: r.ticks as number,
    winnerTeam: int(r.winnerTeam, -1, 6) ? r.winnerTeam : null,
    casts: rows<[number, number, SpellId]>(r.casts, [
      tick,
      entity,
      (v) => typeof v === 'string' && SPELLS.has(v),
    ]),
    hits: rows(r.hits, [tick, entity, entity, num]),
    blocked: rows(r.blocked, [tick, entity, entity]),
    combos: rows(r.combos, [tick, entity, entity, (v) => typeof v === 'string' && COMBOS.has(v)]),
    falls: rows(r.falls, [tick, entity]),
  };
}

/** Lee un registro que llegó de afuera; null si no tiene la forma esperada. */
export function parseMatchLog(text: string): MatchLog | null {
  if (text.length > MATCH_LOG_LIMITS.bytes) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.format !== 1 || (r.source !== 'ia' && r.source !== 'red')) return null;
  const botLevel = LEVELS.find((l) => l === r.botLevel);
  if (!botLevel || typeof r.mode !== 'string' || !/^(duel|teams[23]|ffa[3-6])$/.test(r.mode)) {
    return null;
  }
  if (!Array.isArray(r.wizards) || !Array.isArray(r.rounds) || !int(r.winnerTeam, -1, 6)) {
    return null;
  }
  const wizards = r.wizards
    .slice(0, MATCH_LOG_LIMITS.wizards)
    .filter(
      (w): w is MatchLogWizard =>
        typeof w === 'object' &&
        w !== null &&
        int((w as MatchLogWizard).id, 1, 64) &&
        int((w as MatchLogWizard).team, 0, 6) &&
        typeof (w as MatchLogWizard).human === 'boolean',
    )
    .map((w) => ({ id: w.id, team: w.team, human: w.human }));
  const rounds = r.rounds
    .slice(0, MATCH_LOG_LIMITS.rounds)
    .map(cleanRound)
    .filter((round): round is MatchLogRound => round !== null);
  if (wizards.length < 2 || rounds.length === 0) return null;
  return {
    format: 1,
    source: r.source,
    mode: r.mode,
    botLevel,
    wizards,
    rounds,
    winnerTeam: r.winnerTeam,
    version: typeof r.version === 'string' ? r.version.slice(0, 80) : '',
  };
}
