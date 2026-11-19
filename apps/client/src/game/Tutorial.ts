import { COMBOS, type Combo, SCHOOLS, type School, SPELL_NAMES, schoolOf } from '@crisol/content';
import {
  type ComboId,
  ELEMENT_IDS,
  type ElementId,
  type EntityId,
  type GameEvent,
  type Intent,
  type MatchState,
  PLACED_SPELLS,
  SPELL_WEAVES,
  type SpellId,
  TICK_RATE,
  type Vec2,
} from '@crisol/core';
import { ComboDetector } from './ComboDetector';

/** Qué hace el muñeco mientras dura un paso. */
export type DummyMode =
  /** Quieto: solo recibe. */
  | 'idle'
  /** Se acerca a unos pasos y se queda, sin atacar: para poder fijarlo (y al segundo). */
  | 'near'
  /** Lanza una Chispa cada tanto. */
  | 'sparks'
  /** Prepara Meteoros: Brasa, Brasa, Brasa sobre la cabeza y un círculo en el suelo. */
  | 'meteor'
  /** El examen: un mago de la IA Aprendiz que pelea de verdad. */
  | 'bot';

/** Una pieza de la barra de botones: un elemento, ✦ (lanzar), deshacer o el botón de duelo. */
export type HudPart = ElementId | 'cast' | 'undo' | 'duel';

/** Lo que el tutorial no ve en la partida y le cuenta el celular (girar la cámara). */
export type TutorialSignal = 'look';

/** Qué completa un paso del tutorial. */
type Goal =
  /** Solo se lee: avanza con «Siguiente». */
  | { readonly kind: 'read' }
  | { readonly kind: 'move'; readonly meters: number }
  | { readonly kind: 'signal'; readonly signal: TutorialSignal }
  /** Fijar al muñeco (tocándolo o con el botón de duelo). */
  | { readonly kind: 'lock' }
  /** Soltar al rival fijado (girando la cámara a mano). */
  | { readonly kind: 'unlock' }
  /** Fijar a otro rival que no sea el muñeco (saltar al segundo muñeco). */
  | { readonly kind: 'switch' }
  /**
   * Lanzar este hechizo. Con `land`, solo cuenta si alcanza a un rival: un golpe, un estado o un
   * hechizo que lo ata. Si no, se avisa que no le diste.
   */
  | { readonly kind: 'release'; readonly spell: SpellId; readonly land?: true }
  /** Lanzar cada uno de estos hechizos al menos una vez. */
  | { readonly kind: 'releaseAll'; readonly spells: readonly SpellId[] }
  /** Lanzar tantos hechizos, con elementos distintos seguidos. */
  | { readonly kind: 'releases'; readonly count: number }
  /** Lanzar un hechizo de tantos elementos. */
  | { readonly kind: 'weaveLength'; readonly length: number }
  /** Lanzar arrastrando ✦ (eligiendo la dirección a mano). */
  | { readonly kind: 'aimed' }
  /** Dejar un hechizo de suelo donde uno quiere (mantener ✦ y arrastrar). */
  | { readonly kind: 'placed' }
  /** Que tantos proyectiles del muñeco pasen sin tocarte. */
  | { readonly kind: 'avoid'; readonly count: number }
  /** Que el golpe que cae (el Meteoro) caiga sin tocarte. */
  | { readonly kind: 'avoidStrike' }
  /** Desarmar un proyectil con un choque de tejidos. */
  | { readonly kind: 'clash' }
  | { readonly kind: 'reaction'; readonly reaction: ComboId }
  | { readonly kind: 'combo'; readonly comboId: string }
  /** Derrotar al mago del examen. */
  | { readonly kind: 'defeat' }
  /** Deshacer un tejido con la flecha que gira. */
  | { readonly kind: 'undo' };

export interface TutorialStep {
  readonly title: string;
  /**
   * La orden en una línea, la que queda a la vista mientras juegas (la tarjeta recogida). Si
   * no se dice, se muestra el título: los pasos de leer no la necesitan.
   */
  readonly short?: string;
  /** La explicación completa: se ve al aparecer el paso o al tocar la línea. */
  readonly text: string;
  readonly goal: Goal;
  /** El combo que enseña: se dibuja con sus signos, igual que en el Grimorio. */
  readonly combo?: Combo;
  /** El hechizo que pide tejer: se dibujan sus elementos junto a la orden. */
  readonly spell?: SpellId;
  /** Los elementos que estrena este paso: la guía los anuncia en una etiqueta aparte. */
  readonly fresh?: readonly ElementId[];
  /** Qué hace el muñeco en este paso; si no se dice, sigue como en el paso anterior. */
  readonly dummy?: DummyMode;
  /**
   * Si aparece el segundo muñeco (para saltar entre rivales). Si no se dice, sigue como en el
   * paso anterior del capítulo; al cambiar de capítulo se va.
   */
  readonly secondDummy?: boolean;
  /** Los botones que aparecen en este paso (y quedan desde ahí en adelante). */
  readonly reveal?: readonly HudPart[];
  /** El botón que brilla mientras dura el paso: el que la orden nombra. */
  readonly glow?: HudPart;
}

