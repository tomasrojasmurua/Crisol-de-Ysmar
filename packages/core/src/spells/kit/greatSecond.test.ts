import { describe, expect, it } from 'vitest';
import { applyStatus } from '../../combat/hit';
import type { Intent } from '../../controllers/intent';
import { createMatch } from '../../match/createMatch';
import type { MatchState, Summon } from '../../match/state';
import type { Vec2 } from '../../math/vec2';
import { TEST_RULES } from '../../testing/rules.fixture';
import { cast, run, scene, wizard } from '../../testing/spellScene';

const rules = TEST_RULES;
/** Pasos hasta que sale un Gran hechizo (0,6 s de canalización). */
const CHANNEL = 18;
const spells = rules.spells;

/** El mago 1 en el origen, un aliado (2) y rivales (3 en adelante). */
function withAlly(ally: Vec2, rivals: Vec2[]): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'spectre',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 0, spawn: ally },
        ...rivals.map((spawn) => ({ team: 1, spawn })),
      ],
    },
    rules,
  );
}

function summons(state: MatchState, kind: Summon['summon']): Summon[] {
  return state.spells.filter((s): s is Summon => s.kind === 'summon' && s.summon === kind);
}

function moving(id: number, x: number, z: number): Map<number, Intent[]> {
  return new Map([[id, [{ kind: 'move', x, z }]]]);
}

describe('Grandes hechizos: invocaciones', () => {
  it('el Ave de ceniza quema de ida y de vuelta', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 70, cast(['brasa', 'brasa', 'raiz']));
    const hits = wizard(state, 2).damageTaken;
    expect(hits).toBeGreaterThanOrEqual(spells.ashBird.damage * 2);
  });

  it('las Chispas errantes salen al rival que se acerca', () => {
    const state = scene([{ x: 0, z: 3.5 }]);
    run(state, CHANNEL + 2, cast(['brasa', 'raiz', 'tormenta']));
    run(state, 60);
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    expect(summons(state, 'wanderingSpark').length).toBeLessThan(spells.wanderingSparks.count);
  });

  it('el Gólem de magma estalla al caer', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'raiz', 'umbra']));
    const [golem] = summons(state, 'magmaGolem');
    expect(golem).toBeDefined();
    if (golem) golem.hp = 0;
    run(state, 2);
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(
      wizard(state, 2).maxHp - spells.magmaGolem.damage,
    );
  });

  it('el Glaciar vivo congela al primero que toca', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 60, cast(['marea', 'raiz', 'raiz']));
    expect(wizard(state, 2).statuses.frozen ?? wizard(state, 2).hp < 100).toBeTruthy();
    expect(summons(state, 'glacier')).toHaveLength(0);
  });

  it('el Enjambre persigue al rival y lo deja lento y ciego', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 40, cast(['raiz', 'tormenta', 'tormenta']));
    expect(wizard(state, 2).statuses.slow).toBeDefined();
    expect(wizard(state, 2).statuses.blind).toBeDefined();
  });

  it('la Manada de raíces atropella una fila ancha y enraíza', () => {
    const state = scene([
      { x: 1.8, z: 6 },
      { x: -1.8, z: 6 },
    ]);
    run(state, CHANNEL + 30, cast(['raiz', 'raiz', 'tormenta']));
    expect(wizard(state, 2).statuses.root).toBeDefined();
    expect(wizard(state, 3).statuses.root).toBeDefined();
  });

  it('el Árbol ancestral ataja proyectiles y azota a quien se le acerca', () => {
    const state = scene([{ x: 0, z: 4.5 }]);
    run(state, CHANNEL + spells.ancientTree.intervalTicks + 2, cast(['raiz', 'raiz', 'raiz']));
    const [tree] = summons(state, 'ancientTree');
    expect(tree).toBeDefined();
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - spells.ancientTree.damage);
  });

  it('el Gemelo sombrío le dispara al rival', () => {
    const state = scene([{ x: 0, z: 7 }]);
    run(state, CHANNEL + 90, cast(['umbra', 'umbra', 'tormenta']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
  });

  it('la Planta carnívora se traga al rival y lo escupe herido', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, CHANNEL + 3, cast(['raiz', 'umbra', 'brasa']));
    expect(wizard(state, 2).statuses.stasis).toBeDefined();
    run(state, spells.carnivore.swallowTicks + 2);
    const rival = wizard(state, 2);
    expect(rival.statuses.stasis).toBeUndefined();
    expect(rival.hp).toBe(rival.maxHp - spells.carnivore.damage);
    expect(summons(state, 'carnivore')).toHaveLength(0);
  });
});

