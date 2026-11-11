import { GAME_RULES } from '@crisol/content';
import { type Beast, createMatch, type MatchState, type Wizard } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { canLock, nextLockTarget } from './lockTargets';

const rules = GAME_RULES;
/** La cámara mira hacia +z: la derecha de la pantalla es -x. */
const FORWARD = { x: 0, z: 1 };

/** Tu mago (id 1) en el origen y un rival por cada posición, sin bestias. */
function arena(rivals: readonly { x: number; z: number }[]): { state: MatchState; me: Wizard } {
  const state = createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        ...rivals.map(() => ({ team: 1, spawn: { x: 0, z: 0 } })),
      ],
    },
    rules,
  );
  state.beasts.length = 0;
  // Las posiciones se ponen a mano: createMatch las acomoda fuera de los obstáculos.
  state.wizards.forEach((w, i) => {
    w.pos = i === 0 ? { x: 0, z: 0 } : (rivals[i - 1] ?? { x: 0, z: 0 });
  });
  const me = state.wizards[0];
  if (!me) throw new Error('falta tu mago');
  return { state, me };
}

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

describe('qué se puede fijar', () => {
  it('un rival más lejos que el alcance de fijado no se fija', () => {
    const far = rules.aim.lockRange + 2;
    const { state, me } = arena([{ x: 0, z: far }]);
    expect(canLock(state, me, rules, 2)).toBe(false);
  });

  it('una bestia domada por tu equipo no se fija', () => {
    const { state, me } = arena([{ x: 0, z: 8 }]);
    addBeast(state, 90, 3, 3, me.id);
    addBeast(state, 91, -3, 3);
    expect(canLock(state, me, rules, 90)).toBe(false);
    expect(canLock(state, me, rules, 91)).toBe(true);
  });
});

describe('botón de duelo', () => {
  it('sin duelo fija al mejor puesto, el mismo del disparo automático', () => {
    const { state, me } = arena([
      { x: 0, z: 6 },
      { x: 5, z: 12 },
    ]);
    expect(nextLockTarget(state, me, rules, FORWARD, null)).toBe(2);
  });

  it('en duelo pasa al siguiente de izquierda a derecha y vuelve al primero', () => {
    // Mirando a +z, la izquierda es +x: el 3 está a la izquierda, el 2 al centro, el 4 a la derecha.
    const { state, me } = arena([
      { x: 0, z: 8 },
      { x: 6, z: 8 },
      { x: -6, z: 8 },
    ]);
    expect(nextLockTarget(state, me, rules, FORWARD, 3)).toBe(2);
    expect(nextLockTarget(state, me, rules, FORWARD, 2)).toBe(4);
    expect(nextLockTarget(state, me, rules, FORWARD, 4)).toBe(3);
  });

  it('con un rival al alcance, las bestias no entran en la rueda', () => {
    const { state, me } = arena([{ x: 0, z: 8 }]);
    addBeast(state, 90, 2, 3);
    expect(nextLockTarget(state, me, rules, FORWARD, 2)).toBe(2);
  });

  it('sin rivales al alcance, pasa entre las bestias', () => {
    const { state, me } = arena([{ x: 0, z: 60 }]);
    addBeast(state, 90, 3, 4);
    addBeast(state, 91, -3, 4);
    const first = nextLockTarget(state, me, rules, FORWARD, null);
    expect([90, 91]).toContain(first);
    expect(nextLockTarget(state, me, rules, FORWARD, first)).not.toBe(first);
  });

  it('sin nada al alcance no fija nada', () => {
    const { state, me } = arena([{ x: 0, z: 60 }]);
    expect(nextLockTarget(state, me, rules, FORWARD, null)).toBeNull();
  });
});
