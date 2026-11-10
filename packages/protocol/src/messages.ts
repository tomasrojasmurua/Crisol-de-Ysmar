import type { ElementId, Intent, MatchState } from '@crisol/core';

/** Se sube cuando cambia el formato de los mensajes; cliente y Sala deben coincidir. */
export const PROTOCOL_VERSION = 4;

/** Cómo se ve un hechicero: los ids de sus piezas del Vestidor. Solo cosmético. */
export interface PlayerLook {
  readonly robe: string;
  readonly trim: string;
  readonly skin: string;
  readonly face: string;
  readonly outfit: string;
  readonly headwear: string;
  readonly mask: string;
  readonly cape: string;
  readonly focus: string;
}

/** Quién juega en la Sala: su mago, su nombre, su aspecto y su Afinidad. */
export interface PlayerInfo {
  readonly id: number;
  readonly team: number;
  readonly name: string;
  readonly look: PlayerLook;
  readonly affinity: ElementId | null;
  /** Si ahora mismo está conectado; si no, la IA juega por él. */
  readonly connected: boolean;
}

/** En qué parte de la partida va la Sala, visto por un jugador. */
export type NetStage =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'intermission'; readonly roundWinner: number; readonly ticksLeft: number }
  /** Entre rondas: los Glifos que te ofrecen y si ya elegiste (esperas al otro). */
  | { readonly kind: 'choosing'; readonly options: readonly string[]; readonly chosen: boolean }
  | { readonly kind: 'finished'; readonly rematch: readonly number[] };

/** Del celular a la Sala. */
export type ClientMessage =
  | {
      readonly type: 'hello';
      readonly protocol: number;
      readonly playerName: string;
      readonly look?: PlayerLook;
      readonly affinity?: ElementId | null;
      /** Para volver a tu mago si se cortó la conexión. */
      readonly token?: string;
    }
  | { readonly type: 'intents'; readonly seq: number; readonly intents: readonly Intent[] }
  | { readonly type: 'glyph'; readonly glyphId: string }
  | { readonly type: 'rematch' }
  | { readonly type: 'ping'; readonly sentAt: number };

/** De la Sala al celular. */
export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly roomCode: string;
      readonly playerId: number;
      readonly token: string;
    }
  /** Quiénes están en la Sala; cambia cuando alguien entra, sale o vuelve. */
  | { readonly type: 'players'; readonly players: readonly PlayerInfo[] }
  /** Empieza una partida nueva: el Presagio y quién es quién. */
  | { readonly type: 'start'; readonly omenId: string; readonly players: readonly PlayerInfo[] }
  | { readonly type: 'pong'; readonly sentAt: number }
  | { readonly type: 'error'; readonly reason: string };

/**
 * Un paso de la simulación, visto por un jugador. Viaja en binario y solo con lo que cambió
 * (ver `stateCodec.ts`), no como texto.
 */
export interface StateFrame {
  /** El último mensaje de toques tuyo que ya entró a la simulación (para la predicción). */
  readonly ack: number;
  readonly state: MatchState;
  readonly stage: NetStage;
  readonly wins: readonly number[];
  readonly roundsPlayed: number;
  readonly seriesWinner: number | null;
  /** Los Glifos de cada mago, por id. */
  readonly glyphs: Readonly<Record<number, readonly string[]>>;
  /**
   * Rivales que no ves (Velo, Bosque maldito, Sombra prestada o tu Ceguera). La Sala no manda
   * dónde están ni qué tejen: llegan quietos donde los viste por última vez y no se dibujan.
   */
  readonly hidden: readonly number[];
}

/** Códigos de sala cortos y fáciles de dictar: sin 0/O ni 1/I. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char));
}

/** Un código de sala al azar, con la fuente de azar que se le pase. */
export function randomRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)] ?? 'A';
  }
  return code;
}
