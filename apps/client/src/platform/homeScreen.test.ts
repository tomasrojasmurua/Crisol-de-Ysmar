import { describe, expect, it } from 'vitest';
import { carriedInHash, isCarried, packProgress, unpackProgress } from './homeScreen';

describe('progreso que viaja a la pantalla de inicio', () => {
  it('lleva el progreso del juego, no la sala del momento ni la invitación', () => {
    expect(isCarried('crisol.grimorio')).toBe(true);
    expect(isCarried('crisol.perfil')).toBe(true);
    expect(isCarried('crisol.ultimaSala')).toBe(false);
    expect(isCarried('crisol.sala.K7QF')).toBe(false);
    expect(isCarried('crisol.inicio')).toBe(false);
    expect(isCarried('otraCosa')).toBe(false);
  });

  it('empaca y desempaca igual, con tildes y sin caracteres que rompan la dirección', () => {
    const entries = {
      'crisol.perfil': JSON.stringify({ name: 'Tomás Ñuñoa' }),
      'crisol.grimorio': JSON.stringify(['brasa', 'umbra-marea']),
    };
    const packed = packProgress(entries);
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(unpackProgress(packed)).toEqual(entries);
    expect(carriedInHash(`#traer=${packed}`)).toEqual(entries);
  });

  it('descarta lo que no es progreso o viene roto', () => {
    const packed = packProgress({ 'crisol.grimorio': '[]', 'crisol.ultimaSala': '{}', x: 'y' });
    expect(unpackProgress(packed)).toEqual({ 'crisol.grimorio': '[]' });
    expect(unpackProgress('%%%')).toBeNull();
    expect(unpackProgress(packProgress([] as unknown as Record<string, string>))).toBeNull();
    expect(carriedInHash('')).toBeNull();
  });
});
