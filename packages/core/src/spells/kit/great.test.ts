import { describe, expect, it } from 'vitest';
import type { Intent } from '../../controllers/intent';
import { stepMatch } from '../../match/step';
import type { GameRules } from '../../rules';
import { TEST_RULES } from '../../testing/rules.fixture';
import { cast, run, scene, wizard } from '../../testing/spellScene';

const rules = TEST_RULES;
/** Pasos hasta que sale un Gran hechizo (0,6 s de canalización). */
const CHANNEL = 18;
const spells = rules.spells;

function moving(id: number, x: number, z: number): Map<number, Intent[]> {
  return new Map([[id, [{ kind: 'move', x, z }]]]);
}

describe('Grandes hechizos de Brasa', () => {
  it('el Meteoro cae tras el aviso, pega fuerte y deja el cráter ardiendo', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + spells.meteor.delayTicks + 1, cast(['brasa', 'brasa', 'brasa']));
    const rival = wizard(state, 2);
    expect(rival.hp).toBeLessThanOrEqual(rival.maxHp - spells.meteor.damage);
    expect(state.spells.some((s) => s.kind === 'zone' && s.effect === 'burn')).toBe(true);
  });

  it('el Meteoro se esquiva saliendo del círculo durante el aviso', () => {
    const state = scene([{ x: 0, z: 8 }]);
    const ticks = CHANNEL + spells.meteor.delayTicks + 1;
    run(state, ticks, cast(['brasa', 'brasa', 'brasa']), rules, moving(2, 1, 0));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp);
  });

  it('la Lluvia de fuego quema a quien se mueve y perdona a quien se queda quieto', () => {
    const state = scene([
      { x: 0, z: 6 },
      { x: -6, z: 0 },
    ]);
    run(state, CHANNEL + 40, cast(['brasa', 'brasa', 'tormenta']), rules, moving(2, 1, 0));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    expect(wizard(state, 3).hp).toBe(wizard(state, 3).maxHp);
  });

  it('la Llama negra atraviesa un árbol y un escudo', () => {
    const forest: GameRules = {
      ...rules,
      map: { ...rules.map, obstacles: [{ x: 0, z: 4, radius: 1, kind: 'tree' }] },
    };
    const state = scene([{ x: 0, z: 8 }], forest);
    wizard(state, 2).shield = 40;
    run(state, CHANNEL + 30, cast(['brasa', 'umbra', 'marea']), forest);
    const rival = wizard(state, 2);
    expect(rival.hp).toBe(rival.maxHp - spells.blackFlame.damage);
    expect(rival.shield).toBe(40);
  });

  it('el Paso de ascuas te lleva al suelo que arde y falla si no hay ninguno', () => {
    const state = scene([{ x: 12, z: -12 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'umbra', 'tormenta']));
    expect(wizard(state, 1).pos).toEqual({ x: 0, z: 0 });
    state.spells.push({
      kind: 'zone',
      id: 999,
      ownerId: 1,
      team: 0,
      pos: { x: 0, z: 10 },
      radius: 1,
      effect: 'burn',
      durationTicks: 300,
      ticksLeft: 300,
    });
    wizard(state, 1).fatigue = { brasa: 0, tormenta: 0, marea: 0, raiz: 0, umbra: 0 };
    run(state, CHANNEL + 1, cast(['brasa', 'umbra', 'tormenta']));
    expect(wizard(state, 1).pos.z).toBeGreaterThan(8);
  });

  it('el Cometa negro te lleva junto al rival y lo silencia', () => {
    const state = scene([{ x: 0, z: 9 }]);
    run(state, CHANNEL + 15, cast(['brasa', 'tormenta', 'umbra']));
    const self = wizard(state, 1);
    const rival = wizard(state, 2);
    expect(Math.hypot(self.pos.x - rival.pos.x, self.pos.z - rival.pos.z)).toBeLessThan(2);
    expect(rival.statuses.silenced).toBeDefined();
  });
});

