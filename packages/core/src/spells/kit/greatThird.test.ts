import { describe, expect, it } from 'vitest';
import { applyStatus } from '../../combat/hit';
import { createMatch } from '../../match/createMatch';
import { liveRules } from '../../match/liveMap';
import { isHiddenFrom } from '../../match/queries';
import type { GameRules } from '../../rules';
import { TEST_RULES } from '../../testing/rules.fixture';
import { cast, run, scene, wizard } from '../../testing/spellScene';

const rules = TEST_RULES;
const CHANNEL = 18;
const spells = rules.spells;
const rested = { brasa: 0, tormenta: 0, marea: 0, raiz: 0, umbra: 0 };

function forest(trees: { x: number; z: number }[]): GameRules {
  return {
    ...rules,
    map: { ...rules.map, obstacles: trees.map((t) => ({ ...t, radius: 0.7, kind: 'tree' })) },
  };
}

describe('Grandes hechizos: mapa vivo', () => {
  it('el Incendio forestal quema los árboles por el resto de la ronda', () => {
    const jungle = forest([{ x: 0, z: 6 }]);
    const state = scene([{ x: 20, z: 20 }], jungle);
    run(state, CHANNEL + 40, cast(['brasa', 'tormenta', 'raiz']), jungle);
    expect(state.burnedTrees).toHaveLength(1);
    expect(liveRules(state, jungle).map.obstacles).toHaveLength(0);
  });

  it('el Brote de árbol deja un árbol que tapa, y nunca más de dos por mago', () => {
    const state = scene([{ x: 20, z: 20 }]);
    for (let i = 0; i < 3; i++) {
      wizard(state, 1).fatigue = { ...rested };
      run(state, CHANNEL + 1, cast(['raiz', 'brasa', 'raiz']));
    }
    expect(state.spells.filter((s) => s.kind === 'grownTree')).toHaveLength(2);
    const live = liveRules(state, rules);
    expect(live.map.obstacles.length).toBe(rules.map.obstacles.length + 2);
  });

  it('una bestia domada muerde a tus rivales', () => {
    const state = scene([{ x: 2, z: 7 }]);
    state.beasts.push({
      id: 99,
      element: 'raiz',
      camp: null,
      guardian: false,
      maxHp: rules.beasts.maxHp,
      home: { x: 0, z: 5 },
      pos: { x: 0, z: 5 },
      facing: { x: 0, z: 1 },
      hp: rules.beasts.maxHp,
      targetId: null,
      aggroTicks: 0,
      attackCooldown: 0,
      velocity: { x: 0, z: 0 },
      tamedBy: null,
      tamedTicks: 0,
    });
    // Mirando a la bestia y no al rival.
    run(state, CHANNEL + 90, cast(['raiz', 'brasa', 'brasa'], { x: 0, z: 1 }));
    expect(state.beasts[0]?.tamedBy).toBe(1);
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
  });
});

describe('Grandes hechizos: información', () => {
  it('el Cazador ve a quien tiene Velo, salvo si borró su rastro', () => {
    const state = scene([{ x: 0, z: 10 }]);
    const rival = wizard(state, 2);
    rival.statuses.veiled = { ticks: 300, sourceId: 2 };
    expect(isHiddenFrom(rival, wizard(state, 1), rules)).toBe(true);
    run(state, CHANNEL + 1, cast(['tormenta', 'raiz', 'umbra']));
    expect(wizard(state, 1).statuses.hunting).toBeDefined();
    expect(isHiddenFrom(rival, wizard(state, 1), rules)).toBe(false);
    rival.statuses.unseen = { ticks: 300, sourceId: 2 };
    expect(isHiddenFrom(rival, wizard(state, 1), rules)).toBe(true);
  });

  it('la Huella marca al rival y la Lluvia que borra la quita', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'tormenta', 'umbra']));
    expect(wizard(state, 2).statuses.tracked).toBeDefined();
    run(state, CHANNEL + 1, [], rules, new Map([[2, cast(['marea', 'tormenta', 'raiz'])]]));
    expect(wizard(state, 2).statuses.tracked).toBeUndefined();
    expect(wizard(state, 2).statuses.unseen).toBeDefined();
  });

  it('el Centinela queda donde se lo deja', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 30, cast(['umbra', 'tormenta', 'raiz']));
    const eye = state.spells.find((s) => s.kind === 'summon' && s.summon === 'sentinel');
    expect(eye?.kind === 'summon' && eye.pos.z).toBeCloseTo(spells.sentinel.range, 0);
  });

  it('el Barómetro deja ver el cansancio del rival', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'marea', 'brasa']));
    expect(wizard(state, 1).statuses.insight).toBeDefined();
  });
});

