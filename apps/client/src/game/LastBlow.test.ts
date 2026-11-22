import type { GameEvent } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { LastBlow } from './LastBlow';

const ME = 1;
const RIVAL = 2;
const ALLY = 3;
const rival = (id: number): boolean => id === RIVAL;

const release = (wizardId: number, spell: string, form: string): GameEvent =>
  ({ type: 'release', wizardId, spell, form }) as GameEvent;
const hit = (sourceId: number, form: string): GameEvent =>
  ({ type: 'hit', targetId: ME, sourceId, amount: 10, form }) as GameEvent;
const defeated: GameEvent = { type: 'defeated', wizardId: ME };

describe('LastBlow', () => {
  it('toma el último hechizo del rival de la misma familia que el golpe', () => {
    const blow = new LastBlow(ME);
    blow.onStep([release(RIVAL, 'spark', 'projectile')], 10, rival);
    blow.onStep([release(RIVAL, 'curse', 'mark')], 20, rival);
    blow.onStep([hit(RIVAL, 'projectile'), defeated], 40, rival);
    expect(blow.spell).toBe('spark');
  });

  it('sin uno de esa familia, se queda con el último que lanzó', () => {
    const blow = new LastBlow(ME);
    blow.onStep([release(RIVAL, 'curse', 'mark')], 20, rival);
    blow.onStep([hit(RIVAL, 'projectile'), defeated], 40, rival);
    expect(blow.spell).toBe('curse');
  });

  it('no cuenta la zona, las bestias, a los aliados ni lo lanzado hace mucho', () => {
    const blow = new LastBlow(ME);
    blow.onStep([release(RIVAL, 'spark', 'projectile')], 0, rival);
    blow.onStep([release(ALLY, 'spark', 'projectile')], 0, rival);
    blow.onStep([hit(ME, 'zone'), defeated], 10, rival);
    blow.onStep([hit(RIVAL, 'beast'), defeated], 11, rival);
    blow.onStep([hit(ALLY, 'projectile'), defeated], 12, rival);
    blow.onStep([hit(RIVAL, 'projectile'), defeated], 1000, rival);
    expect(blow.spell).toBeNull();
  });

  it('recuerda la última caída de la partida y se borra al empezar otra', () => {
    const blow = new LastBlow(ME);
    blow.onStep(
      [release(RIVAL, 'spark', 'projectile'), hit(RIVAL, 'projectile'), defeated],
      5,
      rival,
    );
    blow.onStep([release(RIVAL, 'tide', 'wall'), hit(RIVAL, 'wall'), defeated], 50, rival);
    expect(blow.spell).toBe('tide');
    blow.reset();
    expect(blow.spell).toBeNull();
  });
});