describe('Grandes hechizos: apoyo', () => {
  it('la Fuente termal apura el tejido', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 2, cast(['brasa', 'marea', 'raiz']));
    expect(wizard(state, 1).statuses.quickened).toBeDefined();
  });

  it('el Viento de cola apura a ti y a tu aliado cercano', () => {
    const state = withAlly({ x: 3, z: 0 }, [{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'marea', 'tormenta']));
    expect(wizard(state, 1).statuses.haste).toBeDefined();
    expect(wizard(state, 2).statuses.haste).toBeDefined();
  });

  it('la Burbuja va al aliado apuntado y se deshace al terminar', () => {
    const state = withAlly({ x: 0, z: 5 }, [{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['marea', 'brasa', 'marea']));
    expect(wizard(state, 2).shield).toBe(spells.bubble.shield);
    expect(wizard(state, 1).shield).toBe(0);
    run(state, spells.bubble.durationTicks + 1);
    expect(wizard(state, 2).shield).toBe(0);
  });

  it('el Agua de vida levanta al aliado caído', () => {
    const state = withAlly({ x: 3, z: 0 }, [{ x: 20, z: 20 }]);
    wizard(state, 2).hp = 0;
    run(state, 2);
    expect(wizard(state, 2).fallen).not.toBeNull();
    run(state, CHANNEL + 1, cast(['marea', 'brasa', 'raiz']));
    const ally = wizard(state, 2);
    expect(ally.fallen).toBeNull();
    expect(ally.hp).toBeCloseTo(ally.maxHp * spells.lifeWater.hpFraction);
  });

  it('la Lluvia de vida cura y limpia', () => {
    const state = scene([{ x: 20, z: 20 }]);
    const self = wizard(state, 1);
    self.hp = 50;
    self.statuses.burn = { ticks: 300, sourceId: 2 };
    run(state, CHANNEL + 31, cast(['marea', 'marea', 'raiz']));
    expect(self.statuses.burn).toBeUndefined();
    expect(self.hp).toBeGreaterThan(50);
  });

  it('el Sacrificio pasa vida a un aliado sin dejarte en cero', () => {
    const state = withAlly({ x: 0, z: 4 }, [{ x: 20, z: 20 }]);
    wizard(state, 1).hp = 20;
    wizard(state, 2).hp = 10;
    run(state, CHANNEL + 1, cast(['marea', 'umbra', 'raiz']));
    expect(wizard(state, 1).hp).toBe(1);
    expect(wizard(state, 2).hp).toBe(29);
  });

  it('el Jardín cura al aliado herido que pisa una flor', () => {
    const state = scene([{ x: 20, z: 20 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'raiz', 'marea']));
    const self = wizard(state, 1);
    self.hp = 50;
    run(state, 30, [], rules, new Map([[1, []]]));
    const before = self.hp;
    run(state, 30, [{ kind: 'move', x: 0, z: 1 }]);
    expect(self.hp).toBeGreaterThanOrEqual(before + spells.garden.heal - 1);
  });

  it('con el Vínculo vital tus golpes curan a tu aliado', () => {
    const state = withAlly({ x: 2, z: 0 }, [{ x: 0, z: 6 }]);
    wizard(state, 2).hp = 50;
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'raiz']));
    expect(wizard(state, 1).statuses.linked).toBeDefined();
    wizard(state, 1).fatigue = { brasa: 0, tormenta: 0, marea: 0, raiz: 0, umbra: 0 };
    run(state, 40, cast(['brasa']));
    expect(wizard(state, 2).hp).toBeGreaterThan(50);
  });
});

