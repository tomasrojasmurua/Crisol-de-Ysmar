import { describe, expect, it } from 'vitest';
import { COMBOS } from './combos';
import { REACTION_TEXT } from './reactions';

describe('catálogo de combos', () => {
  it('tiene los 76 combos acordados, cada uno con su id', () => {
    expect(COMBOS).toHaveLength(76);
    expect(new Set(COMBOS.map((c) => c.id)).size).toBe(COMBOS.length);
    expect(new Set(COMBOS.map((c) => c.name)).size).toBe(COMBOS.length);
  });

  it('incluye cada reacción del juego una vez, con su mismo nombre', () => {
    const reactions = COMBOS.filter((c) => c.reaction);
    expect(reactions.map((c) => c.reaction).sort()).toEqual(Object.keys(REACTION_TEXT).sort());
    for (const combo of reactions) {
      expect(combo.name).toBe(REACTION_TEXT[combo.reaction ?? 'mire'].name);
    }
  });

  it('el tutorial entrega 3 combos que entre todos usan los 5 elementos', () => {
    const tutorial = COMBOS.filter((c) => c.tutorial).map((c) => c.id);
    expect(tutorial.sort()).toEqual(['amarre', 'brasa-maldita', 'quiebre']);
  });

  it('cada combo tiene de 1 a 3 pasos y un texto', () => {
    for (const combo of COMBOS) {
      expect(combo.steps.length).toBeGreaterThanOrEqual(1);
      expect(combo.steps.length).toBeLessThanOrEqual(3);
      expect(combo.detail.length).toBeGreaterThan(10);
    }
  });

  it('marca los que faltan por confirmar con la simulación', () => {
    expect(COMBOS.filter((c) => c.unverified)).toHaveLength(10);
  });
});
