import { describe, expect, it } from 'vitest';
import type { Intent } from '../../controllers/intent';
import type { ElementId } from '../../elements';
import { createMatch } from '../../match/createMatch';
import type { MatchState, Wizard } from '../../match/state';
import { stepMatch } from '../../match/step';
import type { Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TEST_RULES } from '../../testing/rules.fixture';
import { spellOf } from '../catalog';

const rules = TEST_RULES;

/** El mago 1 en el origen mirando a +z; los demás son rivales en las posiciones dadas. */
function scene(rivals: Vec2[], sceneRules: GameRules = rules): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'spectre',
      wizards: [{ team: 0, spawn: { x: 0, z: 0 } }, ...rivals.map((spawn) => ({ team: 1, spawn }))],
    },
    sceneRules,
  );
}

function wizard(state: MatchState, id: number): Wizard {
  const found = state.wizards.find((w) => w.id === id);
  if (!found) throw new Error(`No existe el mago ${id}`);
  return found;
}

function cast(elements: ElementId[], dir: Vec2 = { x: 0, z: 1 }): Intent[] {
  return [
    ...elements.map((element): Intent => ({ kind: 'weave', element })),
    { kind: 'cast', dirX: dir.x, dirZ: dir.z },
  ];
}

/** Ejecuta `ticks` pasos; el mago 1 recibe `first` en el primero y los demás, `others` siempre. */
function run(
  state: MatchState,
  ticks: number,
  first: Intent[] = [],
  sceneRules: GameRules = rules,
  others: ReadonlyMap<number, Intent[]> = new Map(),
): void {
  for (let i = 0; i < ticks; i++) {
    const intents = new Map(others);
    intents.set(1, i === 0 ? first : []);
    stepMatch(state, intents, sceneRules);
  }
}

describe('catálogo', () => {
  it('cada tejido construido tiene su hechizo propio', () => {
    expect(spellOf(['brasa'])).toBe('spark');
    expect(spellOf(['marea', 'brasa'])).toBe('geyser');
    expect(spellOf(['brasa', 'marea'])).toBeNull();
  });

  it('un tejido de 3 sin Gran hechizo lanza el de sus dos primeros elementos', () => {
    expect(spellOf(['raiz', 'raiz', 'umbra'])).toBe('rootWall');
    expect(spellOf(['raiz', 'tormenta', 'umbra'])).toBeNull();
  });
});

describe('básicos', () => {
  it('Chispa daña y quema', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, 12, cast(['brasa']));
    const rival = wizard(state, 2);
    expect(rival.hp).toBeLessThan(rival.maxHp - rules.spells.spark.damage + 0.01);
    expect(rival.statuses.burn).toBeDefined();
  });

  it('Paso mueve 4 m', () => {
    const state = scene([{ x: 10, z: 10 }]);
    run(state, 8, cast(['tormenta']));
    expect(wizard(state, 1).pos.z).toBeCloseTo(rules.spells.step.distance);
  });

  it('Salpicón moja y ralentiza a quien está delante, no a quien está detrás', () => {
    const state = scene([
      { x: 0, z: 2 },
      { x: 0, z: -2 },
    ]);
    run(state, 4, cast(['marea']));
    expect(wizard(state, 2).statuses.slow).toBeDefined();
    expect(wizard(state, 3).statuses.slow).toBeUndefined();
  });

  it('Savia cura en el tiempo', () => {
    const state = scene([{ x: 10, z: 10 }]);
    wizard(state, 1).hp = 50;
    run(state, 60, cast(['raiz']));
    expect(wizard(state, 1).hp).toBeGreaterThan(55);
  });

  it('Zarpa golpea al instante y devuelve vida', () => {
    const state = scene([{ x: 0, z: 4 }]);
    wizard(state, 1).hp = 50;
    run(state, 4, cast(['umbra']));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - rules.spells.claw.damage);
    expect(wizard(state, 1).hp).toBe(50 + rules.spells.claw.damage);
  });
});

