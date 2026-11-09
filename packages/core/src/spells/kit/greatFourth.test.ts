import { describe, expect, it } from 'vitest';
import type { Intent } from '../../controllers/intent';
import { createMatch } from '../../match/createMatch';
import { liveRules } from '../../match/liveMap';
import { isHiddenFrom } from '../../match/queries';
import type { MatchState } from '../../match/state';
import { stepMatch } from '../../match/step';
import { TEST_RULES } from '../../testing/rules.fixture';
import { cast, run, scene, wizard } from '../../testing/spellScene';

const rules = TEST_RULES;
const CHANNEL = 18;
const spells = rules.spells;
const statuses = rules.statuses;
const rested = { brasa: 0, tormenta: 0, marea: 0, raiz: 0, umbra: 0 };

/** La vida de un mago, con margen para la quemadura que deja una Chispa. */
function expectHp(state: MatchState, id: number, expected: number, burns = 1): void {
  const hp = wizard(state, id).hp;
  expect(hp).toBeLessThanOrEqual(expected + 1e-6);
  expect(hp).toBeGreaterThan(expected - 3 * burns);
}

/** Deja descansados todos los elementos del mago 1. */
function rest(state: MatchState): void {
  wizard(state, 1).fatigue = { ...rested };
}

/** El mago 2 hace lo mismo en cada paso. */
function rival(intents: Intent[]): Map<number, Intent[]> {
  return new Map([[2, intents]]);
}

/** Un aliado del mago 1 en el equipo 0. */
function withAlly(rivalPos: { x: number; z: number }, allyPos: { x: number; z: number }) {
  return createMatch(
    {
      seed: 1,
      deathRule: 'spectre',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: rivalPos },
        { team: 0, spawn: allyPos },
      ],
    },
    rules,
  );
}

describe('Grandes hechizos, cuarta tanda: terreno', () => {
  it('la Erupción corta el paso y sus rocas queman alrededor', () => {
    const state = scene([{ x: 0, z: 9 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'brasa', 'marea']));
    const volcano = state.spells.find((s) => s.kind === 'field' && s.mode === 'volcano');
    expect(volcano).toBeDefined();
    expect(liveRules(state, rules).map.obstacles).toHaveLength(1);
    run(state, spells.eruption.durationTicks);
    expect(state.spells.some((s) => s.kind === 'field')).toBe(false);
    expect(liveRules(state, rules).map.obstacles).toHaveLength(0);
  });

  it('el Monzón lanza rayos a los rivales que están adentro', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + spells.monsoon.intervalTicks * 2, cast(['brasa', 'tormenta', 'marea']));
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(100 - spells.monsoon.damage * 2);
  });

  it('dentro del Humo de hoguera nadie se ve desde afuera', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 2, cast(['brasa', 'raiz', 'marea']));
    expect(isHiddenFrom(wizard(state, 2), wizard(state, 1), rules)).toBe(true);
  });

  it('junto a la Hoguera los elementos descansan el doble de rápido', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'raiz', 'raiz']));
    const before = wizard(state, 1).fatigue.brasa;
    run(state, 10);
    expect(before - wizard(state, 1).fatigue.brasa).toBe(10 * statuses.kindled.restMultiplier);
  });

  it('en Marchitar los rivales no descansan', () => {
    const state = scene([{ x: 0, z: 7 }]);
    wizard(state, 2).fatigue.brasa = 60;
    run(state, CHANNEL + 30, cast(['raiz', 'umbra', 'raiz']));
    expect(wizard(state, 2).fatigue.brasa).toBeGreaterThan(60 - CHANNEL - 3);
  });

  it('en la Pista de hielo quien entra se desliza hasta el final', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'marea', 'marea']));
    run(state, 2, [{ kind: 'move', x: 0, z: 1 }]);
    expect(wizard(state, 1).leap).not.toBeNull();
    run(state, 40, [{ kind: 'move', x: 0, z: 0 }]);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(10);
  });

  it('el Diluvio no deja saltar ni teletransportarse', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['marea', 'tormenta', 'marea'], { x: 0, z: -1 }));
    rest(state);
    run(state, 12, cast(['tormenta', 'tormenta']));
    // Sin el Diluvio, el Destello lo habría llevado 7 m adelante.
    expect(wizard(state, 1).pos.z).toBeLessThan(1);
  });

  it('el Hongo gigante tapa el paso y suelta esporas al golpearlo', () => {
    const state = scene([{ x: 0, z: 9 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'brasa', 'marea']));
    expect(liveRules(state, rules).map.obstacles).toHaveLength(1);
    // El rival dispara una Chispa contra el hongo, que tiene pegado.
    const mushroom = state.spells.find((s) => s.kind === 'summon' && s.summon === 'mushroom');
    if (mushroom?.kind !== 'summon') throw new Error('sin hongo');
    wizard(state, 2).pos = { x: mushroom.pos.x, z: mushroom.pos.z + 2.5 };
    run(state, 20, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 2).statuses.slow).toBeDefined();
  });
});

