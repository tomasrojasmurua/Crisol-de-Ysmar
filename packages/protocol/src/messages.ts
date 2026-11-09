import type { Intent } from '@crisol/core';

/** Se sube cuando cambia el formato de los mensajes; cliente y Sala deben coincidir. */
export const PROTOCOL_VERSION = 1;

/** Del celular a la Sala. */
export type ClientMessage =
  | { readonly type: 'hello'; readonly protocol: number; readonly playerName: string }
  | { readonly type: 'intents'; readonly seq: number; readonly intents: readonly Intent[] }
  | { readonly type: 'ping'; readonly sentAt: number };

/** De la Sala al celular. */
export type ServerMessage =
  | { readonly type: 'welcome'; readonly roomCode: string; readonly playerId: number }
  | { readonly type: 'pong'; readonly sentAt: number }
  | { readonly type: 'error'; readonly reason: string };

/** Códigos de sala cortos y fáciles de dictar: sin 0/O ni 1/I. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  return [...code].every((char) => ROOM_CODE_ALPHABET.includes(char));
}
