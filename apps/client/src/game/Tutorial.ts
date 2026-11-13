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
  | { readonly kind: 'release'; readonly spell: SpellId }
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

/** El básico de cada elemento: lo que sale tocándolo solo. */
const BASICS: Readonly<Record<ElementId, SpellId>> = {
  brasa: 'spark',
  tormenta: 'step',
  marea: 'splash',
  raiz: 'sap',
  umbra: 'claw',
};

/** Cómo se teje un hechizo, con el signo de cada elemento: "{tormenta}, {brasa}". */
const weaveText = (spell: SpellId): string => SPELL_WEAVES[spell].map((e) => `{${e}}`).join(', ');

/** Lo nuevo de la barra de botones que pide tejer este hechizo. */
function newParts(spell: SpellId, shown: Set<HudPart>): ElementId[] {
  const fresh = [...new Set(SPELL_WEAVES[spell])].filter((e) => !shown.has(e));
  for (const element of fresh) shown.add(element);
  return fresh;
}

/** Un paso que pide tejer un hechizo de la escuela; si trae un elemento nuevo, lo presenta. */
function spellStep(school: School, spell: SpellId, shown: Set<HudPart>): TutorialStep {
  const fresh = newParts(spell, shown);
  const name = SPELL_NAMES[spell];
  const intro = fresh.length > 0 ? `Llega ${fresh.map((e) => `{${e}}`).join(' y ')}. ` : '';
  return {
    title: name,
    short: `Teje ${name}`,
    text: `${intro}${weaveText(spell)} y ✦: ${name}. ${school.roles[spell] ?? ''}.`,
    goal: { kind: 'release', spell },
    spell,
    ...(fresh.length > 0 ? { reveal: fresh, glow: fresh[0] } : {}),
  };
}

