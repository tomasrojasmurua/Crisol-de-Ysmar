import { describe, expect, it } from 'vitest';
import type { Intent } from '../../controllers/intent';
import { ELEMENT_IDS } from '../../elements';
import { createMatch } from '../../match/createMatch';
import { stepMatch } from '../../match/step';
import type { GameRules } from '../../rules';
import { TEST_RULES } from '../../testing/rules.fixture';
import { cast, run, scene, wizard } from '../../testing/spellScene';
import { SPELL_IDS, SPELL_WEAVES, spellOf } from '../catalog';

const rules = TEST_RULES;

describe('catálogo', () => {
  it('cada tejido de 1 y 2 elementos tiene su hechizo, y ninguno se repite', () => {
    const seen = new Set<string>();
    for (const a of ELEMENT_IDS) {
      const single = spellOf([a]);
      expect(single).not.toBeNull();
      seen.add(String(single));
      for (const b of ELEMENT_IDS) {
        const pair = spellOf([a, b]);
        expect(pair).not.toBeNull();
        seen.add(String(pair));
      }
    }
    expect(seen.size).toBe(30);
    expect(spellOf(['marea', 'brasa'])).toBe('geyser');
    expect(spellOf(['brasa', 'marea'])).toBe('obsidian');
  });

  it('cada hechizo tiene un tejido propio y ninguno se repite', () => {
    const keys = SPELL_IDS.map((id) => SPELL_WEAVES[id].join('>'));
    expect(new Set(keys).size).toBe(SPELL_IDS.length);
    for (const id of SPELL_IDS) expect(spellOf(SPELL_WEAVES[id])).toBe(id);
  });

  it('un tejido de 3 sin Gran hechizo lanza el de sus dos primeros elementos', () => {
    expect(spellOf(['brasa', 'brasa', 'brasa'])).toBe('meteor');
    expect(spellOf(['brasa', 'tormenta', 'tormenta'])).toBe('comet');
    expect(spellOf([])).toBeNull();
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

describe('segunda tanda: Brasa', () => {
  it('la Obsidiana ataja el daño y estalla al romperse', () => {
    const state = scene([{ x: 0, z: 2 }]);
    run(state, 10, cast(['brasa', 'marea']));
    const self = wizard(state, 1);
    expect(self.shield).toBe(rules.spells.obsidian.shield);
    // El rival le pega con Bolas ígneas hasta romper la coraza.
    const rival = wizard(state, 2);
    for (let i = 0; i < 2; i++) {
      rival.fatigue.brasa = 0;
      stepMatch(state, new Map([[2, cast(['brasa', 'brasa'], { x: 0, z: -1 })]]), rules);
      run(state, 20);
    }
    expect(self.hp).toBeGreaterThan(self.maxHp - 30);
    expect(rival.hp).toBeLessThanOrEqual(rival.maxHp - rules.spells.obsidian.damage);
    expect(state.spells.some((s) => s.kind === 'obsidian')).toBe(false);
  });

  it('el Fuego fatuo persigue al rival y explota', () => {
    const state = scene([{ x: 6, z: 4 }]);
    run(state, 90, cast(['brasa', 'raiz']));
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(wizard(state, 2).maxHp - 20);
  });

  it('un golpe apaga el Fuego fatuo', () => {
    const state = scene([{ x: 0, z: 10 }]);
    run(state, 10, cast(['brasa', 'raiz']));
    expect(state.spells.some((s) => s.kind === 'summon')).toBe(true);
    stepMatch(state, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]), rules);
    run(state, 20);
    expect(state.spells.some((s) => s.kind === 'summon')).toBe(false);
    expect(wizard(state, 2).hp).toBe(wizard(state, 2).maxHp);
  });

  it('la Ignición devuelve una parte de lo que el rival recibió', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 10, cast(['brasa', 'umbra']));
    const rival = wizard(state, 2);
    // Mientras dura la marca, recibe 40 de otra fuente.
    const before = rival.hp;
    rival.damageTaken += 40;
    rival.hp -= 40;
    run(state, rules.spells.ignite.durationTicks);
    expect(rival.hp).toBeCloseTo(before - 40 - 40 * rules.spells.ignite.fraction);
  });
});

describe('segunda tanda: Tormenta', () => {
  it('la Ventisca frena a los rivales y tuerce sus proyectiles', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 10, cast(['tormenta', 'marea']));
    expect(wizard(state, 2).statuses.slow).toBeDefined();
    stepMatch(state, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]), rules);
    run(state, 20);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
  });

  it('el Pararrayos da rayos y cae con dos golpes', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, 40, cast(['tormenta', 'raiz']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    const rival = wizard(state, 2);
    for (let i = 0; i < 2; i++) {
      rival.fatigue.brasa = 0;
      run(state, 20, [], rules, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]));
    }
    expect(state.spells.some((s) => s.kind === 'summon')).toBe(false);
  });

  it('el Paso sombrío te deja detrás del rival y lo silencia', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 10, cast(['tormenta', 'umbra']));
    const self = wizard(state, 1);
    const rival = wizard(state, 2);
    expect(self.pos.z).toBeGreaterThan(rival.pos.z);
    expect(rival.statuses.silenced).toBeDefined();
    stepMatch(state, new Map([[2, [{ kind: 'weave', element: 'brasa' }]]]), rules);
    expect(rival.weave).toEqual([]);
  });
});

