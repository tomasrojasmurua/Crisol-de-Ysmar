import { ELEMENT_IDS, neighborsOf, opposingOf } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { storyFor } from './story';

describe('Historia', () => {
  it('cada Linaje tiene los combates 1 a 9 en orden, cada uno con su escena antes', () => {
    for (const school of ELEMENT_IDS) {
      const beats = storyFor(school);
      const fights = beats.filter((b) => b.kind === 'fight');
      expect(fights.map((f) => f.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      beats.forEach((beat, i) => {
        if (beat.kind === 'fight') expect(beats[i - 1]?.kind).toBe('scene');
      });
      // Los ids no se repiten: el progreso guardado cuelga de ellos.
      expect(new Set(beats.map((b) => b.id)).size).toBe(beats.length);
    }
  });

  it('no deja marcas del guion sin cambiar ni líneas vacías', () => {
    for (const school of ELEMENT_IDS) {
      for (const beat of storyFor(school)) {
        if (beat.kind !== 'scene') continue;
        for (const line of beat.lines) {
          expect(line.text.trim().length).toBeGreaterThan(0);
          expect(line.text).not.toMatch(/[{}[\]]/);
          if (line.style === 'say') expect(line.who).toBeTruthy();
        }
      }
    }
  });

  it('los maestros del acto 2 son tus vecinos y tus opuestos, y nunca el tuyo', () => {
    for (const school of ELEMENT_IDS) {
      const masters = storyFor(school)
        .filter((b) => b.kind === 'fight' && b.act === 2 && b.number !== 7)
        .flatMap((b) => (b.kind === 'fight' ? b.foes.filter((s) => s.master) : []))
        .map((s) => s.school);
      const [a1, a2] = neighborsOf(school);
      const [r1, r2] = opposingOf(school);
      expect(masters).toEqual([a1, r1, a2, r2]);
    }
  });

  it('el aprendiz que vuelve es de tu primer Linaje rival y pelea a tu lado en el 9', () => {
    for (const school of ELEMENT_IDS) {
      const beats = storyFor(school);
      const first = beats.find((b) => b.kind === 'fight' && b.number === 1);
      const ninth = beats.find((b) => b.kind === 'fight' && b.number === 9);
      if (first?.kind !== 'fight' || ninth?.kind !== 'fight') throw new Error('Faltan combates');
      expect(first.foes[0]?.school).toBe(opposingOf(school)[0]);
      expect(ninth.allies[0]?.name).toBe(first.foes[0]?.name);
    }
  });
});