describe('Grandes hechizos, cuarta tanda: detonadores', () => {
  it('la Granada solar estalla con un hechizo tuyo y no con uno rival', () => {
    const state = scene([{ x: 1, z: 8 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'tormenta', 'brasa']));
    const orb = state.spells.find((s) => s.kind === 'field' && s.mode === 'solarOrb');
    expect(orb).toBeDefined();
    rest(state);
    run(state, 30, cast(['brasa']));
    expect(state.spells.some((s) => s.kind === 'field' && s.mode === 'solarOrb')).toBe(false);
    expect(wizard(state, 2).hp).toBeLessThan(100 - spells.spark.damage);
  });

  it('el Polen explota con un hechizo de Brasa, aunque sea del rival', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'brasa', 'tormenta']));
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(state.spells.some((s) => s.kind === 'field' && s.mode === 'pollen')).toBe(false);
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(100 - spells.pollen.damage);
    expectHp(state, 1, 100 - spells.spark.damage);
  });

  it('la Red eléctrica hace estallar tu Granada solar', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'tormenta', 'brasa']));
    rest(state);
    run(state, CHANNEL + 1, cast(['tormenta', 'raiz', 'raiz']));
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(100 - spells.solarGrenade.damage);
  });

  it('el Muñeco vudú pasa al rival el daño que le haces', () => {
    const state = scene([{ x: 6, z: 6 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'raiz', 'brasa'], { x: 0.7, z: 0.7 }));
    const doll = state.spells.find((s) => s.kind === 'summon' && s.summon === 'voodooDoll');
    if (doll?.kind !== 'summon') throw new Error('sin muñeco');
    rest(state);
    // Le disparas al muñeco, que está frente a ti.
    const dir = {
      x: doll.pos.x / Math.hypot(doll.pos.x, doll.pos.z),
      z: doll.pos.z / Math.hypot(doll.pos.x, doll.pos.z),
    };
    run(state, 20, cast(['brasa'], dir));
    expect(wizard(state, 2).hp).toBeLessThan(100);
  });

  it('la Mandrágora silencia y revela a quien la pisa', () => {
    const state = scene([{ x: 0, z: 12 }]);
    run(state, CHANNEL + spells.mandrake.armTicks + 2, cast(['umbra', 'raiz', 'raiz']));
    wizard(state, 2).pos = { x: 0, z: spells.mandrake.range };
    run(state, 2);
    expect(wizard(state, 2).statuses.silenced).toBeDefined();
    expect(wizard(state, 2).statuses.tracked).toBeDefined();
  });
});

