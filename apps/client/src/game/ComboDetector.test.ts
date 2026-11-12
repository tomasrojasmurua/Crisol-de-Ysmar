import { COMBO_UNDETECTABLE, COMBOS, DUEL_RULES } from '@crisol/content';
import {
  createMatch,
  type ElementId,
  type GameEvent,
  type Intent,
  type MatchState,
  SPELL_WEAVES,
  type SpellId,
  stepMatch,
} from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { ComboDetector } from './ComboDetector';

const rules = DUEL_RULES;

/** Tú (1) en el origen y un rival (2) a `distance` metros. */
function duel(distance: number): MatchState {
  return createMatch(
    {
      seed: 7,
      deathRule: 'spectre',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: 0, z: distance } },
      ],
    },
    rules,
  );
}

/** Tejer y lanzar un hechizo apuntando a otro mago, como haría el dedo. */
function castAt(state: MatchState, spell: SpellId, from = 1, to = 2, reach?: number): Intent[] {
  const a = state.wizards.find((w) => w.id === from);
  const b = state.wizards.find((w) => w.id === to);
  const dx = (b?.pos.x ?? 0) - (a?.pos.x ?? 0);
  const dz = (b?.pos.z ?? 1) - (a?.pos.z ?? 0);
  const length = Math.hypot(dx, dz) || 1;
  return [
    ...SPELL_WEAVES[spell].map((element: ElementId): Intent => ({ kind: 'weave', element })),
    {
      kind: 'cast',
      dirX: dx / length,
      dirZ: dz / length,
      ...(reach === undefined ? {} : { reach }),
    },
  ];
}

type Rival = (tick: number, state: MatchState) => Intent[];
const still: Rival = () => [];
const stepAside: Rival = (tick) => (tick > 40 ? [{ kind: 'move', x: 1, z: 0 }] : []);

/** Juega `seconds` lanzando `script` (paso → hechizo) y devuelve los combos que salieron. */
function play(
  distance: number,
  script: readonly (readonly [number, SpellId])[],
  options: { rival?: Rival; setup?: (state: MatchState) => void; seconds?: number } = {},
): string[] {
  const state = duel(distance);
  options.setup?.(state);
  const detector = new ComboDetector(1);
  const byTick = new Map(script);
  const found: string[] = [];
  for (let tick = 0; tick < (options.seconds ?? 9) * 30; tick++) {
    const spell = byTick.get(tick);
    const mine = spell ? castAt(state, spell) : [];
    stepMatch(
      state,
      new Map([
        [1, mine],
        [2, (options.rival ?? still)(tick, state)],
      ]),
      rules,
    );
    for (const hit of detector.onStep(state.events, state)) found.push(hit.combo.id);
  }
  return found;
}

/**
 * Los combos que necesitan que el rival o un aliado haga algo, o elegir dónde cae un hechizo,
 * tienen su propia prueba más abajo; el resto se confirma con un rival quieto.
 */
const NEEDS_RIVAL = new Set([
  'silencio-entre-espinas',
  'quieto-o-quemado',
  'bomba-viviente',
  'hambre-y-verdugo',
  'corona-de-fuego',
  'apagon',
  'orbe-y-cadena',
  'tormenta-de-vuelta',
  'escudo-y-hoguera',
  'venganza-y-regreso',
  'sacrificio-y-transfusion',
  'escudo-compartido',
  'jaula-y-respiro',
  'aliado-bomba',
  // Piden que dos rivales te estén atacando o tener a uno encerrado.
  'coraza-y-mil-pasos',
  'hielo-y-fuga',
  'espejo-y-salto',
  'olvido-y-fuga',
  'trueno-y-lluvia',
  'cosecha-en-el-anillo',
  'aguante',
  'doble-y-respiro',
  // Piden elegir dónde cae el hechizo de suelo.
  'cambio-de-cielo',
  'plato-servido',
]);

