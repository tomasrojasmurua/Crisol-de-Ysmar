import type { ElementId, Intent, MatchState } from '@crisol/core';
import type { RoomSettings } from './settings';

/** Se sube cuando cambia el formato de los mensajes; cliente y Sala deben coincidir. */
export const PROTOCOL_VERSION = 13;

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
  /** Conectado pero fuera de la app (pestaña oculta o sin señal): la IA juega por él. */
  readonly away: boolean;
  /** Un puesto que ocupa la IA porque nadie lo tomó al empezar. */
  readonly bot: boolean;
}

/** En qué parte de la partida va la Sala, visto por un jugador. */
export type NetStage =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'intermission'; readonly roundWinner: number; readonly ticksLeft: number }
  /**
   * Entre rondas: los Glifos que te ofrecen, si ya elegiste (esperas al otro) y cuántos pasos
   * quedan antes de que la Sala elija al azar por quien no eligió.
   */
  | {
      readonly kind: 'choosing';
      readonly options: readonly string[];
      readonly chosen: boolean;
      readonly ticksLeft: number;
    }
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
  /** Quien manda en la sala cambia los ajustes (modo, tiempo, rondas…) antes de empezar. */
  | { readonly type: 'settings'; readonly settings: RoomSettings }
  /** Quien manda en la sala empieza: la IA ocupa los puestos libres. */
  | { readonly type: 'begin' }
  | { readonly type: 'intents'; readonly seq: number; readonly intents: readonly Intent[] }
  | { readonly type: 'glyph'; readonly glyphId: string }
  | { readonly type: 'rematch' }
  /** Saliste de la app (o volviste): mientras no miras, la IA juega por ti y no te llega estado. */
  | { readonly type: 'away'; readonly away: boolean }
  | { readonly type: 'ping'; readonly sentAt: number };

/** De la Sala al celular. */
export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly roomCode: string;
      readonly playerId: number;
      readonly token: string;
      /**
       * La Sala está en la sala de espera. Si ya ibas jugando, la Sala se reinició (se publicó
       * una versión nueva o Cloudflare la movió) y la partida se perdió.
       */
      readonly lobby?: boolean;
    }
  /** Quiénes están en la Sala; cambia cuando alguien entra, sale o vuelve. */
  | {
      readonly type: 'players';
      readonly players: readonly PlayerInfo[];
      /** Los ajustes de la sala y el puesto de quien manda en la sala de espera. */
      readonly settings: RoomSettings;
      readonly hostId: number;
    }
  /**
   * Empieza una partida nueva: el Presagio y quién es quién. Con `resume`, es la misma partida
   * que ya ibas jugando (volviste tras un corte): se sigue sin rearmar nada.
   */
  | {
      readonly type: 'start';
      readonly omenId: string;
      readonly players: readonly PlayerInfo[];
      readonly settings: RoomSettings;
      readonly resume?: boolean;
    }
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