describe('Grandes hechizos, cuarta tanda: carga y ritmo', () => {
  it('la Forja dobla el próximo hechizo de daño', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'marea', 'brasa']));
    rest(state);
    run(state, 15, cast(['brasa']));
    expectHp(state, 2, 100 - spells.spark.damage * 2);
    expect(wizard(state, 1).statuses.forged).toBeUndefined();
  });

  it('la Sobrecarga hace salir un Gran hechizo con el aviso mínimo', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'brasa', 'brasa']));
    rest(state);
    run(state, 1, cast(['marea', 'raiz', 'umbra']));
    expect(wizard(state, 1).channel?.ticksLeft).toBe(rules.weave.castTicksByLength[0] - 1);
  });

  it('el Eco ardiente hace salir el próximo hechizo dos veces', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'umbra', 'umbra']));
    rest(state);
    run(state, statuses.echoing.delayTicks + 20, cast(['brasa']));
    expectHp(state, 2, 100 - spells.spark.damage * 2, 2);
  });

  it('con la Propulsión cada hechizo te da un salto que deja fuego', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'tormenta', 'tormenta']));
    rest(state);
    run(state, 4, cast(['brasa']));
    expect(wizard(state, 1).leap?.trail).toBe('fire');
  });

  it('con el Rocío cada hechizo cura a tu equipo', () => {
    const state = scene([{ x: 15, z: 0 }]);
    wizard(state, 1).hp = 50;
    run(state, CHANNEL + 1, cast(['raiz', 'marea', 'tormenta']));
    rest(state);
    run(state, 4, cast(['brasa']));
    expect(wizard(state, 1).hp).toBe(50 + statuses.dewy.heal);
  });

  it('Fertilizar dobla el daño de tus invocaciones y después vuelve a la normalidad', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, 10, cast(['tormenta', 'raiz']));
    const rod = state.spells.find((s) => s.kind === 'summon' && s.summon === 'lightningRod');
    if (rod?.kind !== 'summon') throw new Error('sin pararrayos');
    rest(state);
    run(state, CHANNEL + 1, cast(['raiz', 'marea', 'brasa']));
    expect(rod.payload.damage).toBe(spells.lightningRod.damage * 2);
    run(state, spells.fertilize.durationTicks);
    expect(rod.payload.damage).toBe(spells.lightningRod.damage);
  });

  it('el Crecimiento acelerado apura el tejido de tu equipo', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 2, cast(['tormenta', 'raiz', 'marea']));
    expect(wizard(state, 1).statuses.quickened).toBeDefined();
  });
});

describe('Grandes hechizos, cuarta tanda: defensas y represalias', () => {
  it('con el Pararrayos humano los proyectiles rivales se vuelven escudo', () => {
    const state = scene([{ x: 2, z: 8 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'brasa', 'tormenta']));
    run(state, 20, [], rules, rival(cast(['brasa'], { x: 0.4, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
    expect(wizard(state, 1).shield).toBe(spells.spark.damage);
  });

  it('el Espejo de agua devuelve el proyectil a quien lo lanzó', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['marea', 'marea', 'umbra']));
    run(state, 30, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
    expectHp(state, 2, 100 - spells.spark.damage);
  });

  it('el Llanto del abismo retiene el proyectil y lo suelta de tu lado', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'marea', 'marea']));
    run(state, 30, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    const held = state.spells.find((s) => s.kind === 'projectile');
    expect(held?.kind === 'projectile' && held.held).toBeTruthy();
    run(state, statuses.wailing.ticks);
    expect(wizard(state, 1).hp).toBe(100);
    expectHp(state, 2, 100 - spells.spark.damage);
  });

  it('la Ortiga devuelve la mitad del daño', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'brasa', 'umbra']));
    run(state, 15, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expectHp(state, 2, 100 - spells.spark.damage * statuses.thorny.reflect);
  });

  it('la Semilla de fuego explota al recibir un golpe', () => {
    const state = scene([{ x: 0, z: 2.5 }]);
    run(state, CHANNEL + 1, cast(['brasa', 'raiz', 'brasa'], { x: 0, z: -1 }));
    expect(wizard(state, 1).statuses.emberSeed).toBeDefined();
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).statuses.emberSeed).toBeUndefined();
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(100 - statuses.emberSeed.damage);
  });

  it('con la Profundidad el golpe llega repartido', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['marea', 'umbra', 'marea']));
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    const hp = wizard(state, 1).hp;
    expect(hp).toBeGreaterThan(100 - spells.spark.damage / 2);
    run(state, statuses.depth.spreadTicks * 2);
    expect(wizard(state, 1).hp).toBeLessThanOrEqual(100 - spells.spark.damage + 1e-6);
  });

  it('el Renacer devuelve a quien cae, una sola vez por ronda', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['marea', 'raiz', 'umbra']));
    wizard(state, 1).hp = 1;
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).fallen).toBeNull();
    expect(wizard(state, 1).hp).toBeCloseTo(
      100 * statuses.rebirth.hpFraction - spells.spark.damage * 0,
      0,
    );
    rest(state);
    run(state, CHANNEL + 1, cast(['marea', 'raiz', 'umbra']));
    expect(wizard(state, 1).statuses.rebirth).toBeUndefined();
  });

  it('la Venganza golpea al marcado cuando quedas muy herido', () => {
    const state = scene([{ x: 0, z: 8 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'umbra', 'raiz']));
    wizard(state, 1).hp = 15;
    run(state, 1);
    expect(wizard(state, 2).hp).toBe(100 - statuses.vengeful.damage);
  });

  it('Mil pasos golpea al rival y te deja intocable', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 2, cast(['tormenta', 'tormenta', 'umbra']));
    expect(wizard(state, 1).statuses.untouchable).toBeDefined();
    run(state, 30);
    expect(wizard(state, 2).hp).toBeLessThanOrEqual(100 - spells.thousandSteps.damage * 2);
  });

  it('el Injerto necesita un aliado y reparte el daño entre los dos', () => {
    const alone = scene([{ x: 0, z: 8 }]);
    run(alone, CHANNEL + 1, cast(['raiz', 'marea', 'raiz']));
    expect(wizard(alone, 1).statuses.grafted).toBeUndefined();
    const state = withAlly({ x: 0, z: 9 }, { x: 0, z: 3 });
    run(state, CHANNEL + 1, cast(['raiz', 'marea', 'raiz']));
    expect(wizard(state, 3).statuses.grafted?.targetId).toBe(1);
    run(state, 15, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expectHp(state, 3, 100 - spells.spark.damage / 2);
    expectHp(state, 1, 100 - spells.spark.damage / 2);
  });
});

