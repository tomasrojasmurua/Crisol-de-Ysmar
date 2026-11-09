import { isValidRoomCode } from '@crisol/protocol';
import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './roomCode';

describe('generateRoomCode', () => {
  it('genera códigos válidos', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode((array) => crypto.getRandomValues(array));
      expect(isValidRoomCode(code)).toBe(true);
    }
  });
});
