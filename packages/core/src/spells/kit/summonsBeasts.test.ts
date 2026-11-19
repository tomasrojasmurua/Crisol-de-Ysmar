import { describe, expect, it } from 'vitest';
import type { Intent } from '../../controllers/intent';
import type { ElementId } from '../../elements';
import { damageBeast } from '../../match/beasts';
import { createMatch } from '../../match/createMatch';
import type { MatchState, Summon } from '../../match/state';
import { stepMatch } from '../../match/step';
import type { GameRules } from '../../rules';
import { TEST_RULES } from '../../testing/rules.fixture';

/** Un campamento de una bestia junto al mago del sur; el rival, lejos al norte. */
const rules: GameRules = {
  ...TEST_RULES,
  map: { obstacles: [], camps: [{ x: 3, z: 0, element: 'marea' }], guardianLair: null },
};

function match(): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: 0, z: 30 } },
      ],
    },
    rules,
  );
}

const me = (state: MatchState) => {
  const wizard = state.wizards[0];
  if (!wizard) throw new Error('Falta el mago');
  return wizard;
};

const beast = (state: MatchState) => {
  const found = state.beasts[0];
  if (!found) throw new Error('Falta la bestia');
  return found;
};

/** Teje y lanza mirando hacia la bestia; luego deja correr `ticks` pasos. */
function castAndWait(state: MatchState, elements: ElementId[], ticks: number): void {
  const intents: Intent[] = [
    ...elements.map((element) => ({ kind: 'weave', element }) as const),
    { kind: 'cast', dirX: 1, dirZ: 0 },
  ];
  for (let i = 0; i < ticks; i++) {
    stepMatch(state, new Map([[me(state).id, i === 0 ? intents : []]]), rules);
  }
}

const ownSummon = (state: MatchState, kind: Summon['summon']) =>
  state.spells.find((s): s is Summon => s.kind === 'summon' && s.summon === kind);

describe('invocaciones y bestias', () => {
  it('el Guardián de musgo golpea a la bestia que persigue a su dueño y se la lleva', () => {
    const state = match();
    damageBeast(state, beast(state), me(state).id, 1, rules);
    castAndWait(state, ['raiz', 'marea'], 60);
    const guardian = ownSummon(state, 'mossGuardian');
    expect(guardian).toBeDefined();
    expect(beast(state).targetId).toBe(guardian?.id);
    expect(beast(state).hp).toBeLessThan(beast(state).maxHp - 1);
  });

  it('la bestia que persigue al Guardián lo muerde a él y no al mago', () => {
    const state = match();
    damageBeast(state, beast(state), me(state).id, 1, rules);
    castAndWait(state, ['raiz', 'marea'], 150);
    const guardian = ownSummon(state, 'mossGuardian');
    expect(guardian && guardian.hp < guardian.maxHp).toBe(true);
  });

  it('el Pararrayos le da a la bestia enojada con su dueño', () => {
    const state = match();
    damageBeast(state, beast(state), me(state).id, 1, rules);
    castAndWait(state, ['tormenta', 'raiz'], 40);
    expect(beast(state).hp).toBeLessThan(beast(state).maxHp - 1);
  });

  it('una bestia tranquila no es blanco de las invocaciones', () => {
    const state = match();
    castAndWait(state, ['tormenta', 'raiz'], 90);
    expect(beast(state).hp).toBe(beast(state).maxHp);
    expect(beast(state).targetId).toBeNull();
  });

  it('si la invocación la mata, la Esencia es para su dueño', () => {
    const state = match();
    const target = beast(state);
    damageBeast(state, target, me(state).id, target.hp - 1, rules);
    castAndWait(state, ['raiz', 'marea'], 90);
    expect(state.beasts).toHaveLength(0);
    expect(me(state).essence.marea).toBe(1);
  });
});