export interface TutorialChapter {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly TutorialStep[];
  /** Más técnicas: no es parte del recorrido, se elige suelto desde Entrenamiento. */
  readonly extra?: true;
}

const combo = (id: string): Combo => {
  const found = COMBOS.find((c) => c.id === id);
  if (!found) throw new Error(`Falta el combo ${id}`);
  return found;
};

/**
 * Un proyectil esquivado tiene que haber pasado a menos de esto (en metros): que de verdad
 * venía hacia ti. Holgado, porque quien camina de lado al ver la Brasa ya se alejó unos metros.
 */
const CLOSE_CALL = 5;

/**
 * Los hechizos que no se lanzan contra el rival: te mueven, te curan, te protegen, invocan o
 * dejan una zona que solo castiga al que se mueve o al que está cerca (y el muñeco está quieto). Para estos basta con lanzarlos; los demás
 * tienen que alcanzar al muñeco.
 */
const NOT_AIMED_AT_RIVAL: ReadonlySet<SpellId> = new Set<SpellId>([
  'step',
  'sap',
  'comet',
  'spring',
  'garden',
  'fireRain',
  'obsidian',
  'blizzard',
  'tempest',
  'iceAge',
  'mossGuardian',
  'rootCatapult',
  'veil',
  'decoy',
]);

/** El objetivo de lanzar un hechizo: si va contra el rival, tiene que alcanzarlo. */
const releaseGoal = (spell: SpellId): Goal =>
  NOT_AIMED_AT_RIVAL.has(spell)
    ? { kind: 'release', spell }
    : { kind: 'release', spell, land: true };

/**
 * Cuánto se espera a que un hechizo lanzado alcance al muñeco: el Meteoro tarda 1,5 s en caer y
 * una Bola ígnea lenta, algo más de 1 s en cruzar la arena.
 */
const LAND_WINDOW = Math.round(3 * TICK_RATE);
/** Cuánto queda a la vista un aviso de la línea («Fallaste, acércate», «Ese fue Cometa»). */
const NOTICE_TICKS = Math.round(3 * TICK_RATE);

/** Pasado este tiempo en un paso sin cumplirlo, la guía da una pista y hace brillar un botón. */
export const STUCK_TICKS = Math.round(20 * TICK_RATE);

/** La pista de cada tipo de paso, para quien lleva rato sin lograrlo. */
const HINTS: Readonly<Record<Exclude<Goal['kind'], 'read'>, string>> = {
  move: 'Pon el pulgar en la mitad izquierda y arrástralo hacia arriba.',
  signal: 'Arrastra un dedo por el centro de la pantalla, de lado a lado.',
  lock: 'Toca justo encima del muñeco, con un toque corto.',
  unlock: 'Arrastra un dedo por el centro de la pantalla, sin tocar al muñeco.',
  switch: 'Toca el botón que brilla, abajo a la derecha.',
  release: 'Toca los botones en el orden de la línea de arriba y termina con ✦.',
  releaseAll: 'Toca los botones en el orden de la línea de arriba y termina con ✦.',
  releases: 'Lanza con un elemento distinto cada vez.',
  weaveLength: 'Toca tres elementos seguidos y termina con ✦.',
  aimed: 'Toca un elemento, pon el dedo en ✦ y deslízalo hacia un lado antes de soltar.',
  placed: 'Teje el hechizo, deja el dedo quieto en ✦ un momento y después arrástralo.',
  avoid: 'Mira sobre la cabeza del muñeco: cuando aparezca {brasa}, camina hacia un lado.',
  avoidStrike: 'Camina hasta salir del círculo del suelo.',
  clash: 'Espera la Chispa del muñeco y arrastra ✦ con {marea} hacia ella.',
  reaction: 'Lanza el primero y, apenas le dé, el segundo.',
  combo: 'Lanza el primero y, apenas le dé, el segundo.',
  defeat: 'Muévete sin parar y lanza cuando tus botones estén encendidos.',
  undo: 'Toca un elemento: aparece arriba de ✦. Después toca {undo}.',
};

/** El básico de cada elemento: lo que sale tocándolo solo. */
const BASICS: Readonly<Record<ElementId, SpellId>> = {
  brasa: 'spark',
  tormenta: 'step',
  marea: 'splash',
  raiz: 'sap',
  umbra: 'claw',
};

