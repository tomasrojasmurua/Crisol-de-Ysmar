import { describe, expect, it } from 'vitest';
import { createMatch } from '../match/createMatch';
import type { MatchState } from '../match/state';
import { stepMatch } from '../match/step';
import { TEST_RULES } from '../testing/rules.fixture';
import { SPELL_WEAVES } from './catalog';

const rules = TEST_RULES;

/** Tú en el origen y un rival a 9 m al frente. Lanzas un Meteoro con el alcance que digas. */
function meteorAt(reach: number | undefined, rivalX = 0): { x: number; z: number } | null {
  const state: MatchState = createMatch(
    {
      seed: 3,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: rivalX, z: 9 } },
      ],
    },
    rules,
  );
  const cast = {
    kind: 'cast' as const,
    dirX: 0,
    dirZ: 1,
    ...(reach === undefined ? {} : { reach }),
  };
  const weave = SPELL_WEAVES.meteor.map((element) => ({ kind: 'weave' as const, element }));
  stepMatch(state, new Map([[1, [...weave, cast]]]), rules);
  for (let i = 0; i < 40; i++) {
    stepMatch(state, new Map(), rules);
    const strike = state.spells.find((s) => s.kind === 'strike');
    if (strike && 'pos' in strike) return { x: strike.pos.x, z: strike.pos.z };
  }
  return null;
}

describe('elegir dónde cae un hechizo de suelo', () => {
  it('sin alcance cae como siempre: sobre el rival al frente', () => {
    expect(meteorAt(undefined)).toEqual({ x: 0, z: 9 });
  });

  it('con alcance 0 cae a tus pies', () => {
    expect(meteorAt(0)).toEqual({ x: 0, z: 0 });
  });

  it('con un alcance corto cae ahí, lejos del rival', () => {
    const range = rules.spells.meteor.range;
    expect(meteorAt(0.3)).toEqual({ x: 0, z: range * 0.3 });
  });

  it('si el punto elegido queda cerca del rival, cae justo sobre él', () => {
    const range = rules.spells.meteor.range;
    const reach = (9 - 1) / range;
    expect(meteorAt(reach, 1)).toEqual({ x: 1, z: 9 });
  });
});
