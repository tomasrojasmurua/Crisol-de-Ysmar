import type { ElementId, Highlight, Intent, MatchState, WizardMatchStats } from '@crisol/core';
import type { RoomSettings } from './settings';

/** Se sube cuando cambia el formato de los mensajes; cliente y Sala deben coincidir. */
export const PROTOCOL_VERSION = 22;

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
  /** Pausa tras una ronda: quién la ganó y su mejor jugada (la elige la Sala, igual para todos). */
  | {
      readonly kind: 'intermission';
      readonly roundWinner: number;
      readonly ticksLeft: number;
      readonly highlight: Highlight | null;
    }
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
  /**
   * Terminó la serie: quiénes piden revancha y el resumen de cada mago (sale en la pantalla
   * final y se suma a tu perfil). `seriesId` distingue cada partida, para no sumarla dos veces
   * si vuelves tras un corte.
   */
  | {
      readonly kind: 'finished';
      readonly rematch: readonly number[];
      readonly seriesId: number;
      readonly stats: readonly WizardMatchStats[];
      /** La mejor jugada de toda la partida. */
      readonly highlight: Highlight | null;
    };

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
      /** Entra por Partida rápida: una sala vacía queda pública, con ajustes fijos. */
      readonly quick?: boolean;
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
      /** Es una Partida rápida (sala pública: nadie cambia los ajustes). */
      readonly quick?: boolean;
      /** Partida rápida: cuántos ms faltan para que empiece sola (si ya corre la cuenta). */
      readonly startsIn?: number;
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
   * La mejor jugada de la partida hasta ahora. Cuando cambia, cada celular aparta de lo que ya
   * recibió los pasos de esa jugada, para repetirla al final (ver `game/ReplayRecorder.ts`).
   */
  readonly best: Highlight | null;
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

/**
 * En qué servidor vive una sala, escrito en su código: con letra al comienzo, en el servidor
 * principal (Santiago); con número, en el de respaldo (Cloudflare). Así quien entra con el código
 * o el enlace llega siempre a la misma sala, aunque el principal se haya caído o llenado cuando
 * se creó (ver docs/carga.md).
 */
export type RoomServer = 'main' | 'fallback';

const FALLBACK_FIRST = '23456789';

export function roomServerOf(code: string): RoomServer {
  const first = code.charAt(0);
  return first !== '' && FALLBACK_FIRST.includes(first) ? 'fallback' : 'main';
}

/** Las letras con que puede empezar un código de ese servidor. */
function firstCharsFor(server: RoomServer): string {
  return server === 'fallback' ? FALLBACK_FIRST : ROOM_CODE_ALPHABET.replace(/[2-9]/g, '');
}

/**
 * Un código de sala de ese servidor, con la fuente de azar que se le pase (un número de 0 a 1
 * por letra).
 */
export function randomRoomCode(random: () => number, server: RoomServer = 'main'): string {
  const first = firstCharsFor(server);
  let code = first[Math.floor(random() * first.length)] ?? 'A';
  for (let i = 1; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)] ?? 'A';
  }
  return code;
}
