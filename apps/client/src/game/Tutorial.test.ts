import { DUEL_RULES } from '@crisol/content';
import {
  type Controller,
  type ElementId,
  type Intent,
  type MatchState,
  SPELL_WEAVES,
  type SpellId,
  type Vec2,
} from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { DUMMY_ID, TrainingMatch } from './TrainingMatch';
import { TUTORIAL_CHAPTERS, Tutorial } from './Tutorial';

/** Un dedo de mentira: en cada paso hace lo que diga el guion para ese momento. */
class Script implements Controller {
  tick = 0;
  constructor(private readonly plan: (tick: number, state: MatchState) => Intent[]) {}
  intentsFor(state: Readonly<MatchState>): readonly Intent[] {
    return this.plan(this.tick++, state as MatchState);
  }
}

const chapterIndex = (id: string): number => TUTORIAL_CHAPTERS.findIndex((c) => c.id === id);

function me(state: MatchState) {
  const found = state.wizards.find((w) => w.id === 1);
  if (!found) throw new Error('falta tu mago');
  return found;
}

function dummy(state: MatchState) {
  const found = state.wizards.find((w) => w.id === DUMMY_ID);
  if (!found) throw new Error('falta el muñeco');
  return found;
}

function toward(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

function castAt(state: MatchState, spell: SpellId, at: Vec2 = dummy(state).pos): Intent[] {
  const dir = toward(me(state).pos, at);
  return [
    ...SPELL_WEAVES[spell].map((element: ElementId): Intent => ({ kind: 'weave', element })),
    { kind: 'cast', dirX: dir.x, dirZ: dir.z },
  ];
}

/** Camina hacia el muñeco hasta quedar a unos 5 m. */
function approach(state: MatchState): Intent[] {
  const dir = toward(me(state).pos, dummy(state).pos);
  const d = Math.hypot(dummy(state).pos.x - me(state).pos.x, dummy(state).pos.z - me(state).pos.z);
  return d > 5 ? [{ kind: 'move', x: dir.x, z: dir.z }] : [];
}

/**
 * Juega el tutorial con un guion hasta `maxTicks`; en los pasos de leer, aprieta Siguiente.
 * Devuelve los títulos de los pasos que se completaron, en orden.
 */
function play(
  plan: (tick: number, state: MatchState) => Intent[],
  chapter: string,
  maxTicks: number,
): { tutorial: Tutorial; reached: string[]; match: TrainingMatch } {
  const match = new TrainingMatch(DUEL_RULES, new Script(plan), null);
  match.restless = false;
  const tutorial = new Tutorial(match.playerId, DUMMY_ID, chapterIndex(chapter), true);
  match.setDummy(tutorial.dummy);
  const reached: string[] = [];
  for (let i = 0; i < maxTicks && !tutorial.done; i++) {
    if (tutorial.step?.goal.kind === 'read') {
      reached.push(tutorial.step.title);
      tutorial.next();
      match.setDummy(tutorial.dummy);
      continue;
    }
    const title = tutorial.step?.title ?? '';
    const events = match.step();
    if (tutorial.onStep(events, match.state, match.lastIntents)) {
      reached.push(title);
      match.setDummy(tutorial.dummy);
    }
  }
  return { tutorial, reached, match };
}

describe('Tutorial por capítulos', () => {
  it('tiene los 12 capítulos, del objetivo al examen', () => {
    expect(TUTORIAL_CHAPTERS.map((c) => c.id)).toEqual([
      'objetivo',
      'moverse',
      'camara',
      'elementos',
      'descanso',
      'tejer',
      'apuntar',
      'defensa',
      'reacciones',
      'combos',
      'grimorio',
      'examen',
    ]);
  });

  it('la cámara: mirar llega del celular y el duelo se ve en la partida', () => {
    const { tutorial, reached } = play(
      (tick) => (tick === 3 ? [{ kind: 'lockTarget', targetId: DUMMY_ID }] : []),
      'camara',
      1,
    );
    expect(tutorial.step?.title).toBe('Mirar');
    expect(tutorial.signal('look')).toBe(true);
    expect(reached).toEqual([]);
    expect(tutorial.step?.title).toBe('Duelo');
  });

  it('los cinco básicos se cuentan uno por uno', () => {
    const casts = new Map<number, SpellId>([
      [5, 'spark'],
      [20, 'step'],
      [40, 'splash'],
      [60, 'sap'],
      [80, 'claw'],
    ]);
    const { tutorial, reached } = play(
      (tick, state) => {
        const spell = casts.get(tick);
        return spell ? castAt(state, spell) : [];
      },
      'elementos',
      200,
    );
    expect(reached).toEqual(['Brasa, Tormenta, Marea, Raíz y Umbra', 'Los cinco básicos']);
    expect(tutorial.done).toBe(true);
    expect(tutorial.finished).toEqual(['elementos']);
  });

  it('apuntar distingue arrastrar ✦ y dejar un hechizo de suelo', () => {
    const { tutorial, reached } = play(
      (tick, state) => {
        if (tick === 5)
          return [
            { kind: 'weave', element: 'brasa' },
            { kind: 'cast', dirX: 1, dirZ: 0 },
          ];
        if (tick === 30) {
          return [
            { kind: 'weave', element: 'brasa' },
            { kind: 'weave', element: 'brasa' },
            { kind: 'weave', element: 'brasa' },
          ];
        }
        if (tick > 30 && me(state).weave.length === 3) {
          return [{ kind: 'cast', dirX: 0, dirZ: 1, reach: 0.5 }];
        }
        return [];
      },
      'apuntar',
      200,
    );
    // Brasa descansa entre la Chispa y el Meteoro: si no alcanza, igual se probó el primero.
    expect(reached[0]).toBe('Elegir la dirección');
    expect(tutorial.step?.title ?? 'fin').not.toBe('Elegir la dirección');
  });

  it('defenderse: el muñeco ataca y las Chispas esquivadas se cuentan', () => {
    const { reached, tutorial } = play(
      (_tick, state) => {
        // Esquiva de verdad: con una Chispa en el aire, corre de lado respecto de su vuelo.
        const spark = state.spells.find((s) => s.kind === 'projectile' && s.ownerId === DUMMY_ID);
        if (spark?.kind !== 'projectile') return [{ kind: 'move', x: 0, z: 0 }];
        const v = Math.hypot(spark.velocity.x, spark.velocity.z) || 1;
        return [{ kind: 'move', x: -spark.velocity.z / v, z: spark.velocity.x / v }];
      },
      'defensa',
      1500,
    );
    expect(reached.slice(0, 2)).toEqual(['Leer al rival', 'Esquivar']);
    expect(tutorial.step?.title).toBe('Muro de hielo');
  });

  it('un Salpicón hacia la Chispa que viene cuenta como choque de tejidos', () => {
    const defense = TUTORIAL_CHAPTERS[chapterIndex('defensa')];
    const clashStep = defense?.steps.findIndex((s) => s.goal.kind === 'clash') ?? -1;
    const finger = new Script((_tick, state) => {
      // Espera la Chispa del muñeco y le suelta un Salpicón hacia donde va a estar.
      const spark = state.spells.find((s) => s.kind === 'projectile' && s.ownerId === DUMMY_ID);
      if (spark?.kind !== 'projectile' || me(state).weave.length > 0 || me(state).channel)
        return [];
      const d = Math.hypot(spark.pos.x - me(state).pos.x, spark.pos.z - me(state).pos.z);
      if (d > 7) return [];
      const ahead = {
        x: spark.pos.x + spark.velocity.x * 0.15,
        z: spark.pos.z + spark.velocity.z * 0.15,
      };
      return castAt(state, 'splash', ahead);
    });
    const match = new TrainingMatch(DUEL_RULES, finger, null);
    match.restless = false;
    const tutorial = new Tutorial(
      match.playerId,
      DUMMY_ID,
      chapterIndex('defensa'),
      true,
      clashStep,
    );
    expect(tutorial.step?.title).toBe('Choque de tejidos');
    match.setDummy(tutorial.dummy);
    expect(tutorial.dummy).toBe('sparks');
    let clashed = false;
    for (let i = 0; i < 600 && !clashed; i++) {
      clashed = tutorial.onStep(match.step(), match.state, match.lastIntents);
    }
    expect(clashed).toBe(true);
    expect(tutorial.step?.title).toBe('Lo que cae del cielo');
    expect(tutorial.dummy).toBe('meteor');
  });

  it('las reacciones: Brasa maldita y Quiebre', () => {
    const casts = new Map<number, SpellId>([
      [170, 'spark'],
      [195, 'claw'],
      [290, 'iceAge'],
      // El Rayo, recién cuando el hielo ya cayó y lo congeló.
      [325, 'chainLightning'],
    ]);
    const { reached, tutorial } = play(
      (tick, state) => {
        const spell = casts.get(tick);
        return spell ? castAt(state, spell) : approach(state);
      },
      'reacciones',
      600,
    );
    expect(reached).toEqual(['Estados', 'Brasa maldita', 'Quiebre']);
    expect(tutorial.done).toBe(true);
  });

  it('el capítulo de combos termina con Amarre', () => {
    const casts = new Map<number, SpellId>([
      [170, 'vine'],
      [195, 'splash'],
    ]);
    const { reached, tutorial } = play(
      (tick, state) => {
        const spell = casts.get(tick);
        return spell ? castAt(state, spell) : approach(state);
      },
      'combos',
      300,
    );
    expect(reached).toEqual(['Seguidillas', 'Amarre', 'Tus primeros combos']);
    expect(tutorial.finished).toEqual(['combos']);
  });

  it('el examen: el muñeco se vuelve un Aprendiz que sí cae', () => {
    const { match, tutorial } = play(
      (tick) =>
        tick % 6 === 0
          ? [
              { kind: 'weave', element: 'brasa' },
              { kind: 'cast', dirX: 0, dirZ: 0 },
            ]
          : [],
      'examen',
      1,
    );
    expect(tutorial.step?.title).toBe('Derrota al Aprendiz');
    expect(tutorial.dummy).toBe('bot');
    // Sin cansancio para que el guion dispare seguido; el Aprendiz queda con poca vida.
    match.restless = true;
    dummy(match.state).hp = 4;
    let won = false;
    for (let i = 0; i < 1500 && !won; i++) {
      won = tutorial.onStep(match.step(), match.state, match.lastIntents);
    }
    expect(won).toBe(true);
    expect(tutorial.done).toBe(true);
    // Y se vuelve a parar entero.
    expect(dummy(match.state).hp).toBe(dummy(match.state).maxHp);
  });

  it('saltar un capítulo no lo cuenta como hecho', () => {
    const tutorial = new Tutorial(1, DUMMY_ID, 0);
    tutorial.skipChapter();
    expect(tutorial.chapter?.id).toBe('moverse');
    expect(tutorial.finished).toEqual([]);
  });

  it('el tutorial entero pasa por todos los capítulos en orden', () => {
    const tutorial = new Tutorial(1, DUMMY_ID, 0);
    const seen: string[] = [];
    while (!tutorial.done) {
      const id = tutorial.chapter?.id;
      if (id && !seen.includes(id)) seen.push(id);
      tutorial.skipChapter();
    }
    expect(seen).toEqual(TUTORIAL_CHAPTERS.map((c) => c.id));
  });
});
