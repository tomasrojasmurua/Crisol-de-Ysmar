import { storyFor } from '@crisol/content';
import { ELEMENT_IDS } from '@crisol/core';
import { describe, expect, it } from 'vitest';

/** Los nombres (sin extensión) de los webp que hay en una carpeta de `public/historia`. */
function namesIn(files: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(files).map((path) => path.replace(/^.*\//, '').replace('.webp', '')));
}

const backdrops = namesIn(import.meta.glob('../../public/historia/escenas/*.webp'));
const portraits = namesIn(import.meta.glob('../../public/historia/retratos/*.webp'));

describe('Arte de la Historia', () => {
  it('cada ilustración y cada retrato que pide el guion existe, para los cinco Linajes', () => {
    for (const school of ELEMENT_IDS) {
      for (const beat of storyFor(school)) {
        if (beat.kind !== 'scene') continue;
        for (const line of beat.lines) {
          if (line.backdrop)
            expect(backdrops, `${school}: ${line.backdrop}`).toContain(line.backdrop);
          if (line.portrait)
            expect(portraits, `${school}: ${line.portrait}`).toContain(line.portrait);
        }
      }
    }
  });
});