/** Qué sale con el básico de cada elemento, para el primer paso de tu linaje. */
const BASIC_NOTES: Readonly<Record<ElementId, string>> = {
  brasa: 'sale una Chispa. Los números rojos son el daño que haces.',
  tormenta: 'sale un Paso: te mueve rápido unos metros y sirve para esquivar.',
  marea: 'sale un Salpicón. Los números rojos son el daño que haces.',
  raiz: 'sale Savia: te cura un poco.',
  umbra: 'sale una Zarpa. Los números rojos son el daño que haces.',
};

/** Cómo se teje un hechizo, con el signo de cada elemento: "{tormenta}, {brasa}". */
const weaveText = (spell: SpellId): string => SPELL_WEAVES[spell].map((e) => `{${e}}`).join(', ');

/** "Explosión fuerte" → "explosión fuerte", para seguir la frase después de dos puntos. */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Lo nuevo de la barra de botones que pide tejer este hechizo. */
function newParts(spell: SpellId, shown: Set<HudPart>): ElementId[] {
  const fresh = [...new Set(SPELL_WEAVES[spell])].filter((e) => !shown.has(e));
  for (const element of fresh) shown.add(element);
  return fresh;
}

/** Un paso que pide tejer un hechizo del linaje; si trae un elemento nuevo, lo presenta. */
function spellStep(school: School, spell: SpellId, shown: Set<HudPart>): TutorialStep {
  const fresh = newParts(spell, shown);
  const name = SPELL_NAMES[spell];
  const role = school.roles[spell];
  return {
    title: name,
    short: `Lanza ${name}`,
    text: `Toca ${weaveText(spell)} y después ✦.${role ? ` ${name}: ${lowerFirst(role)}.` : ''}`,
    goal: releaseGoal(spell),
    spell,
    ...(fresh.length > 0 ? { reveal: fresh, glow: fresh[0], fresh } : {}),
  };
}

/**
 * El tutorial de un linaje, en capítulos que se pueden repetir: del objetivo del juego hasta
 * un examen contra la IA Aprendiz. La barra de botones se va abriendo: primero solo moverse y
 * la cámara, después el elemento de tu linaje, y cada elemento nuevo aparece cuando un hechizo
 * de tu set lo pide. Enseña los 4 hechizos del linaje (y Paso para esquivar), no el resto.
 * Al terminar el capítulo de combos se entrega el combo del linaje. Los capítulos `extra`
 * (Más técnicas) no son parte del recorrido: se eligen sueltos desde Entrenamiento.
 */