describe('segunda tanda: Marea', () => {
  it('la Corriente apura a quien va a favor y frena a los rivales', () => {
    const state = scene([{ x: 0.5, z: 5 }]);
    run(state, 10, cast(['marea', 'tormenta']));
    const forward = new Map([[1, [{ kind: 'move', x: 0, z: 1 } as Intent]]]);
    stepMatch(state, forward, rules);
    expect(wizard(state, 1).statuses.haste).toBeDefined();
    expect(wizard(state, 2).statuses.slow).toBeDefined();
  });

  it('el Muro de hielo deja pasar a los aliados pero no a los rivales', () => {
    const state = createMatch(
      {
        seed: 1,
        deathRule: 'spectre',
        wizards: [
          { team: 0, spawn: { x: 0, z: 0 } },
          { team: 0, spawn: { x: 1, z: 4 } },
          { team: 1, spawn: { x: -1, z: 4 } },
        ],
      },
      rules,
    );
    run(state, 12, cast(['marea', 'marea']));
    const walk = new Map([
      [2, [{ kind: 'move', x: 0, z: -1 } as Intent]],
      [3, [{ kind: 'move', x: 0, z: -1 } as Intent]],
    ]);
    run(state, 30, [], rules, walk);
    expect(wizard(state, 2).pos.z).toBeLessThan(rules.spells.iceWall.distance);
    expect(wizard(state, 3).pos.z).toBeGreaterThan(rules.spells.iceWall.distance);
  });

  it('el Manantial cura a quien está dentro', () => {
    const state = scene([{ x: 10, z: 10 }]);
    wizard(state, 1).hp = 40;
    run(state, 60, cast(['marea', 'raiz']));
    expect(wizard(state, 1).hp).toBeGreaterThan(48);
  });
});

describe('segunda tanda: Raíz', () => {
  it('la Liana te lleva hasta el rival y lo enraíza', () => {
    const state = scene([{ x: 0, z: 7 }]);
    run(state, 20, cast(['raiz', 'tormenta']));
    expect(wizard(state, 1).pos.z).toBeGreaterThan(5);
    expect(wizard(state, 2).statuses.root).toBeDefined();
  });

  it('la Liana se engancha a un árbol', () => {
    const forest: GameRules = {
      ...rules,
      map: { ...rules.map, obstacles: [{ x: 0, z: 7, radius: 1, kind: 'tree' }] },
    };
    const state = scene([{ x: 10, z: -10 }], forest);
    run(state, 20, cast(['raiz', 'tormenta']), forest);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(4.5);
    expect(wizard(state, 1).pos.z).toBeLessThan(6);
  });

  it('el Guardián de musgo pega y ataja proyectiles', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, 60, cast(['raiz', 'marea']));
    expect(wizard(state, 2).hp).toBeLessThan(wizard(state, 2).maxHp);
    const guardian = state.spells.find((s) => s.kind === 'summon');
    const hp = guardian?.kind === 'summon' ? guardian.hp : 0;
    const self = wizard(state, 1);
    const before = self.hp;
    wizard(state, 2).fatigue.brasa = 0;
    stepMatch(state, new Map([[2, cast(['brasa'], { x: 0, z: -1 })]]), rules);
    run(state, 20);
    expect(self.hp).toBe(before);
    expect(guardian?.kind === 'summon' ? guardian.hp : 0).toBeLessThan(hp);
  });

  it('las Esporas debilitan: el rival hace menos daño', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, 10, cast(['raiz', 'umbra']));
    const rival = wizard(state, 2);
    expect(rival.statuses.weak).toBeDefined();
    stepMatch(state, new Map([[2, cast(['umbra'], { x: 0, z: -1 })]]), rules);
    run(state, 4);
    const self = wizard(state, 1);
    expect(self.hp).toBeCloseTo(
      self.maxHp - rules.spells.claw.damage * rules.statuses.weak.damageMultiplier,
    );
  });
});

describe('segunda tanda: Umbra', () => {
  it('el Señuelo te vuelve invisible y un doble corre por ti', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, 20, cast(['umbra', 'tormenta']));
    expect(wizard(state, 1).statuses.veiled).toBeDefined();
    const decoy = state.spells.find((s) => s.kind === 'summon' && s.summon === 'decoy');
    expect(decoy?.kind === 'summon' && decoy.pos.z).toBeGreaterThan(1);
  });

  it('la Ceguera no deja ver a los rivales lejanos', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, 20, cast(['umbra', 'marea']));
    const rival = wizard(state, 2);
    expect(rival.statuses.blind).toBeDefined();
    // Cegado, su Zarpa no encuentra blanco.
    stepMatch(state, new Map([[2, cast(['umbra'], { x: 0, z: -1 })]]), rules);
    run(state, 4);
    expect(wizard(state, 1).hp).toBe(wizard(state, 1).maxHp);
  });

  it('el Grillete castiga al rival que se aleja', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, 10, cast(['umbra', 'raiz']));
    const flee = new Map([[2, [{ kind: 'move', x: 0, z: 1 } as Intent]]]);
    run(state, 40, [], rules, flee);
    const rival = wizard(state, 2);
    expect(rival.hp).toBe(rival.maxHp - rules.spells.shackle.damage);
    expect(rival.statuses.root).toBeDefined();
  });
});