describe('ComboDetector en la simulación', () => {
  const simple = COMBOS.filter(
    (c) =>
      !c.reaction &&
      !c.unverified &&
      !COMBO_UNDETECTABLE.has(c.id) &&
      !NEEDS_RIVAL.has(c.id) &&
      c.steps.every((s) => 'spell' in s && !s.ally),
  );

  it.each(simple.map((c) => [c.id, c] as const))('%s sale contra un rival quieto', (_, combo) => {
    const spells = combo.steps.map((s) => ('spell' in s ? s.spell : 'spark'));
    // Prueba distancias y esperas entre pasos (algunos piden que un elemento descanse).
    const tries = [3, 6, 9, 12].flatMap((d) => [8, 15, 25, 40, 60, 95].map((gap) => [d, gap]));
    const works = tries.some(([distance = 6, gap = 25]) =>
      play(
        distance,
        spells.map((spell, i) => [1 + i * gap, spell] as const),
      ).includes(combo.id),
    );
    expect(works).toBe(true);
  });

  it('Sueño y lanza: la Lanza cae sobre el rival dormido', () => {
    expect(
      play(7, [
        [0, 'nightmare'],
        [20, 'skySpear'],
      ]),
    ).toContain('sueno-y-lanza');
  });

  it('Silencio entre espinas: silenciado, se quema al cruzar las zarzas', () => {
    const found = play(
      5,
      [
        [0, 'abyss'],
        [25, 'thornRing'],
      ],
      { rival: (tick) => (tick > 45 ? [{ kind: 'move', x: 1, z: 0 }] : []) },
    );
    expect(found).toContain('silencio-entre-espinas');
  });

  it('Quieto o quemado: atado bajo la lluvia de fuego, moverse lo quema', () => {
    const found = play(
      6,
      [
        [0, 'fireRain'],
        [25, 'shackle'],
      ],
      { rival: stepAside },
    );
    expect(found).toContain('quieto-o-quemado');
  });

  it('Hambre y verdugo: bajo 25%, la Sombra fatal lo remata', () => {
    const found = play(
      6,
      [
        [0, 'ashHunger'],
        [60, 'fatalShadow'],
      ],
      {
        setup: (state) => {
          const rival = state.wizards.find((w) => w.id === 2);
          if (rival) rival.hp = 30;
        },
      },
    );
    expect(found).toContain('hambre-y-verdugo');
  });

  it('Bomba viviente: si te pega con la Semilla encima, explota', () => {
    const found = play(
      5,
      [
        [0, 'emberSeed'],
        [20, 'shadowStep'],
      ],
      // Silenciado por el Paso sombrío, recién puede pegarte pasado el segundo.
      { rival: (tick, state) => (tick === 80 ? castAt(state, 'claw', 2, 1) : []) },
    );
    expect(found).toContain('bomba-viviente');
  });

  it('Corona de fuego: quien se acerca se queda quemándose', () => {
    const found = play(
      4,
      [
        [0, 'stormEye'],
        [25, 'immolation'],
      ],
      { rival: (tick) => (tick > 30 ? [{ kind: 'move', x: 0, z: -1 }] : []) },
    );
    expect(found).toContain('corona-de-fuego');
  });

  it('Caer dormido en pareja: la Catapulta del aliado, tu Pesadilla y tu Lanza', () => {
    const state = createMatch(
      {
        seed: 7,
        deathRule: 'spectre',
        wizards: [
          { team: 0, spawn: { x: 0, z: 0 } },
          { team: 1, spawn: { x: 0, z: 9 } },
          { team: 0, spawn: { x: 2, z: 0 } },
        ],
      },
      rules,
    );
    const detector = new ComboDetector(1);
    const found: string[] = [];
    for (let tick = 0; tick < 200; tick++) {
      const mine =
        tick === 30 ? castAt(state, 'nightmare') : tick === 60 ? castAt(state, 'skySpear') : [];
      const ally = tick === 0 ? castAt(state, 'rootCatapult', 3, 2) : [];
      stepMatch(
        state,
        new Map([
          [1, mine],
          [3, ally],
        ]),
        rules,
      );
      for (const hit of detector.onStep(state.events, state)) found.push(hit.combo.id);
    }
    expect(found).toContain('caer-dormido');
  });

  it('la Lanza sola, sin Pesadilla antes, no es combo', () => {
    expect(play(7, [[0, 'skySpear']])).not.toContain('sueno-y-lanza');
  });

  it('otro hechizo tuyo entre medio corta la seguidilla', () => {
    const found = play(7, [
      [0, 'nightmare'],
      [20, 'sap'],
      [45, 'skySpear'],
    ]);
    expect(found).not.toContain('sueno-y-lanza');
  });

  it('el meteoro repetido del Eco ardiente no corta Doble cielo ni lo cuenta dos veces', () => {
    const found = play(6, [
      [1, 'burningEcho'],
      [96, 'meteor'],
    ]);
    expect(found.filter((id) => id === 'doble-cielo')).toHaveLength(1);
  });
});

