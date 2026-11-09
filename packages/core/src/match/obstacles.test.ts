import { describe, expect, it } from 'vitest';
import { BotController } from '../ai/bot';
import { findPath, Navigator } from '../ai/navigation';
import { distance } from '../math/vec2';
import type { GameRules, Obstacle } from '../rules';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch } from './createMatch';
import { lineBlocked } from './obstacles';
import type { MatchState } from './state';
import { stepMatch } from './step';

/** Una hilera de rocas entre los dos magos, con paso solo por los extremos. */
const wall: Obstacle[] = [-4, -2, 0, 2, 4].map((x) => ({ x, z: 0, radius: 1.1, kind: 'rock' }));
const rules: GameRules = { ...TEST_RULES, map: { obstacles: wall, camps: [], guardianLair: null } };

function duel(): MatchState {
  return createMatch(
    {
      seed: 5,
      deathRule: 'spectre',
      wizards: [
        { team: 0, spawn: { x: 0, z: -5 } },
        { team: 1, spawn: { x: 0, z: 5 } },
      ],
    },
    rules,
  );
}

describe('obstáculos', () => {
  it('frenan al mago, que se desliza por el costado', () => {
    const state = duel();
    for (let i = 0; i < 60; i++) {
      stepMatch(state, new Map([[1, [{ kind: 'move', x: 0, z: 1 }]]]), rules);
    }
    const mage = state.wizards[0];
    expect(mage?.pos.z ?? 0).toBeLessThan(0);
    for (const o of wall) {
      expect(distance(mage?.pos ?? { x: 0, z: 0 }, o)).toBeGreaterThanOrEqual(
        o.radius + rules.wizard.radius - 1e-6,
      );
    }
  });

  it('detienen los proyectiles', () => {
    const state = duel();
    stepMatch(
      state,
      new Map([
        [
          1,
          [
            { kind: 'weave', element: 'brasa' },
            { kind: 'cast', dirX: 0, dirZ: 1 },
          ],
        ],
      ]),
      rules,
    );
    let blocked = false;
    for (let i = 0; i < 60; i++) {
      stepMatch(state, new Map(), rules);
      if (state.events.some((e) => e.type === 'blocked')) blocked = true;
    }
    expect(blocked).toBe(true);
    expect(state.wizards[1]?.hp).toBe(rules.wizard.maxHp);
  });

  it('el camino rodea la hilera y cada tramo queda libre', () => {
    const path = findPath({ x: 0, z: -5 }, { x: 0, z: 5 }, rules);
    expect(path.length).toBeGreaterThan(2);
    const nav = new Navigator(rules);
    const first = nav.directionTo({ x: 0, z: -5 }, { x: 0, z: 5 });
    expect(Math.abs(first.x)).toBeGreaterThan(0.3);
    expect(lineBlocked({ x: 0, z: -5 }, { x: 0, z: 5 }, wall)).toBe(true);
  });

  it('dos bots se encuentran rodeando las rocas y la ronda termina', () => {
    const state = duel();
    const bots = new Map(state.wizards.map((w) => [w.id, new BotController(w.id * 7, rules)]));
    for (let i = 0; i < rules.round.durationTicks && state.winnerTeam === null; i++) {
      const intents = new Map(
        state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
      );
      stepMatch(state, intents, rules);
    }
    expect(state.winnerTeam).not.toBeNull();
    const damaged = state.wizards.some((w) => w.hp < w.maxHp);
    expect(damaged).toBe(true);
  });
});