describe('Grandes hechizos: sigilo', () => {
  it('en la Niebla carmesí los rivales no ven y tus golpes te curan', () => {
    const state = scene([{ x: 0, z: 4 }]);
    const self = wizard(state, 1);
    self.hp = 50;
    run(state, CHANNEL + 1, cast(['brasa', 'marea', 'umbra']));
    expect(wizard(state, 2).statuses.blind).toBeDefined();
    self.fatigue = { ...rested };
    run(state, 20, cast(['brasa']));
    expect(self.hp).toBeGreaterThan(50);
  });

  it('el Espejismo deja tres copias que caminan como tú', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['marea', 'umbra', 'tormenta']));
    const copies = () => state.spells.filter((s) => s.kind === 'summon' && s.summon === 'mirage');
    expect(copies()).toHaveLength(spells.mirage.count);
    const before = copies().map((c) => (c.kind === 'summon' ? c.pos.x : 0));
    run(state, 15, [{ kind: 'move', x: 1, z: 0 }]);
    copies().forEach((c, i) => {
      expect(c.kind === 'summon' && c.pos.x).toBeGreaterThan((before[i] ?? 0) + 1);
    });
  });

  it('en el Bosque maldito tu equipo es invisible y el rival queda débil', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 2, cast(['raiz', 'raiz', 'umbra']));
    expect(wizard(state, 2).statuses.weak).toBeDefined();
    run(state, 40, [{ kind: 'move', x: 0, z: 1 }]);
    expect(wizard(state, 1).statuses.shrouded).toBeDefined();
  });

  it('la Alfombra de musgo saca del minimapa a tu equipo', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 2, cast(['raiz', 'umbra', 'marea']));
    expect(wizard(state, 1).statuses.unseen).toBeDefined();
  });

  it('la Ilusión de tejido disfraza tu tejido', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'tormenta', 'umbra']));
    expect(wizard(state, 1).statuses.disguised).toBeDefined();
  });

  it('con la Sombra prestada solo el rival marcado deja de verte', () => {
    const state = scene([
      { x: 0, z: 8 },
      { x: 8, z: 0 },
    ]);
    run(state, CHANNEL + 1, cast(['umbra', 'raiz', 'umbra']));
    const self = wizard(state, 1);
    expect(isHiddenFrom(self, wizard(state, 2), rules)).toBe(true);
    expect(isHiddenFrom(self, wizard(state, 3), rules)).toBe(false);
  });
});

describe('Grandes hechizos: transformaciones', () => {
  it('en Forma de magma no te frenan y dejas el suelo ardiendo', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'marea', 'marea']));
    const self = wizard(state, 1);
    applyStatus(state, self, 'slow', 2, rules);
    expect(self.statuses.slow).toBeUndefined();
    run(state, 20, [{ kind: 'move', x: 1, z: 0 }]);
    expect(state.spells.some((s) => s.kind === 'zone' && s.effect === 'burn')).toBe(true);
  });

  it('con Surf corres mucho, empapas a quien cruzas y no tejes', () => {
    const state = scene([{ x: 3, z: 0 }]);
    run(state, CHANNEL + 1, cast(['marea', 'tormenta', 'tormenta']));
    const self = wizard(state, 1);
    run(state, 15, [{ kind: 'move', x: 1, z: 0 }]);
    expect(wizard(state, 2).statuses.soaked).toBeDefined();
    self.fatigue = { ...rested };
    run(state, 2, [{ kind: 'weave', element: 'brasa' }]);
    expect(self.weave).toHaveLength(0);
  });

  it('con Raíces profundas no te mueven y tus hechizos llegan más lejos', () => {
    const state = scene([{ x: 0, z: 18 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'tormenta', 'raiz']));
    const self = wizard(state, 1);
    applyStatus(state, self, 'airborne', 2, rules);
    expect(self.statuses.airborne).toBeUndefined();
    run(state, 10, [{ kind: 'move', x: 1, z: 0 }]);
    expect(self.pos.x).toBe(0);
    // La Chispa tiene 12 m de alcance; con raíces llega a 18.
    self.fatigue = { ...rested };
    run(state, 50, cast(['brasa']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
  });

  it('la Pantera da zarpazos que roban vida', () => {
    const state = scene([{ x: 0, z: 1.5 }]);
    const self = wizard(state, 1);
    run(state, CHANNEL + 1, cast(['umbra', 'raiz', 'tormenta']));
    self.hp = 50;
    run(state, 45);
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    expect(self.hp).toBeGreaterThan(50);
  });
});

it('una ronda nueva empieza con la jungla entera', () => {
  const state = createMatch({ seed: 1, deathRule: 'spectre', wizards: [] }, rules);
  expect(state.burnedTrees).toEqual([]);
});