export function tutorialChapters(element: ElementId): readonly TutorialChapter[] {
  const school = schoolOf(element);
  const basic = BASICS[element];
  const shown = new Set<HudPart>([element, 'cast']);
  const woven = school.spells.filter((s) => s !== basic && SPELL_WEAVES[s].length < 3);
  const great = school.spells.filter((s) => SPELL_WEAVES[s].length === 3);
  const tejer = woven.map((spell) => spellStep(school, spell, shown));
  const grand = great.map((spell) => ({
    ...spellStep(school, spell, shown),
    title: `Gran hechizo: ${SPELL_NAMES[spell]}`,
  }));
  const dodgeFresh = newParts('step', shown);
  const placed = [...school.spells].find((s) => PLACED_SPELLS.has(s));
  const schoolCombo = combo(school.combo);
  const [first, second] = schoolCombo.steps.map((step) =>
    'spell' in step ? SPELL_NAMES[step.spell] : 'element' in step ? `{${step.element}}` : '',
  );
  const chapters: TutorialChapter[] = [
    {
      id: 'objetivo',
      title: 'El duelo',
      steps: [
        {
          title: 'Cómo se gana',
          text: `Eres del ${school.name}. Deja al rival sin vida y ganas la ronda. Gana 2 rondas y ganas el duelo.`,
          goal: { kind: 'read' },
          dummy: 'idle',
        },
      ],
    },
    {
      id: 'moverse',
      title: 'Moverse',
      steps: [
        {
          title: 'Caminar',
          short: 'Arrastra el pulgar izquierdo para caminar',
          text: 'Ponlo en cualquier parte de la mitad izquierda: ahí aparece el control.',
          goal: { kind: 'move', meters: 4 },
        },
      ],
    },
    {
      id: 'camara',
      title: 'La cámara',
      steps: [
        {
          title: 'Mirar',
          short: 'Arrastra en el centro para girar la cámara',
          text: 'Usa el otro dedo: la mitad izquierda es solo para caminar.',
          goal: { kind: 'signal', signal: 'look' },
          dummy: 'near',
        },
        {
          title: 'Fijar',
          short: 'Toca al muñeco',
          text: 'Queda marcado con un anillo y tus hechizos van solos hacia él.',
          goal: { kind: 'lock' },
        },
        {
          title: 'Saltar entre rivales',
          short: 'Toca {duel} para cambiar de muñeco',
          text: 'Apareció otro. Ese botón pasa al siguiente rival; también puedes tocar al que quieras.',
          goal: { kind: 'switch' },
          secondDummy: true,
          reveal: ['duel'],
          glow: 'duel',
        },
        {
          title: 'Soltar',
          short: 'Arrastra en el centro para soltar al muñeco',
          text: 'Mover la cámara a mano lo suelta. Para marcarlo de nuevo, tócalo.',
          goal: { kind: 'unlock' },
        },
      ],
    },
    {
      id: 'elemento',
      title: 'Tu elemento',
      steps: [
        {
          title: `{${element}}`,
          short: `Toca {${element}} y después ✦`,
          text: `{${element}} es tu elemento. ✦ lanza: ${BASIC_NOTES[element]}`,
          goal: releaseGoal(basic),
          spell: basic,
          dummy: 'idle',
          reveal: [element, 'cast'],
          glow: element,
        },
        {
          title: 'Deshacer',
          short: `Toca {${element}} y después {undo}, sin lanzar`,
          text: 'Lo que tocas se junta arriba de ✦ antes de lanzarlo: a eso le llamamos tejer. {undo} lo borra si te equivocaste y no gasta nada.',
          goal: { kind: 'undo' },
          reveal: ['undo'],
          glow: 'undo',
        },
        {
          title: 'El descanso',
          text: 'Cada vez que lanzas, el botón que usaste se apaga unos segundos para recargarse. Mientras, usa otro elemento.',
          goal: { kind: 'read' },
        },
      ],
    },
    {
      id: 'tejer',
      title: 'Tejer',
      steps: [
        {
          title: 'Combinar elementos',
          text: 'Si tocas 2 o 3 elementos antes de ✦, sale otro hechizo. El orden cuenta: {tormenta} y {brasa} no es lo mismo que {brasa} y {tormenta}. Ahora vienen los de tu linaje.',
          goal: { kind: 'read' },
        },
        ...tejer,
      ],
    },
    {
      id: 'gran',
      title: 'Gran hechizo',
      steps: [
        ...grand.map((step) => ({
          ...step,
          text: `${step.text} Los hechizos de 3 elementos tardan más en salir y apagan los 3 botones un rato.`,
        })),
      ],
    },
    {
      id: 'esquivar',
      title: 'Esquivar',
      steps: [
        {
          title: 'Leer al rival',
          text: 'Ahora el muñeco te ataca. Mira sobre su cabeza: ahí aparece lo que va a lanzar. Si ves {brasa}, viene una Chispa.',
          goal: { kind: 'read' },
          dummy: 'sparks',
        },
        {
          title: 'Paso',
          short: 'Esquiva 2 Chispas',
          text: 'Cuando veas {brasa} sobre el muñeco, camina hacia un lado. Truco: toca {tormenta} y arrastra ✦ hacia un lado para dar un Paso rápido.',
          goal: { kind: 'avoid', count: 2 },
          spell: 'step',
          ...(dodgeFresh.length > 0
            ? { reveal: dodgeFresh, glow: 'tormenta' as const, fresh: dodgeFresh }
            : {}),
        },
      ],
    },
    {
      id: 'apuntar',
      title: 'Apuntar',
      steps: [
        {
          title: 'Elegir la dirección',
          short: `Toca {${element}} y arrastra ✦ hacia un lado`,
          text: 'Si solo tocas ✦, el hechizo va al muñeco. Si lo arrastras, sale hacia donde arrastraste.',
          goal: { kind: 'aimed' },
          dummy: 'idle',
          glow: 'cast',
        },
        ...(placed
          ? [
              {
                title: 'Hechizos de suelo',
                short: `Deja ${SPELL_NAMES[placed]} donde quieras`,
                text: `Toca ${weaveText(placed)}. Luego mantén apretado ✦, arrastra hasta el lugar y suelta.`,
                goal: { kind: 'placed' as const },
                spell: placed,
              },
            ]
          : []),
      ],
    },
    {
      id: 'combos',
      title: 'Tu combo',
      steps: [
        {
          title: 'Combos',
          text: 'Un combo son dos hechizos seguidos que se ayudan. Ahora aprendes el de tu linaje.',
          goal: { kind: 'read' },
          dummy: 'idle',
        },
        {
          title: schoolCombo.name,
          short: school.comboTip.short ?? `Primero ${first}, después ${second}`,
          text: school.comboTip.text,
          goal: schoolCombo.reaction
            ? { kind: 'reaction', reaction: schoolCombo.reaction }
            : { kind: 'combo', comboId: schoolCombo.id },
          combo: schoolCombo,
        },
        {
          title: 'Tu primer combo',
          text: `${schoolCombo.name} quedó guardado en tu Grimorio. Hay más combos escondidos: cuando hagas uno 3 veces en partidas, se guarda solo.`,
          goal: { kind: 'read' },
        },
      ],
    },
    {
      id: 'grimorio',
      title: 'El Grimorio',
      steps: [
        {
          title: 'Todo es tuyo',
          text: 'Ya tienes los 5 elementos. Los hechizos de tu linaje salen destacados en el Grimorio, pero puedes combinar cualquier elemento: hay 155 hechizos por descubrir.',
          goal: { kind: 'read' },
          reveal: [...ELEMENT_IDS],
        },
      ],
    },
    {
      id: 'examen',
      title: 'Examen',
      steps: [
        {
          title: 'Un duelo de verdad',
          text: `Último paso: un duelo contra un mago Aprendiz de la ${examSchool(element).name}. Se mueve, esquiva y ataca como un jugador. Ojo: el borde de la arena se cierra y quema.`,
          goal: { kind: 'read' },
          dummy: 'idle',
        },
        {
          title: 'Derrota al Aprendiz',
          short: 'Derrota al Aprendiz',
          text: 'Déjalo sin vida. Si te quedas sin vida, se vuelve a llenar: aquí no puedes perder.',
          goal: { kind: 'defeat' },
          dummy: 'bot',
        },
      ],
    },
    ...EXTRA_CHAPTERS,
  ];
  // Umbra no trae Gran hechizo: sin pasos, el capítulo no va.
  return chapters.filter((chapter) => chapter.steps.length > 0);
}

