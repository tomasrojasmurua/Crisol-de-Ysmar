import { describe, expect, it } from 'vitest';
import { decodeClientMessage, decodeServerMessage, encode } from './codec';
import { isValidRoomCode, PROTOCOL_VERSION } from './messages';

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
});