describe('Grandes hechizos de Tormenta', () => {
  it('la Lanza del cielo cae en toda la línea y no a los costados', () => {
    const state = scene([
      { x: 0, z: 12 },
      { x: 4, z: 6 },
    ]);
    run(state, CHANNEL + spells.skySpear.delayTicks + 1, cast(['tormenta', 'tormenta', 'brasa']));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - spells.skySpear.damage);
    expect(wizard(state, 3).hp).toBe(wizard(state, 3).maxHp);
  });

  it('la Tempestad da tres destellos: el primero apuntado y los otros hacia donde caminas', () => {
    const state = scene([{ x: 12, z: -12 }]);
    stepMatch(state, new Map([[1, cast(['tormenta', 'tormenta', 'tormenta'])]]), rules);
    run(state, CHANNEL - 1);
    const self = wizard(state, 1);
    expect(self.pos.z).toBeCloseTo(spells.tempest.distance);
    const walk = new Map([[1, [{ kind: 'move', x: 1, z: 0 } as Intent]]]);
    for (let i = 0; i < spells.tempest.intervalTicks * 2 + 2; i++) stepMatch(state, walk, rules);
    expect(self.pos.x).toBeGreaterThan(spells.tempest.distance * 2);
  });

  it('el Huracán levanta por los aires a quien toca', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 20, cast(['tormenta', 'tormenta', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.hp).toBe(rival.maxHp - spells.hurricane.damage);
    expect(rival.statuses.airborne).toBeDefined();
  });

  it('el Intercambio te cambia de lugar con el rival', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'umbra', 'tormenta']));
    expect(wizard(state, 1).pos).toEqual({ x: 0, z: 8 });
    expect(wizard(state, 2).pos).toEqual({ x: 0, z: 0 });
  });

  it('el Orbe errático da varios rayos a quien pasa cerca', () => {
    const state = scene([{ x: 2.5, z: 5 }]);
    run(state, CHANNEL + 90, cast(['tormenta', 'brasa', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.hp).toBeLessThanOrEqual(rival.maxHp - spells.erraticOrb.damage * 3);
  });
});

describe('Grandes hechizos de Marea', () => {
  it('la Era de hielo congela a los rivales cercanos y no los deja moverse', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, CHANNEL + spells.iceAge.delayTicks + 1, cast(['marea', 'marea', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.statuses.frozen).toBeDefined();
    expect(rival.hp).toBe(rival.maxHp - spells.iceAge.damage);
    const before = rival.pos;
    run(state, 10, [], rules, moving(2, 1, 0));
    expect(rival.pos).toEqual(before);
  });

  it('el Hervidero castiga a quien se queda en el círculo', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + spells.cauldron.delayTicks + 1, cast(['marea', 'brasa', 'brasa']));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - spells.cauldron.damage);
  });

  it('el Chorro de vapor te lleva hacia atrás y quema lo que hay delante', () => {
    const state = scene([{ x: 0, z: 2.5 }]);
    run(state, CHANNEL + 12, cast(['marea', 'brasa', 'tormenta']));
    expect(wizard(state, 1).pos.z).toBeCloseTo(-spells.steamJet.distance);
    expect(wizard(state, 2).statuses.burn).toBeDefined();
  });

  it('el Ahogo silencia a quien no escapa y se corta si se aleja', () => {
    const still = scene([{ x: 0, z: 5 }]);
    run(still, CHANNEL + spells.drown.durationTicks + 1, cast(['marea', 'umbra', 'brasa']));
    expect(wizard(still, 2).statuses.silenced).toBeDefined();
    expect(wizard(still, 2).hp).toBe(wizard(still, 2).maxHp - spells.drown.damage);

    const fled = scene([{ x: 0, z: 5 }]);
    const ticks = CHANNEL + spells.drown.durationTicks + 1;
    run(fled, ticks, cast(['marea', 'umbra', 'brasa']), rules, moving(2, 0, 1));
    expect(wizard(fled, 2).statuses.silenced).toBeUndefined();
  });

  it('el Manglar deja pasar al rival caminando pero ataja su proyectil', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['marea', 'raiz', 'brasa']));
    stepMatch(state, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]), rules);
    run(state, 20);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
    run(state, 20, [], rules, moving(2, 0, -1));
    expect(wizard(state, 2).pos.z).toBeLessThan(1.5);
  });

  it('el Maremoto empapa a todos los que cruza, aunque estén separados', () => {
    const state = scene([
      { x: -3, z: 6 },
      { x: 3, z: 8 },
    ]);
    run(state, CHANNEL + 30, cast(['marea', 'marea', 'tormenta']));
    expect(wizard(state, 2).statuses.soaked).toBeDefined();
    expect(wizard(state, 3).statuses.soaked).toBeDefined();
  });
});

