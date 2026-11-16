import { ELEMENT_IDS, opposingOf } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { OMENS } from './glyphs';
import { linajePath, PATH_LENGTH } from './path';

describe('Camino del Linaje', () => {
  it('tiene diez pasos con id fijo para cada Linaje, y el último es contra tu maestro', () => {
    for (const school of ELEMENT_IDS) {
      const path = linajePath(school);
      expect(path).toHaveLength(PATH_LENGTH);
      expect(path.map((s) => s.id)).toEqual(path.map((_, i) => `paso-${i + 1}`));
      expect(path.at(-1)?.master).toBe(true);
      expect(path.filter((s) => s.master)).toHaveLength(1);
      for (const step of path) expect(step.line.length).toBeGreaterThan(0);
    }
  });

  it('los rivales y Presagios son de tus Linajes rivales, y los elementos permitidos tuyos', () => {
    for (const school of ELEMENT_IDS) {
      const rivals = opposingOf(school);
      for (const step of linajePath(school)) {
        if (step.rivalSchool) expect(rivals).toContain(step.rivalSchool);
        if (step.omenId) {
          const omen = OMENS.find((o) => o.id === step.omenId);
          expect(omen && rivals.includes(omen.element as never)).toBe(true);
        }
        if (step.elements) {
          expect(step.elements).toContain(school);
          for (const rival of rivals) expect(step.elements).not.toContain(rival);
        }
      }
    }
  });
});
