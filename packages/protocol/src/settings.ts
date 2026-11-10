import type { GameMode } from '@crisol/core';

/** Lo que elige quien crea la sala, a la vista de todos antes de empezar. */
export interface RoomSettings {
  readonly mode: GameMode;
  /** Minutos por ronda. */
  readonly minutes: number;
  /** Al mejor de 1, 3 o 5 rondas. */
  readonly bestOf: number;
  /** Si se eligen Glifos entre rondas. */
  readonly glyphs: boolean;
  /** Si la partida tiene un Presagio. */
  readonly omen: boolean;
}

export const ROUND_MINUTES: readonly number[] = [2, 3, 4, 5];
export const BEST_OF: readonly number[] = [1, 3, 5];

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  mode: { kind: 'duel' },
  minutes: 3,
  bestOf: 3,
  glyphs: true,
  omen: true,
};

/** Los modos que se pueden jugar en red. */
export const ROOM_MODES: readonly GameMode[] = [
  { kind: 'duel' },
  { kind: 'teams', size: 2 },
  { kind: 'teams', size: 3 },
  { kind: 'ffa', players: 4 },
  { kind: 'ffa', players: 6 },
];

export function sameMode(a: GameMode, b: GameMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'teams' && b.kind === 'teams') return a.size === b.size;
  if (a.kind === 'ffa' && b.kind === 'ffa') return a.players === b.players;
  return true;
}

/** Deja ajustes válidos: lo que venga mal vuelve al valor por defecto. */
export function cleanRoomSettings(raw: unknown): RoomSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const mode = ROOM_MODES.find((m) => isMode(source.mode) && sameMode(m, source.mode));
  const minutes = ROUND_MINUTES.includes(source.minutes as number)
    ? (source.minutes as number)
    : DEFAULT_ROOM_SETTINGS.minutes;
  const bestOf = BEST_OF.includes(source.bestOf as number)
    ? (source.bestOf as number)
    : DEFAULT_ROOM_SETTINGS.bestOf;
  return {
    mode: mode ?? DEFAULT_ROOM_SETTINGS.mode,
    minutes,
    bestOf,
    glyphs: typeof source.glyphs === 'boolean' ? source.glyphs : DEFAULT_ROOM_SETTINGS.glyphs,
    omen: typeof source.omen === 'boolean' ? source.omen : DEFAULT_ROOM_SETTINGS.omen,
  };
}

function isMode(value: unknown): value is GameMode {
  return (
    typeof value === 'object' && value !== null && typeof (value as GameMode).kind === 'string'
  );
}
