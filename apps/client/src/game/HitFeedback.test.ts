import type { GameEvent, MatchState } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { HitFeedback } from './HitFeedback';

const hit = (amount: number, targetId = 2, sourceId = 1): GameEvent => ({
  type: 'hit',
  targetId,
  sourceId,
  amount,
  form: 'projectile',
});

function state(statuses: Record<string, unknown> = {}): MatchState {
  return {
    wizards: [
      { id: 1, team: 0, statuses: {}, fallen: null },
      { id: 2, team: 1, statuses, fallen: null },
    ],
  } as unknown as MatchState;
}

describe('HitFeedback', () => {
  it('un golpe tuyo sale al tiro; el de otro o a ti, no', () => {
    const shown: number[] = [];
    const feedback = new HitFeedback({ damage: (a) => shown.push(a), status: () => {} });
    feedback.onStep([hit(12), hit(9, 2, 3), hit(8, 1, 2)], state(), 1);
    expect(shown).toEqual([12]);
  });

  it('el goteo de una quemadura se junta antes de mostrarse', () => {
    const shown: number[] = [];
    const feedback = new HitFeedback({ damage: (a) => shown.push(a), status: () => {} });
    for (let i = 0; i < 10; i++) feedback.onStep([hit(0.5)], state(), 1);
    expect(shown).toEqual([5]);
  });

  it('un estado nuevo en el rival se nombra una vez', () => {
    const words: string[] = [];
    const feedback = new HitFeedback({ damage: () => {}, status: (w) => words.push(w) });
    feedback.onStep([], state(), 1);
    feedback.onStep([], state({ root: {} }), 1);
    feedback.onStep([], state({ root: {} }), 1);
    expect(words).toEqual(['Atrapado']);
  });
});