/** El rival del examen: el Aprendiz del linaje siguiente. */
export function examSchool(element: ElementId): School {
  const index = SCHOOLS.findIndex((s) => s.element === element);
  return SCHOOLS[(index + 1) % SCHOOLS.length] ?? schoolOf(element);
}

/** Más técnicas: fuera del recorrido, para repetir desde Entrenamiento. */
const EXTRA_CHAPTERS: readonly TutorialChapter[] = [
  {
    id: 'defensa',
    title: 'Choque y Meteoro',
    extra: true,
    steps: [
      {
        title: 'Choque de tejidos',
        short: 'Toca {marea} y arrastra ✦ hacia la Chispa',
        text: 'El agua apaga el fuego: un Salpicón contra una Chispa la deshace. Contra {brasa} sirven {marea} o {raiz}.',
        goal: { kind: 'clash' },
        spell: 'splash',
        dummy: 'sparks',
      },
      {
        title: 'Lo que cae del cielo',
        short: 'Sal del círculo antes de que caiga',
        text: 'Ahí va a caer un Meteoro y no se puede frenar.',
        goal: { kind: 'avoidStrike' },
        dummy: 'meteor',
      },
    ],
  },
  {
    id: 'reacciones',
    title: 'Estados y reacciones',
    extra: true,
    steps: [
      {
        title: 'Estados',
        text: 'Muchos hechizos dejan al rival quemado, congelado, empapado o enraizado. Si le pegas con el elemento justo mientras le dura, hay una reacción con efecto extra.',
        goal: { kind: 'read' },
        dummy: 'idle',
      },
      {
        title: 'Brasa maldita',
        short: 'Brasa maldita: Chispa, luego Zarpa',
        text: 'Quema al muñeco con una Chispa ({brasa}) y, mientras arde, golpéalo con Zarpa ({umbra}).',
        goal: { kind: 'reaction', reaction: 'ashenCurse' },
        combo: combo('brasa-maldita'),
      },
      {
        title: 'Quiebre',
        short: 'Quiebre: congela, luego Rayo',
        text: 'Lanza Era de hielo ({marea}, {marea}, {marea}). Cuando lo congele, lanza un Rayo en cadena ({tormenta}, {brasa}).',
        goal: { kind: 'reaction', reaction: 'shatter' },
        combo: combo('quiebre'),
      },
    ],
  },
];

/** Los capítulos que se recorren de corrido (sin Más técnicas). */
export const mainChapters = (chapters: readonly TutorialChapter[]): number =>
  chapters.filter((c) => !c.extra).length;

/** El capítulo que entrega el combo del linaje al terminarse. */
export const GIFT_CHAPTER = 'combos';

/**
 * El tutorial, paso a paso. Lee los eventos de la partida de práctica (y lo que le cuenta el
 * celular, como girar la cámara) para ver si cumpliste lo que pide cada paso. Puede empezar
 * en cualquier capítulo, para repetirlo.
 */
