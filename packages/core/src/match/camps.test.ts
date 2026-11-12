import { describe, expect, it } from 'vitest';
import type { GameRules } from '../rules';
import { TEST_RULES } from '../testing/rules.fixture';
import { damageBeast } from './beasts';
import { createMatch } from './createMatch';
import type { MatchState } from './state';
import { stepMatch } from './step';

/** Dos campamentos de dos bestias y un Guardián en el centro. */
const rules: GameRules = {
  ...TEST_RULES,
  map: {
    obstacles: [],
    camps: [
      { x: 8, z: 0, element: 'marea' },
      { x: -8, z: 0, element: 'marea' },
    ],
    guardianLair: { x: 0, z: 0 },
  },
  beasts: { ...TEST_RULES.beasts, packSize: 2 },
};

function match(): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: -12 } },
        { team: 1, spawn: { x: 0, z: 12 } },
      ],
    },
    rules,
  );
}

function wizardId(state: MatchState): number {
  return state.wizards[0]?.id ?? -1;
}

function idle(state: MatchState, ticks: number): void {
  for (let i = 0; i < ticks; i++) stepMatch(state, new Map(), rules);
}

describe('campamentos', () => {
  it('cada campamento empieza con su manada', () => {
    const state = match();
    expect(state.beasts).toHaveLength(4);
    expect(state.beasts.filter((b) => b.camp === 0)).toHaveLength(2);
    expect(state.beasts.every((b) => b.element === 'marea' && !b.guardian)).toBe(true);
  });

  it('un campamento vacío se vuelve a poblar después de un rato', () => {
    const state = match();
    for (const beast of state.beasts.filter((b) => b.camp === 0)) {
      damageBeast(state, beast, wizardId(state), beast.hp, rules);
    }
    idle(state, 2);
    expect(state.beasts.filter((b) => b.camp === 0)).toHaveLength(0);
    idle(state, rules.beasts.respawnTicks);
    expect(state.beasts.filter((b) => b.camp === 0)).toHaveLength(2);
  });

  it('el Guardián despierta a su hora y da Esencia de todos los elementos', () => {
    const state = match();
    idle(state, rules.beasts.guardian.spawnTick - 1);
    expect(state.beasts.some((b) => b.guardian)).toBe(false);
    idle(state, 2);
    const guardian = state.beasts.find((b) => b.guardian);
    expect(guardian?.maxHp).toBe(rules.beasts.guardian.maxHp);
    expect(guardian && Math.hypot(guardian.pos.x, guardian.pos.z)).toBeLessThan(0.5);
    if (!guardian) return;
    const killerId = wizardId(state);
    damageBeast(state, guardian, killerId, guardian.hp, rules);
    const killer = state.wizards.find((w) => w.id === killerId);
    expect(Object.values(killer?.essence ?? {}).every((n) => n === 1)).toBe(true);
    expect(state.events.some((e) => e.type === 'beastSlain' && e.guardian)).toBe(true);
    // No vuelve en la misma ronda.
    idle(state, rules.beasts.respawnTicks + 10);
    expect(state.beasts.some((b) => b.guardian)).toBe(false);
  });
});