describe('Grandes hechizos de Raíz', () => {
  it('la Catapulta de raíz te lanza lejos y enraíza al caer', () => {
    const state = scene([{ x: 0, z: 12.5 }]);
    run(
      state,
      CHANNEL + spells.rootCatapult.durationTicks + 1,
      cast(['raiz', 'tormenta', 'brasa']),
    );
    expect(wizard(state, 1).pos.z).toBeGreaterThan(10);
    expect(wizard(state, 2).statuses.root).toBeDefined();
  });

  it('la Siembra deja seis trampas y la que se pisa enraíza', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'tormenta', 'marea']));
    expect(state.spells.filter((s) => s.kind === 'trap')).toHaveLength(spells.sowing.count);
    run(state, spells.sowing.armTicks + 1);
    expect(wizard(state, 2).statuses.root).toBeDefined();
    expect(state.spells.filter((s) => s.kind === 'trap')).toHaveLength(spells.sowing.count - 1);
  });

  it('el Anillo de zarzas no deja salir caminando a quien quedó dentro', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'raiz', 'brasa']));
    run(state, 40, [], rules, moving(2, 1, 0));
    expect(wizard(state, 2).pos.x).toBeLessThan(spells.thornRing.radius);
  });

  it('el Paso entre árboles te saca por el árbol hacia donde apuntas', () => {
    const forest: GameRules = {
      ...rules,
      map: {
        ...rules.map,
        obstacles: [
          { x: 1.5, z: 0, radius: 0.8, kind: 'tree' },
          { x: 0, z: 12, radius: 0.8, kind: 'tree' },
        ],
      },
    };
    const state = scene([{ x: 12, z: -12 }], forest);
    run(state, CHANNEL + 1, cast(['raiz', 'umbra', 'tormenta']), forest);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(12);
  });
});

describe('Grandes hechizos de Umbra', () => {
  it('la Pira de almas pega más cuanto más herido esté el rival', () => {
    const state = scene([{ x: 0, z: 6 }]);
    wizard(state, 2).hp = 50;
    run(state, CHANNEL + spells.soulPyre.delayTicks + 1, cast(['umbra', 'umbra', 'brasa']));
    const expected = spells.soulPyre.damage + 50 * spells.soulPyre.missingFraction;
    expect(wizard(state, 2).hp).toBeCloseTo(50 - expected);
  });

  it('el Portal lleva a quien entra por una boca hasta la otra', () => {
    const state = scene([{ x: 6, z: 6 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'tormenta']));
    // El mago que lo abrió está parado en la boca: no cruza hasta salir y volver a entrar.
    expect(wizard(state, 1).pos).toEqual({ x: 0, z: 0 });
    run(state, 8, [{ kind: 'move', x: -1, z: 0 }]);
    run(state, 8, [{ kind: 'move', x: 1, z: 0 }]);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(spells.portal.range - 2);
  });

  it('el Fantasma atraviesa una Muralla de raíces', () => {
    const state = scene([{ x: 12, z: -12 }]);
    state.spells.push({
      kind: 'wall',
      id: 999,
      ownerId: 2,
      team: 1,
      center: { x: 0, z: 2 },
      along: { x: 1, z: 0 },
      halfLength: 4,
      thickness: 0.4,
      solid: true,
      passable: false,
      durationTicks: 300,
      ticksLeft: 300,
      payload: {
        form: 'wall',
        weave: ['raiz', 'raiz'],
        damage: 0,
        statuses: [],
        spell: 'rootWall',
        blastRadius: 0,
        pierce: false,
      },
    });
    run(state, CHANNEL + 1, cast(['umbra', 'tormenta', 'tormenta']));
    run(state, 30, [{ kind: 'move', x: 0, z: 1 }]);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(3);
  });

  it('el Abismo silencia y deshace el tejido de los rivales dentro', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + spells.abyss.delayTicks + 1, cast(['umbra', 'tormenta', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.statuses.silenced).toBeDefined();
    expect(rival.weave).toEqual([]);
  });

  it('la Pesadilla duerme al rival hasta que lo golpean', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'umbra', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.statuses.asleep).toBeDefined();
    run(state, 15, cast(['brasa']));
    expect(rival.statuses.asleep).toBeUndefined();
  });
});
