import { BOT_PROFILES, type Glyph, type Omen } from '@crisol/content';
import {
  BotController,
  type Controller,
  createMatch,
  createSeries,
  ELEMENT_IDS,
  type ElementId,
  type GameEvent,
  type GameRules,
  type Intent,
  type MatchState,
  modeSetup,
  placeInArena,
  type SeriesState,
  stepMatch,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { MatchOptions, MatchStage } from './LocalMatch';
import type { MatchView } from './MatchView';
import type { DummyMode } from './Tutorial';

const PLAYER = 1;
export const DUMMY_ID = 2;
const DUMMY = DUMMY_ID;
/**
 * El segundo muñeco: solo aparece en la parte del tutorial que enseña a saltar entre rivales.
 * Está siempre en la partida (así tiene su figura y su nombre desde el principio), pero fuera de
 * ella está caído, escondido y lejos: nada lo apunta ni lo fija. Va en su propio equipo para que
 * el Aprendiz del examen no lo tome por un aliado caído.
 */
export const SECOND_DUMMY_ID = 3;
/** A qué distancia del primer muñeco aparece el segundo, de lado respecto de ti. */
const SECOND_DUMMY_GAP = 4;
/** Tan lejos que la ronda nunca cierra la zona ni se acaba el tiempo. */
const ENDLESS = 1_000_000_000;
/** Bajo esta fracción de vida, el muñeco (o tú) vuelve a estar entero. */
const REFILL_BELOW = 0.3;

const TRAINING_OMEN: Omen = {
  id: 'entrenamiento',
  name: 'Entrenamiento',
  description: 'Sin Presagio: el campo de práctica.',
  element: null,
  mods: {},
};

/** Pasos entre un ataque y otro del muñeco del tutorial. */
const SPARK_EVERY = 95;
const METEOR_EVERY = 170;
/** A qué distancia se queda el muñeco cuando ataca. */
const ATTACK_DISTANCE = 8;
/** Con Chispas se queda más lejos: la Chispa tarda más en llegar y se alcanza a esquivar. */
const SPARK_DISTANCE = 11;
/**
 * Pasos que el muñeco muestra la Brasa sobre la cabeza antes de soltar la Chispa (medio
 * segundo): es lo que enseña "Leer al rival" y lo que da tiempo de caminar de lado.
 */
const SPARK_TELL = 15;

/**
 * El muñeco del tutorial cuando se mueve: se acerca a tiro y, si ataca, suelta una Chispa cada
 * tanto o un Meteoro que se teje a la vista (Brasa, Brasa, Brasa) y cae donde estás. Antes de la Chispa deja la Brasa a la vista
 * un momento y la lanza a donde estás, para que se pueda leer y esquivar caminando.
 */
class TutorialDummy implements Controller {
  private tick = 0;
  /** Lo que hará en los próximos pasos; `null` es un paso de espera con el tejido a la vista. */
  private pending: (Intent | null)[] = [];

  constructor(private readonly mode: 'sparks' | 'meteor' | 'near') {}

  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[] {
    this.tick++;
    const intents: Intent[] = [];
    // Se acerca hasta quedar a tiro: de lejos, sus hechizos no llegarían.
    const player = state.wizards.find((w) => w.id === PLAYER);
    if (player) {
      const dx = player.pos.x - self.pos.x;
      const dz = player.pos.z - self.pos.z;
      const d = Math.hypot(dx, dz);
      const keep = this.mode === 'sparks' ? SPARK_DISTANCE : ATTACK_DISTANCE;
      intents.push(
        d > keep ? { kind: 'move', x: dx / d, z: dz / d } : { kind: 'move', x: 0, z: 0 },
      );
    }
    // Cerca no ataca: solo se pone a tiro para que lo puedas fijar.
    if (this.mode === 'near') return intents;
    const every = this.mode === 'sparks' ? SPARK_EVERY : METEOR_EVERY;
    if (this.pending.length === 0 && this.tick % every === 0) {
      const weave: (Intent | null)[] =
        this.mode === 'sparks'
          ? [{ kind: 'weave', element: 'brasa' }, ...Array<null>(SPARK_TELL).fill(null)]
          : (['brasa', 'brasa', 'brasa'] as const).map((element) => ({ kind: 'weave', element }));
      this.pending = [...weave, { kind: 'cast', dirX: 0, dirZ: 0 }];
    }
    // Un elemento por paso, como una persona: el tejido se alcanza a leer.
    const next = this.pending.shift();
    if (next?.kind === 'cast' && this.mode === 'sparks' && player) {
      // La Chispa va a donde estás ahora, sin adelantarse a tu paso (el apuntado automático sí
      // se adelanta): así caminar de lado alcanza para esquivarla, que es lo que se enseña.
      const dx = player.pos.x - self.pos.x;
      const dz = player.pos.z - self.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      intents.push({ kind: 'cast', dirX: dx / d, dirZ: dz / d });
    } else if (next) {
      intents.push(next);
    }
    return intents;
  }
}

/**
 * El modo entrenamiento: tú contra un muñeco que se recupera solo, sin zona que se cierre ni
 * fin de ronda. En el tutorial el muñeco puede atacar o volverse un mago Aprendiz (el examen). Con "sin cansancio", tus elementos descansan al instante para que
 * puedas probar combinaciones seguidas.
 */
export class TrainingMatch implements MatchView {
  readonly training = true;
  readonly options: MatchOptions;
  readonly series: SeriesState = createSeries(2);
  readonly stage: MatchStage = { kind: 'playing' };
  readonly omen = TRAINING_OMEN;
  readonly affinities: ReadonlyMap<number, ElementId | null>;
  readonly playerId = PLAYER;
  readonly roundNumber = 1;
  state: MatchState;
  /** Si los elementos descansan al instante. */
  restless = true;
  /** Las reglas del entrenamiento: las de siempre, con una ronda sin fin. */
  readonly rules: GameRules;
  private readonly previous = new Map<number, Vec2>();
  /** Lo que mandó tu dedo en el último paso (el tutorial mira si arrastraste ✦). */
  lastIntents: readonly Intent[] = [];
  private dummyMode: DummyMode = 'idle';
  private dummyBrain: Controller | null = null;

  constructor(
    rules: GameRules,
    private readonly human: Controller,
    affinity: ElementId | null,
  ) {
    this.rules = {
      ...rules,
      round: {
        ...rules.round,
        huntEndTick: ENDLESS,
        convergenceEndTick: ENDLESS + 1,
        durationTicks: ENDLESS + 2,
      },
    };
    // En el entrenamiento, la IA (cuando la hay) es siempre Aprendiz.
    this.options = { mode: { kind: 'duel' }, deathRule: 'out', affinity, botLevel: 'apprentice' };
    this.affinities = new Map([
      [PLAYER, affinity],
      [DUMMY, null],
      [SECOND_DUMMY_ID, null],
    ]);
    const setup = modeSetup({ kind: 'duel' }, 1, 'out', this.rules);
    const parked = { x: this.rules.arenaRadius * 0.85, z: 0 };
    this.state = createMatch(
      { ...setup, wizards: [...setup.wizards, { team: 2, spawn: parked }] },
      this.rules,
    );
    this.setSecondDummy(false);
  }

  /** Si el segundo muñeco está en la arena (lo pide el tutorial al enseñar a saltar de rival). */
  get secondDummy(): boolean {
    return this.second?.fallen === null;
  }

  /** Hace aparecer al segundo muñeco junto al primero, o lo retira. */
  setSecondDummy(on: boolean): void {
    const second = this.second;
    if (!second || on === this.secondDummy) return;
    const player = this.player;
    second.weave = [];
    second.channel = null;
    second.statuses = {};
    if (!on) {
      second.hp = 0;
      second.fallen = { respawnTicks: null, reviveProgress: 0 };
      if (player.lockTarget === second.id) player.lockTarget = null;
      return;
    }
    const dummy = this.state.wizards.find((w) => w.id === DUMMY);
    const anchor = dummy?.pos ?? { x: 0, z: 0 };
    // De lado respecto de la línea que va de ti al muñeco: los dos quedan a la vista.
    const dx = anchor.x - player.pos.x;
    const dz = anchor.z - player.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const pos = {
      x: anchor.x - (dz / d) * SECOND_DUMMY_GAP,
      z: anchor.z + (dx / d) * SECOND_DUMMY_GAP,
    };
    second.pos = placeInArena(pos, this.rules.wizard.radius, this.rules);
    second.facing = { x: -dx / d, z: -dz / d };
    second.hp = second.maxHp;
    second.fallen = null;
  }

  /** Si un mago no se ve: el segundo muñeco mientras no está en la arena. */
  isHidden(id: number): boolean {
    return id === SECOND_DUMMY_ID && !this.secondDummy;
  }

  private get second(): Wizard | undefined {
    return this.state.wizards.find((w) => w.id === SECOND_DUMMY_ID);
  }

  /** Qué hace el muñeco (lo cambia el tutorial). */
  setDummy(mode: DummyMode): void {
    if (mode === this.dummyMode) return;
    this.dummyMode = mode;
    const dummy = this.state.wizards.find((w) => w.id === DUMMY);
    if (dummy) {
      dummy.weave = [];
      dummy.channel = null;
    }
    this.dummyBrain =
      mode === 'idle'
        ? null
        : mode === 'bot'
          ? new BotController(7, this.rules, BOT_PROFILES.apprentice)
          : new TutorialDummy(mode);
  }

  get player(): Wizard {
    return this.state.wizards.find((w) => w.id === PLAYER) as Wizard;
  }

  step(): readonly GameEvent[] {
    this.previous.clear();
    for (const w of this.state.wizards) this.previous.set(w.id, w.pos);
    for (const spell of this.state.spells) {
      if (
        spell.kind === 'projectile' ||
        spell.kind === 'summon' ||
        spell.kind === 'sweeper' ||
        spell.kind === 'guidedBolt'
      ) {
        this.previous.set(spell.id, spell.pos);
      }
    }
    this.lastIntents = this.human.intentsFor(this.state, this.player);
    const dummy = this.state.wizards.find((w) => w.id === DUMMY);
    const dummyIntents =
      dummy && this.dummyBrain ? this.dummyBrain.intentsFor(this.state, dummy) : [];
    const intents = new Map([
      [PLAYER, this.lastIntents],
      [DUMMY, dummyIntents],
    ]);
    stepMatch(this.state, intents, this.rules);
    // En el examen el Aprendiz sí cae (y vuelve a pararse); tú nunca.
    for (const wizard of this.state.wizards) {
      // El segundo muñeco, fuera de la arena, sigue caído.
      if (wizard.id === SECOND_DUMMY_ID && !this.secondDummy) continue;
      refill(wizard, wizard.id === DUMMY && this.dummyMode === 'bot');
    }
    this.state.winnerTeam = null;
    if (this.restless) {
      for (const element of ELEMENT_IDS) this.player.fatigue[element] = 0;
    }
    return this.state.events;
  }

  chooseGlyph(_glyph: Glyph): void {}

  glyphsOf(_id: number): readonly Glyph[] {
    return [];
  }

  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    const before = this.previous.get(id);
    if (!before) return current;
    return {
      x: before.x + (current.x - before.x) * alpha,
      z: before.z + (current.z - before.z) * alpha,
    };
  }
}

/**
 * Nadie cae en el entrenamiento: con poca vida, vuelve a estar entero. Con `onlyWhenFallen`
 * (el Aprendiz del examen) se lo deja bajar hasta caer, y recién ahí se para de nuevo.
 */
function refill(wizard: Wizard, onlyWhenFallen = false): void {
  const low = !onlyWhenFallen && wizard.hp < wizard.maxHp * REFILL_BELOW;
  if (wizard.fallen || low) {
    wizard.fallen = null;
    wizard.hp = wizard.maxHp;
    wizard.statuses = {};
  }
}
