import { describe, expect, it } from 'vitest';
import { decodeClientMessage, decodeServerMessage, encode } from './codec';
import { isValidRoomCode, PROTOCOL_VERSION, randomRoomCode, roomServerOf } from './messages';

describe('protocolo', () => {
  it('un mensaje sobrevive ida y vuelta', () => {
    const message = { type: 'hello', protocol: PROTOCOL_VERSION, playerName: 'Tomás' } as const;
    expect(decodeClientMessage(encode(message))).toEqual(message);
  });

  it('rechaza mensajes desconocidos o mal formados', () => {
    expect(decodeClientMessage('{"type":"hack"}')).toBeNull();
    expect(decodeServerMessage('no es json')).toBeNull();
  });

  it('valida códigos de sala', () => {
    expect(isValidRoomCode('K7QF')).toBe(true);
    expect(isValidRoomCode('K7Q')).toBe(false);
    expect(isValidRoomCode('O0I1')).toBe(false);
  });

  it('el código dice en qué servidor vive la sala', () => {
    for (let i = 0; i < 200; i++) {
      const main = randomRoomCode(Math.random, 'main');
      const fallback = randomRoomCode(Math.random, 'fallback');
      expect(isValidRoomCode(main) && isValidRoomCode(fallback)).toBe(true);
      expect(roomServerOf(main)).toBe('main');
      expect(roomServerOf(fallback)).toBe('fallback');
    }
    expect(roomServerOf('K7QF')).toBe('main');
    expect(roomServerOf('7KQF')).toBe('fallback');
  });
});