describe('Grandes hechizos, cuarta tanda: control y contrahechizos', () => {
  it('el Cortocircuito corta el tejido del rival y lo aturde', () => {
    const state = scene([{ x: 0, z: 6 }]);
    wizard(state, 2).weave = ['brasa', 'brasa'];
    run(state, CHANNEL + 1, cast(['tormenta', 'brasa', 'raiz']));
    expect(wizard(state, 2).weave).toEqual([]);
    expect(wizard(state, 2).statuses.stunned).toBeDefined();
  });

  it('el Instante detiene al rival: no actúa ni recibe daño', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'umbra', 'marea']));
    expect(wizard(state, 2).statuses.halted).toBeDefined();
    rest(state);
    run(state, 10, cast(['brasa']));
    expect(wizard(state, 2).hp).toBe(100);
  });

  it('el Juramento impide que se hagan daño entre ustedes', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'umbra']));
    rest(state);
    run(state, 10, cast(['brasa']), rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
    expect(wizard(state, 2).hp).toBe(100);
  });

  it('el Lamento deja al rival sin daño', () => {
    const state = scene([{ x: 0, z: 4 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'marea', 'brasa']));
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
  });

  it('con la Bruma del olvido el rival no puede repetir su último hechizo', () => {
    const state = scene([{ x: 0, z: 4 }]);
    wizard(state, 2).lastWeave = ['brasa'];
    run(state, CHANNEL + 1, cast(['marea', 'umbra', 'umbra']));
    run(state, 10, [], rules, rival(cast(['brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
  });

  it('el Estruendo cansa el último elemento que usó el rival', () => {
    const state = scene([{ x: 0, z: 4 }]);
    wizard(state, 2).lastWeave = ['raiz', 'umbra'];
    run(state, CHANNEL + 1, cast(['tormenta', 'brasa', 'umbra']));
    expect(wizard(state, 2).fatigue.umbra).toBeGreaterThan(spells.thunderclap.fatigueTicks - 4);
  });

  it('el Círculo de tótems aturde a quien cruza una línea', () => {
    const state = scene([{ x: 0, z: 12 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'tormenta', 'raiz']));
    let stunned = false;
    for (let i = 0; i < 60; i++) {
      run(state, 1, [], rules, rival([{ kind: 'move', x: 0, z: -1 }]));
      stunned ||= wizard(state, 2).statuses.stunned !== undefined;
    }
    expect(stunned).toBe(true);
  });

  it('con un solo rival, el Rayo de enlace lo une a ti y lo aturde si se aleja', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'umbra', 'raiz']));
    run(state, 30, [], rules, rival([{ kind: 'move', x: 0, z: 1 }]));
    expect(wizard(state, 2).statuses.stunned).toBeDefined();
    expect(wizard(state, 1).statuses.stunned).toBeUndefined();
  });

  it('el Mal de ojo cambia los botones del rival de 1 a 4 lugares', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'marea']));
    const shift = wizard(state, 2).statuses.hexed?.power ?? 0;
    expect(shift).toBeGreaterThanOrEqual(1);
    expect(shift).toBeLessThanOrEqual(4);
  });

  it('la Podredumbre hace que curarse duela', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'marea', 'umbra']));
    wizard(state, 2).statuses.regen = { ticks: 30, sourceId: 2 };
    run(state, 30);
    expect(wizard(state, 2).hp).toBeLessThan(100);
  });

  it('la Sombra fatal solo derriba a quien tiene poca vida', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'brasa']));
    expect(wizard(state, 2).hp).toBe(100);
    wizard(state, 2).hp = 20;
    rest(state);
    run(state, CHANNEL + 1, cast(['umbra', 'brasa', 'brasa']));
    expect(wizard(state, 2).fallen).not.toBeNull();
  });
});

