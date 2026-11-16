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
        lines.challenge,
        ...lines.win,
        ...lines.loss,
        ...lines.closeWin,
        ...lines.closeLoss,
        ...lines.draw,
      ];
      for (const group of [lines.win, lines.loss, lines.closeWin, lines.closeLoss, lines.draw])
        expect(group.length).toBeGreaterThan(0);
      for (const line of all) expect(line.length).toBeLessThanOrEqual(66);
      // En el menú hay más ancho: una línea bajo el logo.
      expect(lines.camp.length).toBeGreaterThanOrEqual(3);
      for (const line of lines.camp) expect(line.length).toBeLessThanOrEqual(64);
    }
  });
});

describe('lore de los hechizos', () => {
  it('cada uno de los 155 hechizos tiene su nota, en una línea corta', async () => {
    const { SPELL_LORE } = await import('./spellLore');
    const { SPELL_WEAVES } = await import('@crisol/core');
    for (const spell of Object.keys(SPELL_WEAVES))
      expect(SPELL_LORE[spell as keyof typeof SPELL_LORE]).toBeTruthy();
    for (const line of Object.values(SPELL_LORE)) expect(line.length).toBeLessThanOrEqual(100);
  });
});
