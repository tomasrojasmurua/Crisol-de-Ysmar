import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS, isElementId, neighborsOf, opposingOf } from './elements';

describe('pentágono elemental', () => {
  it('tiene exactamente cinco elementos', () => {
    expect(ELEMENT_IDS).toHaveLength(5);
  });

  it('cada elemento tiene dos vecinos y dos opuestos, sin repetirse ni incluirse', () => {
    for (const element of ELEMENT_IDS) {
      const related = new Set([element, ...neighborsOf(element), ...opposingOf(element)]);
      expect(related.size).toBe(5);
    }
  });

  it('la relación de vecindad es simétrica', () => {
    for (const element of ELEMENT_IDS) {
      for (const neighbor of neighborsOf(element)) {
        expect(neighborsOf(neighbor)).toContain(element);
      }
    }
  });

  it('Brasa choca con Marea y Raíz', () => {
    expect([...opposingOf('brasa')].sort()).toEqual(['marea', 'raiz']);
  });

  it('reconoce ids válidos', () => {
    expect(isElementId('umbra')).toBe(true);
    expect(isElementId('luz')).toBe(false);
    expect(isElementId(3)).toBe(false);
  });
});
