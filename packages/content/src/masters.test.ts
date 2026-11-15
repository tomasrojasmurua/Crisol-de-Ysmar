import { ELEMENT_IDS } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from './appearance';
import { MASTERS } from './masters';

describe('maestros', () => {
  it('hay uno por Linaje, con cara de un arquetipo del Vestidor', () => {
    expect(MASTERS.map((m) => m.element).sort()).toEqual([...ELEMENT_IDS].sort());
    const archetypes = new Set(ARCHETYPES.map((a) => a.id));
    for (const master of MASTERS) expect(archetypes.has(master.archetype)).toBe(true);
    expect(new Set(MASTERS.map((m) => m.archetype)).size).toBe(MASTERS.length);
  });

  it('tiene algo que decir en cada resultado, en frases cortas', () => {
    for (const { lines } of MASTERS) {
      const all = [
        lines.welcome,
        ...lines.win,
        ...lines.loss,
        ...lines.closeWin,
        ...lines.closeLoss,
        ...lines.draw,
      ];
      for (const group of [lines.win, lines.loss, lines.closeWin, lines.closeLoss, lines.draw])
        expect(group.length).toBeGreaterThan(0);
      for (const line of all) expect(line.length).toBeLessThanOrEqual(66);
    }
  });
});