export class Tutorial {
  private chapterIndex: number;
  private stepIndex: number;
  private start: Vec2 | null = null;
  private readonly detector: ComboDetector;
  /** Lo que ya lanzaste en un paso de "lanza estos". */
  private readonly released = new Set<SpellId>();
  private releasedCount = 0;
  private lastElement: string | null = null;
  private avoided = 0;
  /** El último lanzamiento que mandó tu dedo: el hechizo sale unos pasos después. */
  private lastCast: Extract<Intent, { kind: 'cast' }> | null = null;
  private signals = new Set<TutorialSignal>();
  /** Pasos de partida vistos: el reloj para esperar a que un hechizo alcance. */
  private ticks = 0;
  /** Hasta qué paso se espera que el hechizo lanzado alcance al rival; null si no se espera. */
  private landBy: number | null = null;
  /** El aviso de la línea («Fallaste, acércate») y hasta qué paso se muestra. */
  private notice = '';
  private noticeUntil = -1;
  /** Pasos de partida que lleva el paso actual, para saber si te trabaste. */
  private stepTicks = 0;
  /** Cuánto le queda a cada estado que le pusiste a un rival, para ver si le pusiste uno nuevo. */
  private readonly statusTicks = new Map<string, number>();
  /** Proyectiles y golpes del muñeco en el aire: qué son y qué tan cerca te pasaron. */
  private readonly watched = new Map<
    EntityId,
    { readonly kind: 'projectile' | 'strike'; readonly closest: number; readonly threat: boolean }
  >();
  /** Capítulos terminados en esta sesión, en orden. */
  readonly finished: string[] = [];
  /** El modo actual del muñeco. */
  dummy: DummyMode = 'idle';
  /** Si el segundo muñeco está en la arena. */
  secondDummy = false;

  constructor(
    private readonly playerId: EntityId,
    private readonly dummyId: EntityId,
    /** Los capítulos de tu linaje (ver `tutorialChapters`). */
    readonly chapters: readonly TutorialChapter[],
    startChapter = 0,
    /** Si termina al cerrar este capítulo (para repetir uno solo). */
    private readonly onlyOne = false,
    /** El paso del capítulo por donde empezar. */
    startStep = 0,
  ) {
    this.detector = new ComboDetector(playerId);
    this.chapterIndex = Math.max(0, Math.min(startChapter, this.chapters.length - 1));
    const steps = this.chapters[this.chapterIndex]?.steps.length ?? 1;
    this.stepIndex = Math.max(0, Math.min(startStep, steps - 1));
    this.applyDummy();
  }

  get chapter(): TutorialChapter | null {
    if (this.done) return null;
    return this.chapters[this.chapterIndex] ?? null;
  }

  get step(): TutorialStep | null {
    return this.chapter?.steps[this.stepIndex] ?? null;
  }

  get chapterNumber(): number {
    return this.chapterIndex + 1;
  }

  get stepNumber(): number {
    return this.stepIndex + 1;
  }

  get done(): boolean {
    return this.chapterIndex >= this.chapters.length;
  }

  /** Los capítulos del recorrido (sin Más técnicas), para el "3/11" de la guía. */
  get mainCount(): number {
    return mainChapters(this.chapters);
  }

  /**
   * Los botones que se ven ahora: los que aparecieron en los capítulos anteriores y en los pasos
   * de este hasta el actual. Terminado el tutorial, null: todos.
   */
  get hud(): ReadonlySet<HudPart> | null {
    if (this.done) return null;
    const parts = new Set<HudPart>();
    this.chapters.forEach((chapter, c) => {
      if (c > this.chapterIndex) return;
      chapter.steps.forEach((step, i) => {
        if (c < this.chapterIndex || i <= this.stepIndex) {
          for (const part of step.reveal ?? []) parts.add(part);
        }
      });
    });
    return parts;
  }

  /** Cuánto lleva del paso actual, si se cuenta ("3 de 5"); vacío si no. */
  get progress(): string {
    const goal = this.step?.goal;
    if (goal?.kind === 'releaseAll') return `${this.released.size} de ${goal.spells.length}`;
    if (goal?.kind === 'releases') return `${this.releasedCount} de ${goal.count}`;
    if (goal?.kind === 'avoid') return `${this.avoided} de ${goal.count}`;
    if (this.ticks < this.noticeUntil) return this.notice;
    return '';
  }

  /** Si llevas rato en un paso que se hace jugando sin lograrlo. */
  get stuck(): boolean {
    const goal = this.step?.goal;
    return goal !== undefined && goal.kind !== 'read' && this.stepTicks >= STUCK_TICKS;
  }

  /** La pista para quien se trabó en este paso; vacía si no se trabó. */
  get hint(): string {
    const goal = this.step?.goal;
    if (!this.stuck || !goal || goal.kind === 'read') return '';
    if (goal.kind === 'release' && goal.land) return `${HINTS.release} Si fallas, acércate más.`;
    return HINTS[goal.kind];
  }

  /**
   * El botón que brilla: el que nombra el paso; si te trabaste y el paso no nombra ninguno, el
   * primero que hay que tocar.
   */
  get glow(): HudPart | null {
    const step = this.step;
    if (!step) return null;
    if (step.glow || !this.stuck) return step.glow ?? null;
    const goal = step.goal;
    if (goal.kind === 'switch') return 'duel';
    if (goal.kind === 'undo') return 'undo';
    if (goal.kind === 'aimed' || goal.kind === 'placed') return 'cast';
    const spell = step.spell ?? (goal.kind === 'release' ? goal.spell : undefined);
    const first = spell ? SPELL_WEAVES[spell][0] : undefined;
    return first ?? null;
  }