describe('Grandes hechizos: refuerzo', () => {
  it('la Inmolación quema alrededor y te cura', () => {
    const state = scene([{ x: 0, z: 2 }]);
    wizard(state, 1).hp = 50;
    run(state, CHANNEL + 31, cast(['brasa', 'brasa', 'umbra']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    expect(wizard(state, 1).hp).toBeGreaterThan(50);
  });

  it('el Ojo del huracán empuja al rival y deshace sus proyectiles', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'marea', 'raiz']));
    run(state, 40, [], rules, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]));
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
    run(state, 30, [], rules, moving(2, 0, -1));
    expect(wizard(state, 2).pos.z).toBeGreaterThanOrEqual(
      spells.stormEye.radius + rules.wizard.radius - 0.01,
    );
  });

  it('la Purificación limpia y no deja entrar estados dañinos', () => {
    const state = scene([{ x: 20, z: 20 }]);
    const self = wizard(state, 1);
    self.statuses.slow = { ticks: 300, sourceId: 2 };
    run(state, CHANNEL + 1, cast(['marea', 'raiz', 'marea']));
    expect(self.statuses.slow).toBeUndefined();
    expect(self.statuses.warded).toBeDefined();
    applyStatus(state, self, 'burn', 2, rules);
    expect(self.statuses.burn).toBeUndefined();
  });

  it('la Marea de almas te cura por cada mago que cruza', () => {
    const state = scene([
      { x: 0, z: 4 },
      { x: 0.5, z: 7 },
    ]);
    wizard(state, 1).hp = 50;
    run(state, CHANNEL + 40, cast(['umbra', 'marea', 'tormenta']));
    expect(wizard(state, 1).hp).toBe(50 + spells.soulTide.heal * 2);
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp);
  });
});

describe('Grandes hechizos: estados', () => {
  it('la Combustión quema al rival cada vez que teje', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'umbra', 'brasa']));
    expect(wizard(state, 2).statuses.combusting).toBeDefined();
    run(state, 3, [], rules, new Map([[2, cast(['marea'], { x: 1, z: 0 })]]));
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp - rules.statuses.combusting.damage);
  });

  it('el Robo de velocidad frena al rival y te apura a ti', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'umbra', 'umbra']));
    expect(wizard(state, 2).statuses.slow).toBeDefined();
    expect(wizard(state, 1).statuses.haste).toBeDefined();
  });

  it('el Ácido hace que todo pegue más', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 20, cast(['marea', 'brasa', 'umbra']));
    const rival = wizard(state, 2);
    expect(rival.statuses.exposed).toBeDefined();
    const before = rival.hp;
    wizard(state, 1).fatigue = { brasa: 0, tormenta: 0, marea: 0, raiz: 0, umbra: 0 };
    run(state, 20, cast(['brasa']));
    // Lo que pega la Chispa (y su quemadura) llega aumentado.
    expect(before - rival.hp).toBeGreaterThan(
      spells.spark.damage * rules.statuses.exposed.damageMultiplier - 0.01,
    );
  });

  it('el Vaho hace tejer más lento', () => {
    const state = scene([{ x: 0, z: 7 }]);
    run(state, CHANNEL + 2, cast(['marea', 'marea', 'brasa']));
    expect(wizard(state, 2).statuses.sluggish).toBeDefined();
  });

  it('el Eclipse ciega a todos los rivales, estén donde estén', () => {
    const state = scene([
      { x: 0, z: 6 },
      { x: -25, z: 20 },
    ]);
    run(state, CHANNEL + 1, cast(['umbra', 'umbra', 'umbra']));
    expect(wizard(state, 2).statuses.blind).toBeDefined();
    expect(wizard(state, 3).statuses.blind).toBeDefined();
  });

  it('la Plaga daña y se contagia a los rivales cercanos', () => {
    const state = scene([
      { x: 0, z: 6 },
      { x: 1.5, z: 6 },
    ]);
    run(state, CHANNEL + 2, cast(['umbra', 'marea', 'raiz']));
    expect(wizard(state, 2).statuses.plague).toBeDefined();
    run(state, 30);
    expect(wizard(state, 3).statuses.plague).toBeDefined();
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
  });
});