/** Un mago en la escena: su equipo, dónde parte y, si se quiere, con menos vida. */
interface Spawn {
  readonly team: number;
  readonly x: number;
  readonly z: number;
  readonly hp?: number;
}
/**
 * Qué lanza cada mago (1, 2, 3…) en cada paso, a quién apunta y, en los hechizos de suelo,
 * hasta dónde llega (como al mantener y arrastrar ✦).
 */
type Plan = Record<number, Record<number, readonly [SpellId, number, number?]>>;

/** Escena con varios magos que actúan: tú eres el 1. Devuelve los combos que te salieron. */
function scene(spawns: readonly Spawn[], plan: Plan, ticks = 300): string[] {
  const state = createMatch(
    {
      seed: 7,
      deathRule: 'spectre',
      wizards: spawns.map((p) => ({ team: p.team, spawn: { x: p.x, z: p.z } })),
    },
    rules,
  );
  spawns.forEach((p, i) => {
    const wizard = state.wizards[i];
    if (wizard && p.hp) wizard.hp = p.hp;
  });
  const detector = new ComboDetector(1);
  const found: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const intents = new Map<number, Intent[]>();
    for (const [id, byTick] of Object.entries(plan)) {
      const action = byTick[tick];
      if (action) {
        intents.set(Number(id), castAt(state, action[0], Number(id), action[1], action[2]));
      }
    }
    stepMatch(state, intents, rules);
    for (const hit of detector.onStep(state.events, state)) found.push(hit.combo.id);
  }
  return found;
}

const me = { team: 0, x: 0, z: 0 };

