import { ELEMENT_IDS } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { AFFINITY_RULES } from './affinity';
import { ELEMENTS } from './elements';

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
