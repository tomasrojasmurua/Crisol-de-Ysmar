import { isValidRoomCode, roomServerOf } from '@crisol/protocol';
import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './roomCode';

describe('generateRoomCode', () => {
  it('genera códigos válidos del servidor que se pide', () => {
    for (let i = 0; i < 200; i++) {
      const main = generateRoomCode((array) => crypto.getRandomValues(array));
      const fallback = generateRoomCode((array) => crypto.getRandomValues(array), 'fallback');
      expect(isValidRoomCode(main) && isValidRoomCode(fallback)).toBe(true);
      expect(roomServerOf(main)).toBe('main');
      expect(roomServerOf(fallback)).toBe('fallback');
    }
  });
});
