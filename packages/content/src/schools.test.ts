import { ELEMENT_IDS, SPELL_WEAVES } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { COMBOS } from './combos';
import { SCHOOLS, schoolSpellbook } from './schools';

describe('escuelas', () => {
  it('hay una por elemento, con 4 hechizos distintos y un papel para cada uno', () => {
    expect(SCHOOLS.map((s) => s.element).sort()).toEqual([...ELEMENT_IDS].sort());
    for (const school of SCHOOLS) {
      expect(new Set(school.spells).size).toBe(4);
      for (const spell of school.spells) expect(school.roles[spell]).toBeTruthy();
    }
  });

  it('cada una trae al menos un hechizo que empieza con su elemento', () => {
    for (const school of SCHOOLS) {
      expect(school.spells.some((s) => SPELL_WEAVES[s][0] === school.element)).toBe(true);
    }
  });

  it('su combo se hace solo con su set y Paso', () => {
    for (const school of SCHOOLS) {
      const combo = COMBOS.find((c) => c.id === school.combo);
      expect(combo).toBeDefined();
      const book = schoolSpellbook(school.element);
      for (const step of combo?.steps ?? []) {
        if ('spell' in step) expect(book).toContain(step.spell);
        else if ('element' in step) {
          expect(book.some((s) => SPELL_WEAVES[s][0] === step.element)).toBe(true);
        }
      }
    }
  });
});
