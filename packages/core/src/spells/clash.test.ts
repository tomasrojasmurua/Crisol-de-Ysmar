import { describe, expect, it } from 'vitest';
import type { ElementId } from '../elements';
import type { MatchState, Projectile } from '../match/state';
import type { Vec2 } from '../math/vec2';
import { TEST_RULES } from '../testing/rules.fixture';
import { scene, wizard } from '../testing/spellScene';
import { castSpell } from './cast';
import type { SpellId } from './catalog';
import { resolveClashes } from './clash';

const rules = TEST_RULES;

/** Un proyectil quieto de un equipo, con su tejido y 30 de daño. */
function projectile(
  state: MatchState,
  id: number,
  team: number,
  weave: ElementId[],
  pos: Vec2,
): Projectile {
  const p: Projectile = {
    kind: 'projectile',
    id,
    ownerId: team === 0 ? 1 : 2,
    team,
    pos,
    velocity: { x: 0, z: team === 0 ? 10 : -10 },
    deflected: false,
    radius: 0.25,
    travelled: 0,
    maxRange: 14,
    payload: {
      form: 'projectile',
      weave,
      damage: 30,
      statuses: [],
      spell: 'spark' as SpellId,
      blastRadius: 0,
      pierce: false,
    },
    trait: null,
  };
  state.spells.push(p);
  return p;
}

const flying = (state: MatchState): Projectile[] =>
  state.spells.filter((s): s is Projectile => s.kind === 'projectile');

describe('choque de tejidos entre proyectiles', () => {
  it('opuestos del mismo largo se deshacen los dos', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 0, ['marea', 'brasa', 'umbra'], { x: 0, z: 4 });
    projectile(state, 101, 1, ['brasa', 'umbra', 'marea'], { x: 0.3, z: 4.4 });
    const gone = resolveClashes(state, rules);
    expect([...gone].sort()).toEqual([100, 101]);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'clash', survivorId: null }),
    );
  });

  it('el de más elementos sigue, con el daño rebajado en la proporción del débil', () => {
    const state = scene([{ x: 0, z: 10 }]);
    const acid = projectile(state, 100, 0, ['marea', 'brasa', 'umbra'], { x: 0, z: 4 });
    projectile(state, 101, 1, ['brasa'], { x: 0, z: 4.5 });
    const gone = resolveClashes(state, rules);
    expect([...gone]).toEqual([101]);
    expect(acid.payload.damage).toBeCloseTo(30 * (1 - 1 / 3));
    expect(acid.power).toBeCloseTo(2 / 3);
  });

  it('iguales o vecinos se cruzan sin chocar', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 0, ['brasa'], { x: 0, z: 4 });
    projectile(state, 101, 1, ['brasa', 'brasa'], { x: 0, z: 4.2 });
    projectile(state, 102, 1, ['tormenta'], { x: 0, z: 4.1 });
    expect(resolveClashes(state, rules).size).toBe(0);
  });

  it('del mismo equipo no chocan', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 0, ['brasa'], { x: 0, z: 4 });
    projectile(state, 101, 0, ['marea', 'brasa', 'umbra'], { x: 0, z: 4.2 });
    expect(resolveClashes(state, rules).size).toBe(0);
  });

  it('lejos, aunque sean opuestos, no chocan', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 0, ['brasa'], { x: 0, z: 2 });
    projectile(state, 101, 1, ['marea', 'brasa', 'umbra'], { x: 0, z: 6 });
    expect(resolveClashes(state, rules).size).toBe(0);
  });
});

describe('choque de tejidos con el área de un hechizo', () => {
  it('un Salpicón hacia una Chispa que viene la deshace', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 1, ['brasa'], { x: 0, z: 2 });
    castSpell(state, wizard(state, 1), 'splash', ['marea'], { x: 0, z: 1 }, rules);
    expect(flying(state)).toHaveLength(0);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'clash', elements: ['marea', 'brasa'], survivorId: null }),
    );
  });

  it('un Salpicón contra una Bola de fuego solo la debilita a la mitad', () => {
    const state = scene([{ x: 0, z: 10 }]);
    const fireball = projectile(state, 100, 1, ['brasa', 'brasa'], { x: 0, z: 2 });
    castSpell(state, wizard(state, 1), 'splash', ['marea'], { x: 0, z: 1 }, rules);
    expect(flying(state)).toHaveLength(1);
    expect(fireball.payload.damage).toBeCloseTo(15);
  });

  it('un Salpicón hacia otro lado no la toca', () => {
    const state = scene([{ x: 0, z: 10 }]);
    projectile(state, 100, 1, ['brasa'], { x: 0, z: 2 });
    castSpell(state, wizard(state, 1), 'splash', ['marea'], { x: 0, z: -1 }, rules);
    expect(flying(state)).toHaveLength(1);
  });
});