/**
 * El tutorial de una escuela, en capítulos que se pueden repetir: del objetivo del juego hasta
 * un examen contra la IA Aprendiz. La barra de botones se va abriendo: primero solo moverse y
 * la cámara, después el elemento de tu escuela, y cada elemento nuevo aparece cuando un hechizo
 * de tu set lo pide. Enseña los 4 hechizos de la escuela (y Paso para esquivar), no el resto.
 * Al terminar el capítulo de combos se entrega el combo de la escuela. Los capítulos `extra`
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
          text: `Eres de la ${school.name}. Gana la ronda el último mago en pie, y la partida, quien gane 2 rondas. La zona se va cerrando y quema.`,
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
          short: 'Camina con el pulgar izquierdo',
          text: 'Toca la mitad izquierda de la pantalla y arrastra: el joystick aparece donde pones el pulgar.',
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
          short: 'Arrastra en el centro para mirar',
          text: 'Arrastra un dedo por el centro de la pantalla. La mitad izquierda es para caminar.',
          goal: { kind: 'signal', signal: 'look' },
          dummy: 'near',
        },
        {
          title: 'Fijar',
          short: 'Toca al muñeco para fijarlo',
          text: 'Tocar a un rival lo fija: la cámara lo mantiene al frente, un anillo lo marca y tus hechizos le apuntan solos.',
          goal: { kind: 'lock' },
        },
        {
          title: 'Saltar entre rivales',
          short: 'Salta al otro muñeco con el botón',
          text: 'Llegó otro muñeco. El botón de las cuatro esquinas salta al siguiente rival. También puedes tocar directo al que quieras.',
          goal: { kind: 'switch' },
          secondDummy: true,
          reveal: ['duel'],
          glow: 'duel',
        },
        {
          title: 'Soltar',
          short: 'Gira la cámara para soltar al rival',
          text: 'Arrastrar para mirar suelta al rival fijado. Para volver a fijarlo, tócalo otra vez.',
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
          text: `{${element}} es el elemento de tu escuela. Tócalo y después ✦: sale ${SPELL_NAMES[basic]}. Los números rojos son el daño que haces.`,
          goal: { kind: 'release', spell: basic },
          spell: basic,
          dummy: 'idle',
          reveal: [element, 'cast'],
          glow: element,
        },
        {
          title: 'Deshacer',
          short: `Toca {${element}} y deshazlo con ↺`,
          text: 'Lo que tocas se va tejiendo arriba de ✦. Si te equivocas, la flecha que gira lo deshace sin gastar nada.',
          goal: { kind: 'undo' },
          reveal: ['undo'],
          glow: 'undo',
        },
        {
          title: 'El descanso',
          text: `Al lanzar, el botón de {${element}} se apaga unos segundos: descansa. Mientras, usa otro elemento. No hay maná: solo descanso.`,
          goal: { kind: 'read' },
        },
      ],
    },
    {
      id: 'tejer',
      title: 'Tejer',
      steps: [
        {
          title: 'El orden importa',
          text: 'Toca hasta tres elementos antes de ✦: cada tejido es un hechizo propio, y el orden lo cambia. Tu escuela te enseña estos.',
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
          text: `${step.text} Los de tres elementos tardan más en salir y cansan los tres.`,
        })),
      ],
    },
    {
      id: 'esquivar',
      title: 'Esquivar',
      steps: [
        {
          title: 'Leer al rival',
          text: 'Ahora el muñeco ataca. Lo que teje flota sobre su cabeza: si ves {brasa}, viene una Chispa.',
          goal: { kind: 'read' },
          dummy: 'sparks',
        },
        {
          title: 'Paso',
          short: 'Esquiva dos Chispas',
          text: `${dodgeFresh.length > 0 ? 'Llega {tormenta}. ' : ''}Al ver {brasa} sobre el muñeco, camina de lado o usa Paso: {tormenta} y ✦ arrastrando hacia un lado.`,
          goal: { kind: 'avoid', count: 2 },
          spell: 'step',
          ...(dodgeFresh.length > 0 ? { reveal: dodgeFresh, glow: 'tormenta' as const } : {}),
        },
      ],
    },
    {
      id: 'apuntar',
      title: 'Apuntar',
      steps: [
        {
          title: 'Elegir la dirección',
          short: 'Arrastra desde ✦ para elegir dirección',
          text: 'Tocar ✦ apunta solo. Arrastrar desde ✦ elige hacia dónde sale el hechizo.',
          goal: { kind: 'aimed' },
          dummy: 'idle',
          glow: 'cast',
        },
        ...(placed
          ? [
              {
                title: 'Hechizos de suelo',
                short: `Deja ${SPELL_NAMES[placed]} donde quieras`,
                text: `Teje ${SPELL_NAMES[placed]} (${weaveText(placed)}), mantén ✦ un momento y arrastra para elegir dónde cae.`,
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
          title: 'Seguidillas',
          text: 'Un combo es una seguidilla de hechizos que encaja. No da premio extra: el premio es descubrirlo.',
          goal: { kind: 'read' },
          dummy: 'idle',
        },
        {
          title: schoolCombo.name,
          short: school.comboTip?.short ?? `${schoolCombo.name}: ${first}, luego ${second}`,
          text: school.comboTip?.text ?? schoolCombo.detail,
          goal: schoolCombo.reaction
            ? { kind: 'reaction', reaction: schoolCombo.reaction }
            : { kind: 'combo', comboId: schoolCombo.id },
          combo: schoolCombo,
        },
        {
          title: 'Tu primer combo',
          text: `${schoolCombo.name} queda en tu Grimorio. Los demás se descubren jugando: acierta uno 3 veces en partidas y se anota.`,
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
          text: `Los hechizos de tu escuela quedan destacados en el Grimorio. Los otros elementos también son tuyos: tejiéndolos descubres los 155 hechizos.`,
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
          text: `Ahora pelea un mago Aprendiz de la ${examSchool(element).name}: se mueve, esquiva y ataca. Usa lo que aprendiste.`,
          goal: { kind: 'read' },
          dummy: 'idle',
        },
        {
          title: 'Derrota al Aprendiz',
          short: 'Derrota al Aprendiz',
          text: 'Gana el duelo. Si te deja mal, tu vida vuelve: aquí no se pierde.',
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

/** El rival del examen: el Aprendiz de la escuela siguiente. */
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
        short: 'Arrastra ✦ con Salpicón hacia la Chispa',
        text: 'Un elemento opuesto desarma un proyectil: contra {brasa}, {marea} o {raiz}. Teje {marea} y arrastra ✦ hacia la Chispa que viene.',
        goal: { kind: 'clash' },
        spell: 'splash',
        dummy: 'sparks',
      },
      {
        title: 'Lo que cae del cielo',
        short: 'Sal del círculo antes de que caiga',
        text: 'El Meteoro no se desarma. Cuando veas el círculo en el suelo, sal de él.',
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
        text: 'Muchos hechizos dejan un estado: quemado, congelado, empapado, enraizado… Golpear un estado con el elemento justo provoca una reacción.',
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
        text: 'Lanza Era de hielo ({marea}, {marea}, {marea}). Cuando lo congele, suéltale un Rayo en cadena ({tormenta}, {brasa}).',
        goal: { kind: 'reaction', reaction: 'shatter' },
        combo: combo('quiebre'),
      },
    ],
  },
];

/** Los capítulos que se recorren de corrido (sin Más técnicas). */
export const mainChapters = (chapters: readonly TutorialChapter[]): number =>
  chapters.filter((c) => !c.extra).length;

/** El capítulo que entrega el combo de la escuela al terminarse. */
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
    /** Los capítulos de tu escuela (ver `tutorialChapters`). */
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
    return '';
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
        reached = mine.some((e) => e.spell === goal.spell);
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