describe('Grandes hechizos, cuarta tanda: copias, tiempo y economía', () => {
  it('el Reflejo copia el último hechizo del rival y sale en tu próximo lanzamiento', () => {
    const state = scene([{ x: 0, z: 5 }]);
    wizard(state, 2).lastWeave = ['brasa', 'brasa'];
    run(state, CHANNEL + 1, cast(['marea', 'tormenta', 'umbra']));
    expect(wizard(state, 1).held?.spell).toBe('fireball');
    rest(state);
    run(state, 30, cast(['raiz']));
    expectHp(state, 2, 100 - spells.fireball.damage);
  });

  it('el Hurto te deja el próximo hechizo del rival', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['raiz', 'umbra', 'umbra']));
    run(state, 10, [], rules, rival(cast(['brasa', 'brasa'], { x: 0, z: -1 })));
    expect(wizard(state, 1).hp).toBe(100);
    expect(wizard(state, 1).held?.spell).toBe('fireball');
  });

  it('el Retroceso te devuelve a donde estabas, con la vida de entonces', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, 100, [{ kind: 'move', x: 0, z: 1 }]);
    wizard(state, 1).hp = 40;
    run(state, CHANNEL + 1, [
      { kind: 'move', x: 0, z: 0 },
      ...cast(['tormenta', 'umbra', 'brasa']),
    ]);
    expect(wizard(state, 1).hp).toBe(100);
    expect(wizard(state, 1).pos.z).toBeLessThan(8);
  });

  it('la Transfusión intercambia el porcentaje de vida una sola vez por ronda', () => {
    const state = scene([{ x: 0, z: 6 }]);
    wizard(state, 1).hp = 30;
    run(state, CHANNEL + 1, cast(['umbra', 'marea', 'umbra']));
    expect(wizard(state, 1).hp).toBe(100);
    expect(wizard(state, 2).hp).toBe(30);
    expect(wizard(state, 1).spent).toContain('transfusion');
  });

  it('el Sifón roba una Esencia o, si no hay, un descanso', () => {
    const state = scene([{ x: 0, z: 6 }]);
    wizard(state, 2).essence.raiz = 2;
    run(state, CHANNEL + 20, cast(['marea', 'tormenta', 'brasa']));
    expect(wizard(state, 1).essence.raiz).toBe(1);
    expect(wizard(state, 2).essence.raiz).toBe(1);
  });

  it('la Cosecha de almas da Esencia por un golpe fuerte', () => {
    const state = scene([{ x: 0, z: 5 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'raiz', 'marea']));
    rest(state);
    run(state, 40, cast(['brasa', 'brasa']));
    expect(wizard(state, 1).essence.brasa).toBe(1);
  });

  it('el Hambre de ceniza te descansa y cura cuando el marcado queda muy herido', () => {
    const state = scene([{ x: 0, z: 6 }]);
    wizard(state, 1).hp = 50;
    run(state, CHANNEL + 1, cast(['brasa', 'umbra', 'raiz']));
    wizard(state, 2).hp = 20;
    run(state, 1);
    expect(wizard(state, 1).hp).toBe(50 + spells.ashHunger.heal);
    expect(wizard(state, 1).fatigue.umbra).toBe(0);
  });
});

