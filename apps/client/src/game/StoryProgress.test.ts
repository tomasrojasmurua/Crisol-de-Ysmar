import { STORY_CONTINUES, storyFor } from '@crisol/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryProgress } from './StoryProgress';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const beats = storyFor('marea');

/** Avanza hasta el combate de ese número. */
function goTo(run: StoryProgress, number: number): void {
  while (!(run.current?.kind === 'fight' && run.current.number === number)) run.advance();
}

describe('StoryProgress', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('empieza en el preludio y recuerda por dónde vas y lo que ya viste', () => {
    const run = new StoryProgress(beats);
    expect(run.current?.id).toBe('preludio');
    run.advance();
    const again = new StoryProgress(beats);
    expect(again.current?.id).toBe(beats[1]?.id);
    expect(again.wasSeen('preludio')).toBe(true);
  });

  it('al perder gasta continuaciones y, sin ninguna, vuelve al inicio del acto', () => {
    const run = new StoryProgress(beats);
    goTo(run, 6);
    for (let left = STORY_CONTINUES - 1; left >= 0; left--) {
      expect(run.lose()).toEqual({ kind: 'retry', left });
    }
    expect(run.lose()).toEqual({ kind: 'restart', act: 2 });
    expect(run.current?.act).toBe(2);
    expect(beats.find((b) => b.act === 2)?.id).toBe(run.current?.id);
    expect(run.continuesLeft).toBe(STORY_CONTINUES);
  });

  it('al cambiar de acto las continuaciones se llenan', () => {
    const run = new StoryProgress(beats);
    goTo(run, 4);
    run.lose();
    while (run.current?.act === 1) run.advance();
    expect(run.continuesLeft).toBe(STORY_CONTINUES);
  });

  it('al final de lo que hay queda terminada, y sigue si después llegan más pasos', () => {
    const run = new StoryProgress(beats);
    while (!run.finished) run.advance();
    expect(new StoryProgress(beats).finished).toBe(true);
    const longer = [...beats, { ...beats[0], id: 'acto-3' } as (typeof beats)[number]];
    expect(new StoryProgress(longer).current?.id).toBe('acto-3');
  });
});
