import type { Highlight } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { highlightView } from './highlightView';

const NAMES = {
  playerId: 1,
  nameOf: (id: number) => (id === 2 ? 'Velio' : 'Hechicero'),
  colorOf: () => '#c04040',
};

const BASE: Highlight = {
  wizardId: 2,
  round: 2,
  damage: 1240,
  hits: 3,
  knockouts: 2,
  targets: 2,
  reactions: 1,
  spells: ['splash', 'chainLightning'],
  ticks: 74,
  endTick: 300,
  decisive: false,
  score: 0,
};

describe('la mejor jugada en pantalla', () => {
  it('dice quién, con qué y qué logró', () => {
    const view = highlightView(BASE, false, NAMES);
    expect(view).toMatchObject({
      kicker: 'Jugada de la ronda',
      name: 'Velio',
      own: false,
      tag: null,
      facts: ['1.240 de daño', '2 derribos', 'a 2 rivales', '1 reacción', 'en 2,5 s'],
    });
    expect(view.spells.map((s) => s.name)).toEqual(['Salpicón', 'Rayo en cadena']);
  });

  it('un golpe solo no dice cuánto duró, y la tuya dice "Tú"', () => {
    const view = highlightView(
      { ...BASE, wizardId: 1, hits: 1, knockouts: 1, targets: 1, reactions: 0 },
      false,
      NAMES,
    );
    expect(view.name).toBe('Tú');
    expect(view.own).toBe(true);
    expect(view.facts).toEqual(['1.240 de daño', '1 derribo']);
  });

  it('la de la partida dice en qué ronda fue y si la cerró', () => {
    expect(highlightView(BASE, true, NAMES).tag).toBe('Ronda 2');
    expect(highlightView({ ...BASE, decisive: true }, true, NAMES).tag).toBe('Cerró la ronda 2');
    expect(highlightView({ ...BASE, decisive: true }, false, NAMES).tag).toBe('Cerró la ronda');
  });
});