describe('Grandes hechizos, cuarta tanda: movilidad y apoyo', () => {
  it('la Tirolesa te lleva al otro extremo del cable', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 30, cast(['tormenta', 'raiz', 'tormenta']));
    expect(wizard(state, 1).pos.z).toBeGreaterThan(spells.zipline.length - 2);
  });

  it('en los Nenúfares pisar una hoja te lleva a otra', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['marea', 'raiz', 'tormenta']));
    // Te bajas de la hoja y vuelves a pisarla caminando hacia adelante.
    wizard(state, 1).pos = { x: 0, z: -2 };
    run(state, 1);
    run(state, 20, [{ kind: 'move', x: 0, z: 1 }]);
    expect(wizard(state, 1).pos.z).toBeGreaterThan(spells.lilyPads.spread);
  });

  it('con la Sombra lanzada, tocar ✦ sin tejer te lleva a ella', () => {
    const state = scene([{ x: 15, z: 0 }]);
    run(state, CHANNEL + 1, cast(['umbra', 'tormenta', 'brasa']));
    run(state, 1, [{ kind: 'cast', dirX: 0, dirZ: 0 }]);
    expect(wizard(state, 1).pos.z).toBeCloseTo(spells.thrownShadow.distance, 0);
  });

  it('el Relámpago guiado se dirige con el pulgar de moverte', () => {
    // El rayo sale hacia adelante y, con el pulgar a la derecha, dobla hasta el rival.
    const state = scene([{ x: 8, z: 5 }]);
    run(state, CHANNEL + 1, cast(['tormenta', 'raiz', 'brasa'], { x: 0, z: 1 }));
    expect(wizard(state, 1).statuses.steering).toBeDefined();
    // Mientras dirige no camina, aunque empuje el pulgar.
    for (let i = 0; i < 50 && wizard(state, 2).hp === 100; i++) {
      run(state, 1, [{ kind: 'move', x: 1, z: 0 }]);
      expect(wizard(state, 1).pos.x).toBe(0);
    }
    expect(wizard(state, 2).hp).toBe(100 - spells.guidedBolt.damage);
  });

  it('el Vendaval apaga las invocaciones y zonas rivales', () => {
    const state = scene([{ x: 0, z: 6 }]);
    run(state, 12, [], rules, rival(cast(['raiz', 'umbra'], { x: 0, z: -1 })));
    expect(state.spells.some((s) => s.kind === 'zone' && s.team === 1)).toBe(true);
    run(state, CHANNEL + 1, cast(['tormenta', 'marea', 'umbra']));
    expect(state.spells.some((s) => s.kind === 'zone' && s.team === 1)).toBe(false);
  });

  it('la Sequía deshace un Muro de hielo y te cura', () => {
    const state = scene([{ x: 0, z: 10 }]);
    wizard(state, 1).hp = 50;
    run(state, 10, [], rules, rival(cast(['marea', 'marea'], { x: 0, z: -1 })));
    wizard(state, 2).pos = { x: 0, z: 5 };
    run(state, CHANNEL + 1, cast(['raiz', 'marea', 'marea']));
    expect(state.spells.some((s) => s.kind === 'wall')).toBe(false);
    expect(wizard(state, 1).hp).toBe(50 + spells.drought.healPerItem);
  });

  it('el paso sigue siendo determinista con los hechizos nuevos', () => {
    const play = (): string => {
      const state = scene([{ x: 0, z: 6 }]);
      const plan: Intent[][] = [
        cast(['brasa', 'brasa', 'marea']),
        cast(['tormenta', 'tormenta', 'umbra']),
        cast(['umbra', 'brasa', 'marea']),
      ];
      for (const intents of plan) {
        rest(state);
        for (let i = 0; i < 40; i++) {
          stepMatch(state, new Map([[1, i === 0 ? intents : []]]), rules);
        }
      }
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });
});
