import { DUEL_RULES, schoolSpellbook } from '@crisol/content';
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
import { nextLockTarget } from '../input/lockTargets';
import { DUMMY_ID, SECOND_DUMMY_ID, TrainingMatch } from './TrainingMatch';
import { type HudPart, Tutorial, type TutorialChapter, tutorialChapters } from './Tutorial';

/** Un dedo de mentira: en cada paso hace lo que diga el guion para ese momento. */
class Script implements Controller {
  tick = 0;
  constructor(private readonly plan: (tick: number, state: MatchState) => Intent[]) {}
  intentsFor(state: Readonly<MatchState>): readonly Intent[] {
    return this.plan(this.tick++, state as MatchState);
  }
}

/** La escuela de casi todas las pruebas: Marea (Salpicón, Géiser, Rayo en cadena, Era de hielo). */
const MAREA = tutorialChapters('marea');

const chapterIndex = (id: string, chapters: readonly TutorialChapter[] = MAREA): number =>
  chapters.findIndex((c) => c.id === id);

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
  startStep = 0,
  chapters: readonly TutorialChapter[] = MAREA,
  /** Tu Afinidad: la de tu escuela, como al crear el hechicero. */
  affinity: ElementId | null = null,
): { tutorial: Tutorial; reached: string[]; match: TrainingMatch; withSecond: Set<string> } {
  const match = new TrainingMatch(DUEL_RULES, new Script(plan), affinity);
  match.restless = false;
  const tutorial = new Tutorial(
    match.playerId,
    DUMMY_ID,
    chapters,
    chapterIndex(chapter, chapters),
    true,
    startStep,
  );
  const follow = (): void => {
    match.setDummy(tutorial.dummy);
    match.setSecondDummy(tutorial.secondDummy);
  };
  follow();
  const reached: string[] = [];
  /** Los pasos en que el segundo muñeco estuvo en la arena. */
  const withSecond = new Set<string>();
  for (let i = 0; i < maxTicks && !tutorial.done; i++) {
    if (match.secondDummy) withSecond.add(tutorial.step?.title ?? '');
    if (tutorial.step?.goal.kind === 'read') {
      reached.push(tutorial.step.title);
      tutorial.next();
      follow();
      continue;
    }
    const title = tutorial.step?.title ?? '';
    const events = match.step();
    if (tutorial.onStep(events, match.state, match.lastIntents)) {
      reached.push(title);
      follow();
    }
  }
  return { tutorial, reached, match, withSecond };
}

/** Un guion que lanza estos hechizos al muñeco en esos pasos y, entre medio, se le acerca. */
const castsAt =
  (casts: ReadonlyMap<number, SpellId>) =>
  (tick: number, state: MatchState): Intent[] => {
    const spell = casts.get(tick);
    return spell ? castAt(state, spell) : approach(state);
  };

