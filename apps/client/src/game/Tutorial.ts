import { COMBOS, type Combo } from '@crisol/content';
import {
  type ComboId,
  type EntityId,
  type GameEvent,
  type Intent,
  type MatchState,
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
  | { readonly kind: 'defeat' };

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
}

export interface TutorialChapter {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly TutorialStep[];
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

/** Los cinco básicos, uno por elemento. */
const BASICS: readonly SpellId[] = ['spark', 'step', 'splash', 'sap', 'claw'];

/**
 * El tutorial completo, en capítulos que se pueden repetir: del objetivo del juego hasta un
 * examen contra la IA Aprendiz. Al terminar el capítulo de combos se entregan los 3 primeros.
 */
export const TUTORIAL_CHAPTERS: readonly TutorialChapter[] = [
  {
    id: 'objetivo',
    title: 'El duelo',
    steps: [
      {
        title: 'Cómo se gana',
        text: 'Gana la ronda el último mago en pie, y la partida, quien gane 2 rondas. La zona se va cerrando y quema: no te puedes esconder para siempre.',
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
        text: 'Arrastra un dedo por el centro de la pantalla, fuera de los botones. La mitad izquierda es para caminar.',
        goal: { kind: 'signal', signal: 'look' },
        dummy: 'near',
      },
      {
        title: 'Duelo',
        short: 'Toca al muñeco para fijarlo',
        text: 'Tocar a un rival lo fija: la cámara lo mantiene al frente, un anillo lo marca y ✦ le apunta solo. El botón de las cuatro esquinas también fija.',
        goal: { kind: 'lock' },
      },
      {
        title: 'Saltar entre rivales',
        short: 'Salta al otro muñeco',
        text: 'Llegó otro muñeco. Con un rival fijado, el botón de las cuatro esquinas salta al siguiente. También puedes tocar directo al que quieras.',
        goal: { kind: 'switch' },
        secondDummy: true,
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
    id: 'elementos',
    title: 'Los 5 elementos',
    steps: [
      {
        title: 'Brasa, Tormenta, Marea, Raíz y Umbra',
        text: 'Toca un elemento y después ✦ para lanzar. Cada elemento solo ya es un hechizo.',
        goal: { kind: 'read' },
      },
      {
        title: 'Los cinco básicos',
        short: 'Lanza los cinco básicos',
        text: 'Chispa (Brasa), Paso (Tormenta), Salpicón (Marea), Savia (Raíz) y Zarpa (Umbra): toca el elemento y después ✦.',
        goal: { kind: 'releaseAll', spells: BASICS },
      },
    ],
  },
  {
    id: 'descanso',
    title: 'El descanso',
    steps: [
      {
        title: 'Cada elemento descansa',
        text: 'El elemento que usas descansa 3 s y su botón se apaga. Alterna elementos para no quedarte sin magia.',
        goal: { kind: 'read' },
      },
      {
        title: 'Alternar',
        short: 'Lanza 3 seguidos sin repetir elemento',
        text: 'Si repites un elemento, la cuenta vuelve a empezar.',
        goal: { kind: 'releases', count: 3 },
      },
    ],
  },
  {
    id: 'tejer',
    title: 'Tejer',
    steps: [
      {
        title: 'El orden importa',
        text: 'Toca hasta tres elementos antes de ✦: cada tejido es un hechizo propio, y el orden cambia el hechizo. La flecha que gira deshace el tejido.',
        goal: { kind: 'read' },
      },
      {
        title: 'Dos elementos',
        short: 'Teje Rayo en cadena',
        text: 'Toca Tormenta, después Brasa, y ✦. Cada hechizo nuevo queda en tu Grimorio.',
        goal: { kind: 'release', spell: 'chainLightning' },
        spell: 'chainLightning',
      },
      {
        title: 'Un Gran hechizo',
        short: 'Teje Era de hielo',
        text: 'Marea, Marea, Marea y ✦. Los de tres elementos tardan más en salir y cansan los tres. Era de hielo congela: la usarás en Quiebre.',
        goal: { kind: 'release', spell: 'iceAge' },
        spell: 'iceAge',
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
      },
      {
        title: 'Hechizos de suelo',
        short: 'Deja un Meteoro donde quieras',
        text: 'Teje Meteoro (Brasa, Brasa, Brasa), mantén ✦ un momento y arrastra para elegir dónde cae.',
        goal: { kind: 'placed' },
        spell: 'meteor',
      },
    ],
  },
  {
    id: 'defensa',
    title: 'Defenderse',
    steps: [
      {
        title: 'Leer al rival',
        text: 'Ahora el muñeco ataca. Lo que teje flota sobre su cabeza: si ves Brasa, viene una Chispa.',
        goal: { kind: 'read' },
        dummy: 'sparks',
      },
      {
        title: 'Esquivar',
        short: 'Muévete de lado al ver la Brasa',
        text: 'La Chispa va hacia donde estabas: apenas veas la Brasa sobre el muñeco, camina de lado. Deja pasar dos.',
        goal: { kind: 'avoid', count: 2 },
      },
      {
        title: 'Muro de hielo',
        short: 'Levanta un Muro de hielo',
        text: 'Marea, Marea y ✦, con el muñeco al frente: el muro frena sus proyectiles.',
        goal: { kind: 'release', spell: 'iceWall' },
        spell: 'iceWall',
      },
      {
        title: 'Choque de tejidos',
        short: 'Arrastra ✦ con Salpicón hacia la Chispa',
        text: 'Un elemento opuesto desarma un proyectil: contra Brasa, Marea o Raíz. Teje Marea y arrastra ✦ hacia la Chispa que viene.',
        goal: { kind: 'clash' },
        spell: 'splash',
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
        text: 'Quema al muñeco con una Chispa y, mientras arde, golpéalo con Umbra (Zarpa).',
        goal: { kind: 'reaction', reaction: 'ashenCurse' },
        combo: combo('brasa-maldita'),
      },
      {
        title: 'Quiebre',
        short: 'Quiebre: congela, luego Rayo',
        text: 'Lanza Era de hielo (Marea, Marea, Marea). Cuando lo congele, suéltale un Rayo en cadena (Tormenta, Brasa).',
        goal: { kind: 'reaction', reaction: 'shatter' },
        combo: combo('quiebre'),
      },
    ],
  },
  {
    id: 'combos',
    title: 'Combos',
    steps: [
      {
        title: 'Seguidillas',
        text: 'Un combo es una seguidilla de hechizos que encaja. No da premio extra: el premio es descubrirlo.',
        goal: { kind: 'read' },
      },
      {
        title: 'Amarre',
        short: 'Amarre: Liana, luego Salpicón',
        text: 'La Liana (Raíz, Tormenta) te lleva al muñeco y lo enraíza; ahí mismo, un Salpicón (Marea).',
        goal: { kind: 'combo', comboId: 'amarre' },
        combo: combo('amarre'),
      },
      {
        title: 'Tus primeros combos',
        text: 'Brasa maldita, Quiebre y Amarre quedan en tu Grimorio. Los demás se descubren jugando: acierta uno 3 veces en partidas y se anota.',
        goal: { kind: 'read' },
      },
    ],
  },
  {
    id: 'grimorio',
    title: 'El Grimorio',
    steps: [
      {
        title: 'Tu libro',
        text: 'En el menú, el Grimorio guarda cada hechizo que lanzas por primera vez y los combos que descubres. Toca uno para ver qué hace; en Mis combos anotas los tuyos.',
        goal: { kind: 'read' },
      },
    ],
  },
  {
    id: 'examen',
    title: 'Examen',
    steps: [
      {
        title: 'Un duelo de verdad',
        text: 'Ahora pelea un mago Aprendiz: se mueve, esquiva y ataca. Usa lo que aprendiste.',
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
];

/** El capítulo que entrega los 3 primeros combos al terminarse. */
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
    startChapter = 0,
    /** Si termina al cerrar este capítulo (para repetir uno solo). */
    private readonly onlyOne = false,
    /** El paso del capítulo por donde empezar. */
    startStep = 0,
  ) {
    this.detector = new ComboDetector(playerId);
    this.chapterIndex = Math.max(0, Math.min(startChapter, TUTORIAL_CHAPTERS.length - 1));
    const steps = TUTORIAL_CHAPTERS[this.chapterIndex]?.steps.length ?? 1;
    this.stepIndex = Math.max(0, Math.min(startStep, steps - 1));
    this.applyDummy();
  }

  get chapter(): TutorialChapter | null {
    if (this.done) return null;
    return TUTORIAL_CHAPTERS[this.chapterIndex] ?? null;
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
    return this.chapterIndex >= TUTORIAL_CHAPTERS.length;
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
    if (this.stepIndex >= (TUTORIAL_CHAPTERS[this.chapterIndex]?.steps.length ?? 0)) {
      this.nextChapter(true);
      return;
    }
    this.applyDummy();
  }

  private nextChapter(completed: boolean): void {
    const chapter = TUTORIAL_CHAPTERS[this.chapterIndex];
    if (completed && chapter) this.finished.push(chapter.id);
    this.stepIndex = 0;
    this.start = null;
    this.chapterIndex = this.onlyOne ? TUTORIAL_CHAPTERS.length : this.chapterIndex + 1;
    this.applyDummy();
  }

  /** El modo del muñeco y si está el segundo: lo que diga el paso, o lo último dicho en el capítulo. */
  private applyDummy(): void {
    const chapter = TUTORIAL_CHAPTERS[this.chapterIndex];
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