describe('ComboDetector: combos que piden algo del rival o de un aliado', () => {
  it('Apagón: el rival teja, el Cortocircuito lo aturde y lo duermes', () => {
    const found = scene([me, { team: 1, x: 0, z: 5 }], {
      1: { 0: ['shortCircuit', 2], 27: ['nightmare', 2] },
      2: { 25: ['spark', 1] },
    });
    expect(found).toContain('apagon');
  });

  it('dormirlo sin el aturdimiento del Cortocircuito no es Apagón', () => {
    const found = scene([me, { team: 1, x: 0, z: 5 }], {
      1: { 0: ['shortCircuit', 2], 27: ['nightmare', 2] },
    });
    expect(found).not.toContain('apagon');
  });

  it('Orbe y cadena: atado, los rayos del orbe lo alcanzan', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }], {
      1: { 0: ['shackle', 2], 20: ['erraticOrb', 2] },
    });
    expect(found).toContain('orbe-y-cadena');
  });

  it('Tormenta de vuelta: dos rivales disparan y sus proyectiles vuelven tuyos', () => {
    const found = scene(
      [me, { team: 1, x: -3, z: 7 }, { team: 1, x: 3, z: 7 }],
      {
        1: { 0: ['abyssWail', 2], 25: ['humanRod', 2] },
        2: { 50: ['spark', 1] },
        3: { 60: ['fireball', 1] },
      },
      400,
    );
    expect(found).toContain('tormenta-de-vuelta');
  });

  it('Escudo y hoguera: el Pararrayos te da escudo y entras ardiendo', () => {
    const found = scene([me, { team: 1, x: 0, z: 2 }], {
      1: { 0: ['humanRod', 2], 110: ['immolation', 2] },
      2: { 20: ['spark', 1] },
    });
    expect(found).toContain('escudo-y-hoguera');
  });

  it('Venganza y regreso: bajas de 20%, él recibe 45 y vuelves atrás', () => {
    const found = scene(
      [
        { ...me, hp: 40 },
        { team: 1, x: 0, z: 6 },
      ],
      {
        1: { 0: ['vengeance', 2], 110: ['rewind', 2] },
        2: { 25: ['spark', 1] },
      },
    );
    expect(found).toContain('venganza-y-regreso');
  });

  it('sin los 45 de la Venganza, el Retroceso solo no es combo', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }], {
      1: { 0: ['vengeance', 2], 110: ['rewind', 2] },
    });
    expect(found).not.toContain('venganza-y-regreso');
  });

  it('Sacrificio y transfusión: le das vida a tu aliado y le cambias el porcentaje al rival', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }, { team: 0, x: 3, z: 0, hp: 100 }], {
      1: { 0: ['sacrifice', 3], 110: ['transfusion', 2] },
    });
    expect(found).toContain('sacrificio-y-transfusion');
  });

  it('Escudo compartido: te pegan y la burbuja de tu aliado injertado absorbe su parte', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }, { team: 0, x: 3, z: 0 }], {
      1: { 0: ['graft', 3], 100: ['bubble', 3] },
      2: { 130: ['spark', 1] },
    });
    expect(found).toContain('escudo-compartido');
  });

  it('Aliado bomba: la Semilla de tu aliado le explota al rival', () => {
    const found = scene([me, { team: 1, x: 0, z: 5 }, { team: 0, x: 0, z: 3.5 }], {
      1: { 0: ['emberSeed', 3] },
      2: { 30: ['claw', 3] },
    });
    expect(found).toContain('aliado-bomba');
  });

  it('la Semilla puesta en ti no es Aliado bomba', () => {
    const found = scene([me, { team: 1, x: 0, z: 2 }], {
      1: { 0: ['emberSeed', 2] },
      2: { 30: ['claw', 1] },
    });
    expect(found).not.toContain('aliado-bomba');
  });

  it('Cambio de cielo: el meteoro cae sobre ti y cambias de lugar antes', () => {
    const found = scene([me, { team: 1, x: 0, z: 7 }], {
      1: { 0: ['meteor', 2, 0], 20: ['swap', 2] },
    });
    expect(found).toContain('cambio-de-cielo');
  });

  it('Plato servido: dejas la planta a tu lado y él queda junto a su boca', () => {
    const found = scene(
      [me, { team: 1, x: 0, z: 8 }],
      { 1: { 0: ['carnivore', 2, 0.1], 110: ['swap', 2] } },
      400,
    );
    expect(found).toContain('plato-servido');
  });

  it('Jaula y respiro: te curas mientras él sigue encerrado en las zarzas', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }], {
      1: { 0: ['thornRing', 2], 110: ['sap', 1] },
    });
    expect(found).toContain('jaula-y-respiro');
  });
});

describe('ComboDetector: aguantar, devolver y escapar', () => {
  /** Dos rivales al frente que te disparan Chispas en los pasos que se digan. */
  const twoRivals = [me, { team: 1, x: -3, z: 7 }, { team: 1, x: 3, z: 7 }];
  const sparks = (a: number, b: number) => ({
    2: { [a]: ['spark', 1] as const },
    3: { [b]: ['spark', 1] as const },
  });

  it.each([
    ['coraza-y-mil-pasos', { 0: ['obsidian', 2], 40: ['thousandSteps', 2] }, sparks(12, 16)],
    ['hielo-y-fuga', { 0: ['iceCoffin', 2], 60: ['blink', 2] }, sparks(12, 16)],
    ['espejo-y-salto', { 0: ['waterMirror', 2], 60: ['blink', 2] }, sparks(20, 25)],
    ['olvido-y-fuga', { 10: ['oblivionMist', 2], 40: ['blink', 2] }, sparks(0, 5)],
    ['trueno-y-lluvia', { 10: ['thunderclap', 2], 40: ['healingRain', 1] }, sparks(0, 5)],
    ['aguante', { 0: ['depth', 2], 40: ['sap', 1] }, sparks(15, 20)],
    ['doble-y-respiro', { 15: ['decoy', 2], 40: ['sap', 1] }, sparks(0, 5)],
  ] as const)('%s sale cuando dos rivales te atacan', (id, mine, theirs) => {
    expect(scene(twoRivals, { 1: mine as Plan[number], ...theirs })).toContain(id);
  });

  it('sin dos rivales atacándote, Hielo y fuga no cuenta', () => {
    const found = scene(twoRivals, { 1: { 0: ['iceCoffin', 2], 60: ['blink', 2] } });
    expect(found).not.toContain('hielo-y-fuga');
  });

  it('con uno solo atacándote, tampoco', () => {
    const found = scene(twoRivals, {
      1: { 0: ['iceCoffin', 2], 60: ['blink', 2] },
      2: { 12: ['spark', 1], 40: ['spark', 1] },
    });
    expect(found).not.toContain('hielo-y-fuga');
  });

  it('Cosecha en el anillo: la Ola sale con un rival encerrado en tus zarzas', () => {
    const found = scene([me, { team: 1, x: 0, z: 6 }], {
      1: { 0: ['thornRing', 2], 30: ['soulTide', 2] },
    });
    expect(found).toContain('cosecha-en-el-anillo');
  });
});

