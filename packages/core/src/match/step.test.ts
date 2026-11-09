import { describe, expect, it } from 'vitest';
import type { Intent } from '../controllers/intent';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch } from './createMatch';
import type { MatchState, Wizard } from './state';
import { stepMatch } from './step';

const rules = TEST_RULES;

/** Dos magos frente a frente a lo largo del eje z, a `gap` metros. */
function duel(gap = 6): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'spectre',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: 0, z: gap } },
      ],
    },
    rules,
  );
}

function wizard(state: MatchState, id: number): Wizard {
  const found = state.wizards.find((w) => w.id === id);
  if (!found) throw new Error(`No existe el mago ${id}`);
  return found;
}

/** Ejecuta `ticks` pasos; el mago 1 recibe `first` en el primer paso. */
function run(state: MatchState, ticks: number, first: Intent[] = []): void {
  for (let i = 0; i < ticks; i++) {
    stepMatch(state, new Map([[1, i === 0 ? first : []]]), rules);
  }
}

/** Brasa: la Chispa, un dardo que daña y quema. */
const SPARK: Intent[] = [{ kind: 'weave', element: 'brasa' }];

const weaveAndCast = (...elements: Intent[]): Intent[] => [
  ...elements,
  { kind: 'cast', dirX: 0, dirZ: 1 },
];

describe('stepMatch', () => {
  it('un proyectil daña al rival', () => {
    const state = duel();
    run(state, 30, weaveAndCast(...SPARK));
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(90);
  });

  it('el apuntado automático se adelanta a un rival que se mueve', () => {
    const state = duel(9);
    for (let i = 0; i < 40; i++) {
      const own: Intent[] = i === 0 ? weaveAndCast(...SPARK) : [];
      // `weaveAndCast` apunta hacia +z; para probar el apuntado solo se lanza con (0, 0).
      const auto = own.map((intent) => (intent.kind === 'cast' ? { ...intent, dirZ: 0 } : intent));
      stepMatch(
        state,
        new Map([
          [1, auto],
          [2, [{ kind: 'move', x: 1, z: 0 }]],
        ]),
        rules,
      );
    }
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(90);
  });

  it('un elemento cansado no se puede volver a tejer', () => {
    const state = duel();
    run(state, 1, weaveAndCast({ kind: 'weave', element: 'brasa' }));
    expect(wizard(state, 1).fatigue.brasa).toBeGreaterThan(0);
    run(state, 1, [{ kind: 'weave', element: 'brasa' }]);
    expect(wizard(state, 1).weave).toEqual([]);
  });

  it('un tejido de tres elementos tarda más en salir', () => {
    const state = duel();
    run(
      state,
      1,
      weaveAndCast(
        { kind: 'weave', element: 'brasa' },
        { kind: 'weave', element: 'brasa' },
        { kind: 'weave', element: 'brasa' },
      ),
    );
    expect(wizard(state, 1).channel?.ticksLeft).toBe(17);
  });

  it('el Muro de hielo bloquea los proyectiles enemigos', () => {
    const state = duel(10);
    // El mago 2 levanta un Muro de hielo hacia el mago 1 y luego el mago 1 dispara.
    stepMatch(
      state,
      new Map([
        [
          2,
          [
            { kind: 'weave', element: 'marea' },
            { kind: 'weave', element: 'marea' },
            { kind: 'cast', dirX: 0, dirZ: -1 },
          ],
        ],
      ]),
      rules,
    );
    for (let i = 0; i < 12; i++) stepMatch(state, new Map(), rules);
    run(state, 40, weaveAndCast(...SPARK));
    expect(wizard(state, 2).hp).toBe(100);
  });

  it('Marea apaga la quemadura de Brasa', () => {
    const state = duel(2);
    wizard(state, 2).statuses.burn = { ticks: 60, sourceId: 1 };
    run(state, 5, weaveAndCast({ kind: 'weave', element: 'marea' }));
    expect(wizard(state, 2).statuses.burn).toBeUndefined();
    expect(wizard(state, 2).statuses.slow).toBeDefined();
  });

  it('declara ganador cuando cae el último rival', () => {
    const state = duel();
    wizard(state, 2).hp = 5;
    run(state, 30, weaveAndCast({ kind: 'weave', element: 'brasa' }));
    expect(state.winnerTeam).toBe(0);
  });

  it('el movimiento respeta el borde de la arena', () => {
    const state = duel();
    for (let i = 0; i < 200; i++) {
      stepMatch(state, new Map([[1, [{ kind: 'move', x: 0, z: -1 }]]]), rules);
    }
    expect(Math.hypot(wizard(state, 1).pos.x, wizard(state, 1).pos.z)).toBeLessThanOrEqual(16);
  });
});
