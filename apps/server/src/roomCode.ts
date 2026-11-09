import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@crisol/protocol';

/** Código corto para el enlace de WhatsApp, por ejemplo "K7QF". */
export function generateRoomCode(randomValues: (array: Uint8Array) => Uint8Array): string {
  const bytes = randomValues(new Uint8Array(ROOM_CODE_LENGTH));
  let code = '';
  for (const byte of bytes) {
    code += ROOM_CODE_ALPHABET.charAt(byte % ROOM_CODE_ALPHABET.length);
  }
  return code;
}