describe('ComboDetector con eventos armados', () => {
  /** Estado mínimo: tú (1) y un aliado (3) en el equipo 0, un rival (2) en el 1. */
  function fakeState(tick: number, statuses: Record<number, string[]> = {}): MatchState {
    const wizard = (id: number, team: number) => ({
      id,
      team,
      statuses: Object.fromEntries((statuses[id] ?? []).map((s) => [s, { ticks: 30 }])),
    });
    return { tick, wizards: [wizard(1, 0), wizard(3, 0), wizard(2, 1)] } as unknown as MatchState;
  }
  const cast = (wizardId: number): GameEvent => ({ type: 'cast', wizardId, weave: [] });
  const release = (wizardId: number, spell: SpellId): GameEvent => ({
    type: 'release',
    wizardId,
    form: 'projectile',
    spell,
  });
  const hit = (sourceId: number, amount = 20): GameEvent => ({
    type: 'hit',
    targetId: 2,
    sourceId,
    amount,
    form: 'projectile',
  });

  it('Ácido compartido: el Ácido del aliado y tu golpe cuentan para ti', () => {
    const detector = new ComboDetector(1);
    detector.onStep([cast(3), release(3, 'acid')], fakeState(10));
    detector.onStep([cast(1), release(1, 'fireball')], fakeState(40));
    const found = detector.onStep([hit(1)], fakeState(60)).map((h) => h.combo.id);
    expect(found).toContain('acido-compartido');
  });

  it('un combo de equipo no sale si un solo mago puso todos los pasos', () => {
    const detector = new ComboDetector(1);
    detector.onStep([cast(1), release(1, 'acid')], fakeState(10));
    detector.onStep([cast(1), release(1, 'fireball')], fakeState(40));
    const found = detector.onStep([hit(1)], fakeState(60)).map((h) => h.combo.id);
    expect(found).not.toContain('acido-compartido');
  });

  it('los tics de una quemadura no rematan', () => {
    const detector = new ComboDetector(1);
    detector.onStep([cast(1), release(1, 'nightmare')], fakeState(10, { 2: ['asleep'] }));
    detector.onStep([cast(1), release(1, 'skySpear')], fakeState(30, { 2: ['asleep'] }));
    expect(detector.onStep([hit(1, 0.13)], fakeState(40, { 2: ['asleep'] }))).toHaveLength(0);
    expect(detector.onStep([hit(1, 45)], fakeState(60)).map((h) => h.combo.id)).toEqual([
      'sueno-y-lanza',
    ]);
  });

  it('pasado el plazo del remate, ya no cuenta', () => {
    const detector = new ComboDetector(1);
    detector.onStep([cast(1), release(1, 'nightmare')], fakeState(10, { 2: ['asleep'] }));
    detector.onStep([cast(1), release(1, 'skySpear')], fakeState(30, { 2: ['asleep'] }));
    expect(detector.onStep([hit(1)], fakeState(30 + 5 * 30, { 2: ['asleep'] }))).toHaveLength(0);
  });
});
