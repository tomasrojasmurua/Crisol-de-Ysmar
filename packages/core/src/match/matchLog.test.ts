import { describe, expect, it } from 'vitest';
import { createLogRound, recordLogRound } from './matchLog';
import type { MatchState } from './state';

describe('registro de una ronda', () => {
  it('anota lanzamientos, golpes, atajadas, reacciones y caídas con su paso', () => {
    const round = createLogRound();
    const state = {
      tick: 120,
      winnerTeam: null,
      events: [
        { type: 'release', wizardId: 1, form: 'projectile', spell: 'fireball' },
        { type: 'hit', sourceId: 1, targetId: 2, amount: 7.25, form: 'projectile' },
        { type: 'hit', sourceId: 2, targetId: 2, amount: 2, form: 'zone' },
        { type: 'attacked', sourceId: 2, targetId: 1 },
        { type: 'combo', combo: 'steam', sourceId: 1, targetId: 2 },
        { type: 'defeated', wizardId: 2 },
      ],
    } as unknown as MatchState;
    recordLogRound(round, state);
    expect(round).toEqual({
      ticks: 120,
      winnerTeam: null,
      casts: [[120, 1, 'fireball']],
      hits: [
        [120, 1, 2, 7.3],
        [120, 0, 2, 2],
      ],
      blocked: [[120, 2, 1]],
      combos: [[120, 1, 2, 'steam']],
      falls: [[120, 2]],
    });
  });
});