describe('Tutorial por escuela', () => {
  it('recorre lo básico y la escuela, del objetivo al examen; Más técnicas va aparte', () => {
    expect(MAREA.map((c) => c.id)).toEqual([
      'objetivo',
      'moverse',
      'camara',
      'elemento',
      'tejer',
      'gran',
      'esquivar',
      'apuntar',
      'combos',
      'grimorio',
      'examen',
      'defensa',
      'reacciones',
    ]);
    expect(MAREA.filter((c) => c.extra).map((c) => c.id)).toEqual(['defensa', 'reacciones']);
  });

  it('cada escuela enseña sus 4 hechizos y Paso, y ningún otro', () => {
    for (const element of ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'] as const) {
      const chapters = tutorialChapters(element);
      const taught = new Set(
        chapters
          .filter((c) => !c.extra)
          .flatMap((c) => c.steps)
          .flatMap((s) => (s.spell ? [s.spell] : [])),
      );
      const school = schoolSpellbook(element);
      for (const spell of taught) expect(school).toContain(spell);
      for (const spell of school) expect(taught.has(spell)).toBe(true);
    }
  });

  it('la barra de botones se abre de a poco y al final se ve entera', () => {
    const tutorial = new Tutorial(1, DUMMY_ID, MAREA);
    const at = (id: string): ReadonlySet<HudPart> | null => {
      while (tutorial.chapter && tutorial.chapter.id !== id) tutorial.skipChapter();
      return tutorial.hud;
    };
    expect([...(at('moverse') ?? [])]).toEqual([]);
    expect([...(at('elemento') ?? [])].sort()).toEqual(['cast', 'duel', 'marea'].sort());
    // Ventisca trae Tormenta y Pararrayos trae Raíz: al terminar Tejer ya están.
    expect([...(at('gran') ?? [])].sort()).toEqual(
      ['cast', 'duel', 'marea', 'raiz', 'tormenta', 'undo'].sort(),
    );
    expect(at('examen')?.has('raiz')).toBe(true);
    expect(at('examen')?.has('umbra')).toBe(true);
    while (!tutorial.done) tutorial.skipChapter();
    expect(tutorial.hud).toBeNull();
  });

  it('el elemento nuevo brilla en el paso que lo trae', () => {
    const tejer = MAREA[chapterIndex('tejer')];
    const blizzard = tejer?.steps.find((s) => s.spell === 'blizzard');
    expect(blizzard?.reveal).toEqual(['tormenta']);
    expect(blizzard?.glow).toBe('tormenta');
    expect(blizzard?.text).toContain('{tormenta}');
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
    expect(tutorial.step?.title).toBe('Fijar');
  });

  it('la cámara: fijar, saltar al segundo muñeco (que después se va) y soltar', () => {
    const { tutorial, reached, match, withSecond } = play(
      (tick, state) => {
        // El botón de duelo, como en el celular: solo fija lo que está a tiro. El muñeco se
        // acerca solo; el segundo aparece a su lado.
        const duelButton = (): Intent[] => {
          const next = nextLockTarget(
            state,
            me(state),
            DUEL_RULES,
            { x: 0, z: 1 },
            me(state).lockTarget,
          );
          return next === null ? [] : [{ kind: 'lockTarget', targetId: next }];
        };
        if (tick === 150 || tick === 160) return duelButton();
        // Girar la cámara a mano manda soltar el duelo.
        if (tick === 170) return [{ kind: 'lockTarget', targetId: null }];
        return [];
      },
      'camara',
      200,
      1,
    );
    expect(reached).toEqual(['Fijar', 'Saltar entre rivales', 'Soltar']);
    expect([...withSecond]).toEqual(['Saltar entre rivales', 'Soltar']);
    expect(tutorial.done).toBe(true);
    // Terminada la sección, el segundo muñeco se va.
    expect(match.secondDummy).toBe(false);
  });

  it('el segundo muñeco no está fuera de esa sección: no se ve ni se puede fijar', () => {
    const match = new TrainingMatch(DUEL_RULES, new Script(() => []), null);
    expect(match.secondDummy).toBe(false);
    expect(match.isHidden(SECOND_DUMMY_ID)).toBe(true);
    match.setSecondDummy(true);
    expect(match.isHidden(SECOND_DUMMY_ID)).toBe(false);
    const second = match.state.wizards.find((w) => w.id === SECOND_DUMMY_ID);
    const near = Math.hypot(
      (second?.pos.x ?? 99) - dummy(match.state).pos.x,
      (second?.pos.z ?? 99) - dummy(match.state).pos.z,
    );
    expect(near).toBeLessThan(6);
    match.setSecondDummy(false);
    match.step();
    expect(second?.hp).toBe(0);
    expect(match.isHidden(SECOND_DUMMY_ID)).toBe(true);
  });

  it('tu elemento: el básico, deshacer y el descanso', () => {
    const { tutorial, reached } = play(
      (tick, state) => {
        if (tick === 5) return castAt(state, 'splash');
        if (tick === 120) return [{ kind: 'weave', element: 'marea' }];
        if (tick === 125) return [{ kind: 'cancelWeave' }];
        return [];
      },
      'elemento',
      200,
    );
    expect(reached).toEqual(['{marea}', 'Deshacer', 'El descanso']);
    expect(tutorial.finished).toEqual(['elemento']);
  });

  it('tejer pide los hechizos justos de la escuela: el orden importa', () => {
    // Brasa → Marea (Obsidiana) es otro tejido: no cuenta. Entre uno y otro, los elementos
    // descansan (3 s).
    const casts = new Map<number, SpellId>([
      [5, 'obsidian'],
      [110, 'blizzard'],
      [215, 'lightningRod'],
    ]);
    const plan = (tick: number, state: MatchState): Intent[] => {
      const spell = casts.get(tick);
      return spell ? castAt(state, spell) : [];
    };
    expect(play(plan, 'tejer', 60).tutorial.step?.title).toBe('Ventisca');
    const { tutorial, reached } = play(plan, 'tejer', 300);
    expect(reached).toEqual(['El orden importa', 'Ventisca', 'Pararrayos']);
    expect(tutorial.finished).toEqual(['tejer']);
  });

  it('apuntar: arrastrar ✦ y dejar el hechizo de suelo de tu escuela', () => {
    const { tutorial, reached } = play(
      (tick, state) => {
        if (tick === 5) return castAt(state, 'splash');
        if (tick === 10) return [{ kind: 'cast', dirX: 1, dirZ: 0 }];
        // Después de que Marea descansa del Salpicón.
        if (tick === 110) {
          return [
            { kind: 'weave', element: 'tormenta' },
            { kind: 'weave', element: 'marea' },
          ];
        }
        if (tick > 110 && me(state).weave.length === 2) {
          return [{ kind: 'cast', dirX: 0, dirZ: 1, reach: 0.5 }];
        }
        return [];
      },
      'apuntar',
      300,
    );
    expect(reached).toEqual(['Elegir la dirección', 'Hechizos de suelo']);
    expect(tutorial.done).toBe(true);
  });

  it('esquivar: el muñeco ataca y las Chispas esquivadas se cuentan', () => {
    const { reached } = play(
      (_tick, state) => {
        // Esquiva de verdad: con una Chispa en el aire, corre de lado respecto de su vuelo.
        const spark = state.spells.find((s) => s.kind === 'projectile' && s.ownerId === DUMMY_ID);
        if (spark?.kind !== 'projectile') return [{ kind: 'move', x: 0, z: 0 }];
        const v = Math.hypot(spark.velocity.x, spark.velocity.z) || 1;
        return [{ kind: 'move', x: -spark.velocity.z / v, z: spark.velocity.x / v }];
      },
      'esquivar',
      1500,
    );
    expect(reached).toEqual(['Leer al rival', 'Paso']);
  });

  it('esquivar caminando: con reflejos de persona alcanza al ver la Brasa', () => {
    // Una persona reacciona medio segundo después de ver la Brasa sobre el muñeco y
    // camina de lado un rato; no mira la Chispa en vuelo.
    const REACTION = 15;
    let seenAt = -1;
    let side = 1;
    const { reached } = play(
      (tick, state) => {
        const weaving = dummy(state).weave.length > 0;
        if (weaving && seenAt < 0) {
          seenAt = tick;
          side = -side;
        }
        if (seenAt < 0 || tick < seenAt + REACTION) return [{ kind: 'move', x: 0, z: 0 }];
        if (tick > seenAt + REACTION + 30) {
          seenAt = -1;
          return [{ kind: 'move', x: 0, z: 0 }];
        }
        const dir = toward(me(state).pos, dummy(state).pos);
        return [{ kind: 'move', x: -dir.z * side, z: dir.x * side }];
      },
      'esquivar',
      1500,
    );
    expect(reached).toEqual(['Leer al rival', 'Paso']);
  });

  it('Más técnicas: un Salpicón hacia la Chispa que viene cuenta como choque de tejidos', () => {
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
    const tutorial = new Tutorial(match.playerId, DUMMY_ID, MAREA, chapterIndex('defensa'), true);
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

  it('Más técnicas: las reacciones Brasa maldita y Quiebre', () => {
    const { reached, tutorial } = play(
      castsAt(
        new Map<number, SpellId>([
          [170, 'spark'],
          [195, 'claw'],
          [290, 'iceAge'],
          // El Rayo, recién cuando el hielo ya cayó y lo congeló.
          [325, 'chainLightning'],
        ]),
      ),
      'reacciones',
      600,
    );
    expect(reached).toEqual(['Estados', 'Brasa maldita', 'Quiebre']);
    expect(tutorial.done).toBe(true);
  });

  /**
   * El combo de cada escuela, como lo haría el jugador: primer paso y el segundo apenas
   * descansa el elemento que comparten (3 s, o 2,25 s el de tu Afinidad).
   */
  const SCHOOL_COMBOS: readonly [ElementId, SpellId, SpellId, number][] = [
    ['brasa', 'fireRain', 'fireball', 95],
    ['tormenta', 'lightningRod', 'tempest', 95],
    ['marea', 'lightningRod', 'iceAge', 35],
    ['raiz', 'shackle', 'spring', 70],
    ['umbra', 'blinding', 'drain', 70],
  ];

  it.each(SCHOOL_COMBOS)('el capítulo de combos de %s se completa', (school, a, b, gap) => {
    const chapters = tutorialChapters(school);
    const { reached, tutorial } = play(
      castsAt(
        new Map<number, SpellId>([
          [170, a],
          [170 + gap, b],
        ]),
      ),
      'combos',
      600,
      0,
      chapters,
      school,
    );
    expect(reached).toHaveLength(3);
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

  it('el Aprendiz del examen teje solo los hechizos de su escuela', () => {
    const match = new TrainingMatch(DUEL_RULES, new Script(() => []), null);
    match.restless = false;
    match.examSpellbook = schoolSpellbook('raiz');
    match.setDummy('bot');
    const released = new Set<SpellId>();
    for (let i = 0; i < 900; i++) {
      for (const e of match.step()) {
        if (e.type === 'release' && e.wizardId === DUMMY_ID) released.add(e.spell);
      }
    }
    expect(released.size).toBeGreaterThan(0);
    for (const spell of released) expect(schoolSpellbook('raiz')).toContain(spell);
  });

  it('saltar un capítulo no lo cuenta como hecho', () => {
    const tutorial = new Tutorial(1, DUMMY_ID, MAREA, 0);
    tutorial.skipChapter();
    expect(tutorial.chapter?.id).toBe('moverse');
    expect(tutorial.finished).toEqual([]);
  });

  it('el tutorial entero pasa por los capítulos del recorrido y termina en el examen', () => {
    const tutorial = new Tutorial(1, DUMMY_ID, MAREA, 0);
    const seen: string[] = [];
    while (!tutorial.done) {
      const id = tutorial.chapter?.id;
      if (id && !seen.includes(id)) seen.push(id);
      tutorial.skipChapter();
    }
    expect(seen).toEqual(MAREA.filter((c) => !c.extra).map((c) => c.id));
    expect(tutorial.mainCount).toBe(11);
  });
});