describe('hechizos de Brasa y Tormenta', () => {
  it('la Bola ígnea explota y alcanza a dos rivales juntos', () => {
    const state = scene([
      { x: 0, z: 6 },
      { x: 1.5, z: 6.5 },
    ]);
    run(state, 40, cast(['brasa', 'brasa']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp - 25);
    expect(wizard(state, 3).hp).toBeLessThan(wizard(state, 3).maxHp - 25);
  });

  it('el Cometa te lleva lejos y deja el suelo ardiendo', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, 30, cast(['brasa', 'tormenta']));
    expect(wizard(state, 1).pos.z).toBeCloseTo(rules.spells.comet.distance);
    expect(wizard(state, 2).statuses.burn).toBeDefined();
  });

  it('el Destello atraviesa un árbol', () => {
    const forest: GameRules = {
      ...rules,
      map: { ...rules.map, obstacles: [{ x: 0, z: 3, radius: 1, kind: 'tree' }] },
    };
    const state = scene([{ x: 10, z: -10 }], forest);
    run(state, 10, cast(['tormenta', 'tormenta']), forest);
    expect(wizard(state, 1).pos.z).toBeCloseTo(rules.spells.blink.distance);
  });

  it('el Rayo en cadena salta de un rival a otro', () => {
    const state = scene([
      { x: 0, z: 6 },
      { x: 3, z: 7 },
    ]);
    run(state, 10, cast(['tormenta', 'brasa']));
    const [first, second] = rules.spells.chainLightning.damages;
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - (first ?? 0));
    expect(wizard(state, 3).hp).toBe(wizard(state, 3).maxHp - (second ?? 0));
  });
});

describe('hechizos de Marea', () => {
  it('el Géiser levanta por los aires y no deja tejer', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 9 + rules.spells.geyser.delayTicks, cast(['marea', 'brasa']));
    const rival = wizard(state, 2);
    expect(rival.statuses.airborne).toBeDefined();
    stepMatch(state, new Map([[2, [{ kind: 'weave', element: 'brasa' }]]]), rules);
    expect(rival.weave).toEqual([]);
  });

  it('el Géiser se esquiva saliendo del círculo durante el aviso', () => {
    const state = scene([{ x: 0, z: 5 }]);
    const flee = new Map([[2, [{ kind: 'move', x: 1, z: 0 } as Intent]]]);
    run(state, 9 + rules.spells.geyser.delayTicks, cast(['marea', 'brasa']), rules, flee);
    expect(wizard(state, 2).statuses.airborne).toBeUndefined();
  });

  it('dentro del Ataúd helado no se recibe daño y se sale limpio', () => {
    const state = scene([{ x: 0, z: 3 }]);
    wizard(state, 1).statuses.burn = { ticks: 300, sourceId: 2 };
    run(state, 10, cast(['marea', 'umbra']));
    const self = wizard(state, 1);
    expect(self.statuses.stasis).toBeDefined();
    expect(self.statuses.burn).toBeUndefined();
    const hp = self.hp;
    stepMatch(state, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]), rules);
    run(state, 10);
    expect(self.hp).toBe(hp);
  });
});

describe('hechizos de Raíz', () => {
  it('la Estampida de espinas alcanza a quien está en la línea', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, 30, cast(['raiz', 'brasa']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp - 7);
  });

  it('la Muralla de raíces corta el paso del rival y los proyectiles de todos', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 12, cast(['raiz', 'raiz']));
    const walk = new Map([[2, [{ kind: 'move', x: 0, z: -1 } as Intent]]]);
    run(state, 30, [], rules, walk);
    expect(wizard(state, 2).pos.z).toBeGreaterThan(rules.spells.rootWall.distance);
    // Ni siquiera la Chispa de quien la levantó pasa.
    wizard(state, 1).fatigue.brasa = 0;
    run(state, 30, cast(['brasa']));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp);
  });
});

describe('hechizos de Umbra', () => {
  it('con Velo no te eligen como blanco y el primer ataque pega más', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 10, cast(['umbra', 'umbra']));
    expect(wizard(state, 1).statuses.veiled).toBeDefined();
    // El rival intenta una Zarpa: sin blanco visible, falla.
    stepMatch(state, new Map([[2, cast(['umbra'], { x: 0, z: -1 })]]), rules);
    run(state, 4);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
    // La Zarpa desde el Velo hace más daño y lo rompe.
    wizard(state, 1).fatigue.umbra = 0;
    run(state, 4, cast(['umbra']));
    const bonus = rules.statuses.veiled.damageMultiplier;
    expect(wizard(state, 2).hp).toBeCloseTo(
      wizard(state, 2).maxHp - rules.spells.claw.damage * bonus,
    );
    expect(wizard(state, 1).statuses.veiled).toBeUndefined();
  });

  it('el Drenaje roba vida y se corta si el rival se aleja', () => {
    const state = scene([{ x: 0, z: 5 }]);
    wizard(state, 1).hp = 50;
    run(state, 30, cast(['umbra', 'brasa']));
    expect(wizard(state, 1).hp).toBeGreaterThan(55);
    const rival = wizard(state, 2);
    rival.pos = { x: 0, z: 14 };
    const hp = rival.hp;
    run(state, 10);
    expect(rival.hp).toBe(hp);
  });
});
