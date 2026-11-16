import { SPELL_IDS, type SpellId, type WizardMatchStats } from '@crisol/core';

/**
 * Tu historial de partidas: se suma al terminar cada serie (contra la IA o en red, nunca el
 * entrenamiento) y se guarda en este celular bajo `crisol.estadisticas`. Como toda clave
 * `crisol.*`, viaja sola en el respaldo del servidor (ver docs/respaldo.md), así que no se
 * pierde al cambiar de celular.
 */

const STORAGE_KEY = 'crisol.estadisticas';
/** Las últimas partidas sumadas, para no contar dos veces la misma si vuelves tras un corte. */
const RECENT_MAX = 12;

export type ModeGroup = 'duel' | 'teams' | 'ffa';
export const MODE_GROUPS: readonly ModeGroup[] = ['duel', 'teams', 'ffa'];

export interface WinRecord {
  readonly played: number;
  readonly wins: number;
}

export interface PlayerRecord {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  /** Victorias seguidas que llevas ahora, y la racha más larga. */
  readonly streak: number;
  readonly bestStreak: number;
  /** Partidas en red (con amigos o Partida rápida). */
  readonly online: WinRecord;
  readonly byMode: Readonly<Record<ModeGroup, WinRecord>>;
  readonly damage: number;
  readonly taken: number;
  readonly knockouts: number;
  readonly falls: number;
  readonly casts: number;
  readonly reactions: number;
  readonly beasts: number;
  /** Récords de una sola partida. */
  readonly bestDamage: number;
  readonly bestKnockouts: number;
  readonly spells: Readonly<Partial<Record<SpellId, number>>>;
  readonly recent: readonly string[];
}

const NO_WINS: WinRecord = { played: 0, wins: 0 };

export const EMPTY_RECORD: PlayerRecord = {
  played: 0,
  wins: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  online: NO_WINS,
  byMode: { duel: NO_WINS, teams: NO_WINS, ffa: NO_WINS },
  damage: 0,
  taken: 0,
  knockouts: 0,
  falls: 0,
  casts: 0,
  reactions: 0,
  beasts: 0,
  bestDamage: 0,
  bestKnockouts: 0,
  spells: {},
  recent: [],
};

/** Una partida terminada, vista por este jugador. */
export interface FinishedMatch {
  /** Distingue la partida (ver `MatchSummary.id`). */
  readonly id: string;
  readonly outcome: 'win' | 'loss' | 'draw';
  readonly mode: ModeGroup;
  readonly online: boolean;
  /** Tu fila del resumen; sin ella (no estabas en la partida) no se suma nada. */
  readonly own: WizardMatchStats | undefined;
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

function winRecord(raw: unknown): WinRecord {
  const r = (raw ?? {}) as Partial<Record<keyof WinRecord, unknown>>;
  const played = count(r.played);
  return { played, wins: Math.min(played, count(r.wins)) };
}

/** Lee lo guardado sin confiar en nada: un respaldo viejo o roto da un historial vacío. */
export function parseRecord(text: string | null): PlayerRecord {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text ?? '{}') as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null) return EMPTY_RECORD;
  } catch {
    return EMPTY_RECORD;
  }
  const byMode = (raw.byMode ?? {}) as Record<string, unknown>;
  const spells: Partial<Record<SpellId, number>> = {};
  const rawSpells = (raw.spells ?? {}) as Record<string, unknown>;
  for (const id of SPELL_IDS) {
    const n = count(rawSpells[id]);
    if (n > 0) spells[id] = n;
  }
  const played = count(raw.played);
  return {
    played,
    wins: Math.min(played, count(raw.wins)),
    draws: count(raw.draws),
    streak: count(raw.streak),
    bestStreak: count(raw.bestStreak),
    online: winRecord(raw.online),
    byMode: {
      duel: winRecord(byMode.duel),
      teams: winRecord(byMode.teams),
      ffa: winRecord(byMode.ffa),
    },
    damage: count(raw.damage),
    taken: count(raw.taken),
    knockouts: count(raw.knockouts),
    falls: count(raw.falls),
    casts: count(raw.casts),
    reactions: count(raw.reactions),
    beasts: count(raw.beasts),
    bestDamage: count(raw.bestDamage),
    bestKnockouts: count(raw.bestKnockouts),
    spells,
    recent: Array.isArray(raw.recent)
      ? raw.recent.filter((id): id is string => typeof id === 'string').slice(-RECENT_MAX)
      : [],
  };
}

const addWin = (record: WinRecord, won: boolean): WinRecord => ({
  played: record.played + 1,
  wins: record.wins + (won ? 1 : 0),
});

/** Suma una partida al historial; si ya estaba sumada (o no jugaste), lo deja igual. */
export function addMatch(record: PlayerRecord, match: FinishedMatch): PlayerRecord {
  const own = match.own;
  if (!own || record.recent.includes(match.id)) return record;
  const won = match.outcome === 'win';
  const spells = { ...record.spells };
  for (const [id, n] of Object.entries(own.spells) as [SpellId, number][]) {
    spells[id] = (spells[id] ?? 0) + count(n);
  }
  const streak = won ? record.streak + 1 : 0;
  const damage = count(own.damage);
  return {
    played: record.played + 1,
    wins: record.wins + (won ? 1 : 0),
    draws: record.draws + (match.outcome === 'draw' ? 1 : 0),
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    online: match.online ? addWin(record.online, won) : record.online,
    byMode: { ...record.byMode, [match.mode]: addWin(record.byMode[match.mode], won) },
    damage: record.damage + damage,
    taken: record.taken + count(own.taken),
    knockouts: record.knockouts + count(own.knockouts),
    falls: record.falls + count(own.falls),
    casts: record.casts + count(own.casts),
    reactions: record.reactions + count(own.reactions),
    beasts: record.beasts + count(own.beasts),
    bestDamage: Math.max(record.bestDamage, damage),
    bestKnockouts: Math.max(record.bestKnockouts, count(own.knockouts)),
    spells,
    recent: [...record.recent, match.id].slice(-RECENT_MAX),
  };
}

/** Los hechizos que más usas, del más usado al menos. */
export function topSpells(
  record: PlayerRecord,
  limit: number,
): { readonly spell: SpellId; readonly count: number }[] {
  return (Object.entries(record.spells) as [SpellId, number][])
    .map(([spell, n]) => ({ spell, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** El historial guardado en este celular. */
export class PlayerStats {
  private current: PlayerRecord;

  constructor() {
    let text: string | null = null;
    try {
      text = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento: el historial dura solo esta visita.
    }
    this.current = parseRecord(text);
  }

  get record(): PlayerRecord {
    return this.current;
  }

  /** Suma la partida y la guarda. Devuelve true si era nueva. */
  add(match: FinishedMatch): boolean {
    const next = addMatch(this.current, match);
    if (next === this.current) return false;
    this.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // No es grave: se pierde solo si se cierra la app.
    }
    return true;
  }
}
