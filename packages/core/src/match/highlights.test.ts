import { describe, expect, it } from 'vitest';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch } from './createMatch';
import {
  createHighlightTracker,
  finishHighlightRound,
  type HighlightRules,
  recordHighlights,
} from './highlights';
import type { GameEvent, MatchState } from './state';

const RULES: HighlightRules = {
  gapTicks: 60,
  minHit: 1,
  maxTicks: 150,
  leadTicks: 45,
  damage: 1,
  knockout: 60,
  extraTarget: 20,
  reaction: 12,
  decisive: 25,
  maxSpells: 4,
};

/** Cuatro magos: 1 y 2 aliados, 3 y 4 rivales. */
function quartet(): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 0, spawn: { x: 2, z: 0 } },
        { team: 1, spawn: { x: 0, z: 6 } },
        { team: 1, spawn: { x: 2, z: 6 } },
      ],
    },
    TEST_RULES,
  );
}

/** Corre un paso con estos avisos en el paso `tick`. */
function step(
  tracker: ReturnType<typeof createHighlightTracker>,
  state: MatchState,
  tick: number,
  events: GameEvent[],
): void {
  state.tick = tick;
  state.events = events;
  recordHighlights(tracker, state);
}

const hit = (sourceId: number, targetId: number, amount: number): GameEvent => ({
  type: 'hit',
  sourceId,
  targetId,
  amount,
  form: 'projectile',
});

describe('mejor jugada', () => {
  it('junta los golpes seguidos de un mago en una jugada, con sus hechizos', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [
      { type: 'release', wizardId: 1, form: 'projectile', spell: 'spark' },
    ]);
    step(tracker, state, 20, [hit(1, 3, 30)]);
    step(tracker, state, 40, [
      { type: 'release', wizardId: 1, form: 'projectile', spell: 'step' },
      hit(1, 4, 25),
    ]);
    step(tracker, state, 70, [hit(1, 3, 20), { type: 'defeated', wizardId: 3 }]);
    // Lo que lanza después del último golpe no es parte de la jugada.
    step(tracker, state, 80, [
      { type: 'release', wizardId: 1, form: 'projectile', spell: 'spark' },
    ]);
    const best = finishHighlightRound(tracker);
    expect(best).toMatchObject({
      wizardId: 1,
      round: 1,
      damage: 75,
      hits: 3,
      knockouts: 1,
      targets: 2,
      spells: ['spark', 'step'],
      ticks: 50,
      endTick: 70,
      decisive: false,
      score: 75 + 60 + 20,
    });
  });

  it('el daño que gotea suma a la jugada pero no la alarga', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [hit(1, 3, 30)]);
    step(tracker, state, 40, [hit(1, 3, 0.5)]);
    step(tracker, state, 65, [hit(1, 3, 0.5)]);
    // Ya cerró a los 2 s del golpe: esta quemadura no abre otra.
    step(tracker, state, 80, [hit(1, 3, 0.5)]);
    expect(finishHighlightRound(tracker)).toMatchObject({ damage: 31, hits: 1, ticks: 0 });
  });

  it('muestra los últimos hechizos de la jugada', () => {
    const state = quartet();
    const tracker = createHighlightTracker({ ...RULES, maxSpells: 2 });
    step(tracker, state, 10, [hit(1, 3, 10)]);
    for (const [tick, spell] of [
      [20, 'spark'],
      [30, 'step'],
      [40, 'fireball'],
    ] as const) {
      step(tracker, state, tick, [{ type: 'release', wizardId: 1, form: 'projectile', spell }]);
    }
    step(tracker, state, 50, [hit(1, 3, 10)]);
    expect(finishHighlightRound(tracker)?.spells).toEqual(['step', 'fireball']);
  });

  it('un asedio largo se parte en ráfagas de a lo más 5 s', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    for (let tick = 0; tick <= 300; tick += 30) step(tracker, state, tick, [hit(1, 3, 10)]);
    // 0…150 es una (6 golpes); 180…300 otra (5 golpes).
    expect(finishHighlightRound(tracker)).toMatchObject({ damage: 60, hits: 6, ticks: 150 });
  });

  it('una pausa larga corta la jugada en dos', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [hit(1, 3, 30)]);
    step(tracker, state, 100, [hit(1, 3, 40)]);
    expect(finishHighlightRound(tracker)?.damage).toBe(40);
  });

  it('no cuenta golpes a aliados ni a sí mismo', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [hit(1, 2, 90), hit(1, 1, 90)]);
    expect(finishHighlightRound(tracker)).toBeNull();
  });

  it('el derribo que cierra la ronda pesa más, y en empate gana la primera', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [hit(3, 1, 50)]);
    step(tracker, state, 20, [hit(4, 2, 50)]);
    state.winnerTeam = 0;
    step(tracker, state, 200, [hit(2, 4, 10), { type: 'defeated', wizardId: 4 }]);
    const round = finishHighlightRound(tracker);
    expect(round).toMatchObject({ wizardId: 2, decisive: true, score: 10 + 60 + 25 });
    // Los dos golpes de 50 empatan: la de la partida sigue siendo la mejor de todas.
    expect(tracker.matchBest?.wizardId).toBe(2);
  });

  it('la mejor de la partida sale de todas las rondas', () => {
    const state = quartet();
    const tracker = createHighlightTracker(RULES);
    step(tracker, state, 10, [hit(1, 3, 120)]);
    expect(finishHighlightRound(tracker)?.round).toBe(1);
    step(tracker, state, 10, [hit(3, 1, 40)]);
    expect(finishHighlightRound(tracker)).toMatchObject({ wizardId: 3, round: 2 });
    expect(tracker.matchBest).toMatchObject({ wizardId: 1, round: 1, damage: 120 });
  });
});
