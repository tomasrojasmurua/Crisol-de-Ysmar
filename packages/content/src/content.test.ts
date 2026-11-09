import { ELEMENT_IDS } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { AFFINITY_RULES } from './affinity';
import { ELEMENTS } from './elements';
import { GAME_RULES } from './rules';

describe('tablas de contenido', () => {
  it('describe exactamente los cinco elementos del núcleo, en el mismo orden', () => {
    expect(ELEMENTS.map((element) => element.id)).toEqual([...ELEMENT_IDS]);
  });

  it('cada elemento tiene un color distinto', () => {
    const colors = new Set(ELEMENTS.map((element) => element.color.toLowerCase()));
    expect(colors.size).toBe(ELEMENTS.length);
  });

  it('la Afinidad acelera el elemento propio y frena los opuestos', () => {
    expect(AFFINITY_RULES.ownFatigueMultiplier).toBeLessThan(1);
    expect(AFFINITY_RULES.opposingFatigueMultiplier).toBeGreaterThan(1);
  });
});

describe('reglas de combate', () => {
  it('todos los números son finitos y no negativos', () => {
    const check = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value) && value >= 0, path).toBe(true);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) check(child, `${path}.${key}`);
      }
    };
    check(GAME_RULES, 'GAME_RULES');
  });

  it('un tejido más largo tarda más en salir', () => {
    const [one, two, three] = GAME_RULES.weave.castTicksByLength;
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
  });
});