  private say(text: string): void {
    this.notice = text;
    this.noticeUntil = this.ticks + NOTICE_TICKS;
  }

  /** «Siguiente» en un paso que solo se lee. */
  next(): void {
    if (this.step?.goal.kind === 'read') this.advance();
  }

  /** Salta el capítulo actual sin terminarlo (no cuenta como hecho). */
  skipChapter(): void {
    if (this.done) return;
    this.nextChapter(false);
  }

  /** Algo que solo ve el celular, como girar la cámara. Devuelve si avanzó. */
  signal(signal: TutorialSignal): boolean {
    this.signals.add(signal);
    const goal = this.step?.goal;
    if (goal?.kind === 'signal' && goal.signal === signal) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Procesa un paso de la partida, con las intenciones que mandó tu dedo en ese paso.
   * Devuelve si avanzó el tutorial.
   */
  onStep(
    events: readonly GameEvent[],
    state: MatchState,
    intents: readonly Intent[] = [],
  ): boolean {
    const combos = this.detector.onStep(events, state).map((h) => h.combo.id);
    const avoided = this.trackDummyAttacks(events, state);
    this.ticks++;
    this.stepTicks++;
    const landed = this.trackLanded(events, state);
    const goal = this.step?.goal;
    if (!goal) return false;
    const me = state.wizards.find((w) => w.id === this.playerId);
    const mine = events.filter(
      (e): e is Extract<GameEvent, { type: 'release' }> =>
        e.type === 'release' && e.wizardId === this.playerId,
    );
    const sent = intents.find((i): i is Extract<Intent, { kind: 'cast' }> => i.kind === 'cast');
    if (sent) this.lastCast = sent;
    const cast = this.lastCast;
    let reached = false;
    switch (goal.kind) {
      case 'move':
        if (me) {
          this.start ??= me.pos;
          reached = Math.hypot(me.pos.x - this.start.x, me.pos.z - this.start.z) >= goal.meters;
        }
        break;
      case 'signal':
        reached = this.signals.has(goal.signal);
        break;
      case 'lock':
        reached = me?.lockTarget === this.dummyId;
        break;
      case 'unlock':
        reached = me?.lockTarget === null;
        break;
      case 'switch':
        reached = me !== undefined && me.lockTarget !== null && me.lockTarget !== this.dummyId;
        break;
      case 'release':
        // Otro hechizo: se avisa cuál salió, para comparar con la receta.
        for (const e of mine)
          if (e.spell !== goal.spell) this.say(`Ese fue ${SPELL_NAMES[e.spell]}`);
        if (!goal.land) {
          reached = mine.some((e) => e.spell === goal.spell);
          break;
        }
        if (mine.some((e) => e.spell === goal.spell)) {
          this.landBy = this.ticks + LAND_WINDOW;
          this.noticeUntil = -1;
        }
        if (this.landBy === null) break;
        reached = landed;
        if (!reached && this.ticks > this.landBy) {
          this.landBy = null;
          this.say('Fallaste, acércate');
        }
        break;
      case 'releaseAll':
        for (const e of mine) if (goal.spells.includes(e.spell)) this.released.add(e.spell);
        reached = goal.spells.every((s) => this.released.has(s));
        break;
      case 'releases':
        for (const e of mine) {
          const first = SPELL_WEAVES[e.spell][0] ?? null;
          // Repetir elemento vuelve a empezar la cuenta.
          this.releasedCount =
            first !== null && first === this.lastElement ? 1 : this.releasedCount + 1;
          this.lastElement = first;
        }
        reached = this.releasedCount >= goal.count;
        break;
      case 'weaveLength':
        reached = mine.some((e) => SPELL_WEAVES[e.spell].length === goal.length);
        break;
      case 'aimed':
        reached = mine.length > 0 && cast !== null && (cast.dirX !== 0 || cast.dirZ !== 0);
        break;
      case 'placed':
        reached = mine.length > 0 && cast?.reach !== undefined;
        break;
      case 'avoid':
        this.avoided += avoided.projectiles;
        reached = this.avoided >= goal.count;
        break;
      case 'avoidStrike':
        reached = avoided.strikes > 0;
        break;
      case 'clash':
        reached = events.some((e) => e.type === 'clash');
        break;
      case 'reaction':
        reached = events.some(
          (e) => e.type === 'combo' && e.sourceId === this.playerId && e.combo === goal.reaction,
        );
        break;
      case 'combo':
        reached = combos.includes(goal.comboId);
        break;
      case 'defeat':
        reached = events.some((e) => e.type === 'defeated' && e.wizardId === this.dummyId);
        break;
      case 'undo':
        reached = intents.some((i) => i.kind === 'cancelWeave');
        break;
      case 'read':
        break;
    }
    if (reached) this.advance();
    return reached;
  }

  /**
   * Si en este paso alcanzaste a un rival: un golpe (aunque lo ataje un escudo), una reacción,
   * un estado nuevo o renovado que viene de ti, o un hechizo tuyo que lo tiene atado (Grillete).
   */
  private trackLanded(events: readonly GameEvent[], state: MatchState): boolean {
    const rival = (id: EntityId): boolean => id !== this.playerId;
    let landed = events.some(
      (e) =>
        (e.type === 'hit' || e.type === 'attacked' || e.type === 'combo') &&
        e.sourceId === this.playerId &&
        rival(e.targetId),
    );
    for (const wizard of state.wizards) {
      if (!rival(wizard.id)) continue;
      for (const [status, instance] of Object.entries(wizard.statuses)) {
        if (!instance) continue;
        const key = `${wizard.id}:${status}`;
        const before = this.statusTicks.get(key) ?? 0;
        if (instance.sourceId === this.playerId && instance.ticks > before) landed = true;
        this.statusTicks.set(key, instance.ticks);
      }
    }
    if (
      state.spells.some(
        (s) =>
          'targetId' in s &&
          s.ownerId === this.playerId &&
          s.targetId !== null &&
          rival(s.targetId),
      )
    ) {
      landed ||= this.landBy !== null;
    }
    return landed;
  }

  /**
   * Sigue los proyectiles y golpes del muñeco: cuando uno desaparece, si en ese paso no te
   * dio, cuenta como esquivado.
   */
  private trackDummyAttacks(
    events: readonly GameEvent[],
    state: MatchState,
  ): { projectiles: number; strikes: number } {
    const me = state.wizards.find((w) => w.id === this.playerId);
    // Un golpe de verdad, no el goteo de una quemadura que sigue de antes.
    const hitMe = events.some(
      (e) =>
        e.type === 'hit' &&
        e.targetId === this.playerId &&
        e.sourceId === this.dummyId &&
        e.amount >= 1,
    );
    const alive = new Set<EntityId>();
    for (const spell of state.spells) {
      if (
        (spell.kind !== 'projectile' && spell.kind !== 'strike') ||
        spell.ownerId !== this.dummyId
      ) {
        continue;
      }
      alive.add(spell.id);
      const d = me ? Math.hypot(spell.pos.x - me.pos.x, spell.pos.z - me.pos.z) : Infinity;
      const before = this.watched.get(spell.id);
      this.watched.set(spell.id, {
        kind: spell.kind,
        closest: Math.min(before?.closest ?? Infinity, d),
        // Un golpe que cae cuenta si su círculo te tenía adentro cuando apareció.
        threat: before?.threat ?? (spell.kind === 'strike' && d < spell.radius + 1),
      });
    }
    const result = { projectiles: 0, strikes: 0 };
    for (const [id, attack] of this.watched) {
      if (alive.has(id)) continue;
      this.watched.delete(id);
      if (hitMe) continue;
      // Solo cuenta lo que de verdad venía hacia ti: un proyectil que pasó cerca, o un golpe
      // que te tenía en su círculo.
      if (attack.kind === 'strike' && attack.threat) result.strikes++;
      if (attack.kind === 'projectile' && attack.closest < CLOSE_CALL) result.projectiles++;
    }
    return result;
  }

  private advance(): void {
    this.stepIndex++;
    this.start = null;
    this.lastCast = null;
    this.released.clear();
    this.releasedCount = 0;
    this.lastElement = null;
    this.avoided = 0;
    this.landBy = null;
    this.noticeUntil = -1;
    this.stepTicks = 0;
    if (this.stepIndex >= (this.chapters[this.chapterIndex]?.steps.length ?? 0)) {
      this.nextChapter(true);
      return;
    }
    this.applyDummy();
  }

  private nextChapter(completed: boolean): void {
    const chapter = this.chapters[this.chapterIndex];
    if (completed && chapter) this.finished.push(chapter.id);
    this.stepIndex = 0;
    this.start = null;
    this.stepTicks = 0;
    this.noticeUntil = -1;
    const next = this.chapterIndex + 1;
    // De corrido, el tutorial termina en el examen: Más técnicas se elige suelto.
    this.chapterIndex = this.onlyOne || this.chapters[next]?.extra ? this.chapters.length : next;
    this.applyDummy();
  }

  /** El modo del muñeco y si está el segundo: lo que diga el paso, o lo último dicho en el capítulo. */
  private applyDummy(): void {
    const chapter = this.chapters[this.chapterIndex];
    if (!chapter) {
      this.dummy = 'idle';
      this.secondDummy = false;
      return;
    }
    let mode: DummyMode = 'idle';
    let second = false;
    for (let i = 0; i <= this.stepIndex; i++) {
      mode = chapter.steps[i]?.dummy ?? mode;
      second = chapter.steps[i]?.secondDummy ?? second;
    }
    this.dummy = mode;
    this.secondDummy = second;
  }
}
