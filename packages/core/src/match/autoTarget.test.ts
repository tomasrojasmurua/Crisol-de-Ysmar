import { describe, expect, it } from 'vitest';
import { TEST_RULES } from '../testing/rules.fixture';
import { scene, wizard } from '../testing/spellScene';
import { autoTarget, resolveAim } from './queries';
import type { Beast, MatchState } from './state';

const rules = TEST_RULES;

function addBeast(
  state: MatchState,
  id: number,
  x: number,
  z: number,
  tamedBy: number | null = null,
) {
  const beast: Beast = {
    id,
    element: 'raiz',
    camp: 0,
    guardian: false,
    maxHp: 45,
    home: { x, z },
    pos: { x, z },
    facing: { x: 0, z: 1 },
    hp: 45,
    targetId: null,
    aggroTicks: 0,
    attackCooldown: 0,
    velocity: { x: 0, z: 0 },
    tamedBy,
    tamedTicks: tamedBy === null ? 0 : 100,
  };
  state.beasts.push(beast);
}

describe('apuntado automático', () => {
  it('con un campamento al lado y el rival lejos, dispara a la bestia', () => {
    const state = scene([{ x: 0, z: 40 }]);
    addBeast(state, 90, 3, 0);
    const me = wizard(state, 1);
    expect(autoTarget(state, me, rules)?.id).toBe(90);
    const aim = resolveAim(state, me, { x: 0, z: 0 }, rules);
    expect(aim.x).toBeCloseTo(1);
  });

  it('con un mago y una bestia a tiro, va al mago', () => {
    const state = scene([{ x: 0, z: 10 }]);
    addBeast(state, 90, 0, 2);
    expect(autoTarget(state, wizard(state, 1), rules)?.kind).toBe('wizard');
  });

  it('prefiere al rival de adelante si están parecidos', () => {
    // Mira a +z: el de adelante a 6 m gana al de atrás a 5 m.
    const state = scene([
      { x: 0, z: 6 },
      { x: 0, z: -5 },
    ]);
    const me = wizard(state, 1);
    me.facing = { x: 0, z: 1 };
    const ahead = state.wizards.find((w) => w.pos.z > 0);
    expect(autoTarget(state, me, rules)?.id).toBe(ahead?.id);
  });

  it('lo fijado a mano manda, pero se suelta si se aleja demasiado', () => {
    const state = scene([
      { x: 0, z: 4 },
      { x: 0, z: 12 },
    ]);
    const me = wizard(state, 1);
    const far = state.wizards.find((w) => w.pos.z === 12);
    if (!far) throw new Error('falta el rival');
    me.lockTarget = far.id;
    expect(autoTarget(state, me, rules)?.id).toBe(far.id);
    far.pos = { x: 0, z: 25 };
    expect(autoTarget(state, me, rules)?.id).not.toBe(far.id);
  });

  it('no dispara a una bestia domada por su equipo, y sin nada a tiro mira al frente', () => {
    const state = scene([{ x: 0, z: 40 }]);
    addBeast(state, 90, 2, 0, 1);
    const me = wizard(state, 1);
    expect(autoTarget(state, me, rules)).toBeNull();
    expect(resolveAim(state, me, { x: 0, z: 0 }, rules)).toEqual(me.facing);
  });
});
