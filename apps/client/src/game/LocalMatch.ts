import {
  AFFINITY_RULES,
  BOT_PROFILES,
  GLYPHS,
  type Glyph,
  HIGHLIGHT_RULES,
  NO_OMEN,
  OMENS,
  type Omen,
  omenById,
  type StoryFight,
  type StorySeat,
  schoolSpellbook,
} from '@crisol/content';
import type { MatchLogRound } from '@crisol/core';
import {
  affinityPatch,
  BotController,
  type BotLevel,
  type BotProfile,
  type Controller,
  combineMods,
  createHighlightTracker,
  createLogRound,
  createMatch,
  createMatchStats,
  createSeries,
  type DeathRule,
  ELEMENT_IDS,
  type ElementId,
  finishHighlightRound,
  type GameEvent,
  type GameMode,
  type GameRules,
  type Highlight,
  type MatchState,
  type MatchStats,
  modeSetup,
  playerCount,
  recordHighlights,
  recordLogRound,
  recordMatchStats,
  recordRound,
  SeededRng,
  type SeriesState,
  stepMatch,
  TICK_RATE,
  teamCount,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import { type MatchLog, modeKey } from '@crisol/protocol';
import type { MatchSummary, MatchView } from './MatchView';
import { type ReplayClip, ReplayRecorder, snapshotState } from './ReplayRecorder';

export const PLAYER_ID = 1;

/** Pausa entre rondas, en pasos: tiempo para leer quién ganó. */
const INTERMISSION_TICKS = TICK_RATE * 4;

export interface MatchOptions {
  readonly mode: GameMode;
  readonly deathRule: DeathRule;
  /** La Afinidad del jugador, o ninguna. */
  readonly affinity: ElementId | null;
  /** La dificultad de los magos de la IA. */
  readonly botLevel: BotLevel;
  /** Un combate de la Historia: fija el Presagio y quién es cada mago de la IA. */
  readonly story?: StoryFight | undefined;
}

export type MatchStage =
  | { readonly kind: 'playing' }
  /** Pausa tras una ronda: quién la ganó y su mejor jugada (null si nadie golpeó a un rival). */
  | {
      readonly kind: 'intermission';
      readonly roundWinner: number;
      ticksLeft: number;
      readonly highlight: Highlight | null;
    }
  /**
   * Entre rondas: el jugador elige un Glifo entre estas opciones. En red, `secondsLeft` es lo
   * que falta para que la Sala elija al azar; contra la IA no hay apuro.
   */
  | { readonly kind: 'choosing'; readonly options: readonly Glyph[]; readonly secondsLeft?: number }
  /** En red: ya elegiste tu Glifo y esperas al rival. */
  | { readonly kind: 'waiting' }
  | { readonly kind: 'finished' };

/** Glifos que se ofrecen entre rondas; quien perdió la ronda ve uno más. */
const GLYPH_OPTIONS = 3;

/**
 * Una partida completa en el celular: tú y hechiceros de la IA, al mejor de 3 rondas.
 * Guarda las posiciones del paso anterior para que el dibujo pueda interpolar.
 */
export class LocalMatch implements MatchView {
  readonly playerId = PLAYER_ID;
  state: MatchState;
  readonly series: SeriesState;
  stage: MatchStage = { kind: 'playing' };
  /** El Presagio de esta partida: afecta a todos por igual. */
  readonly omen: Omen;
  /** Glifos elegidos por cada mago, por id. */
  readonly glyphs = new Map<number, Glyph[]>();
  /** Afinidad de cada mago, por id: la del jugador y una al azar para cada bot. */
  readonly affinities = new Map<number, ElementId | null>();
  /** En la Historia, quién es cada mago de la IA (por id). */
  readonly seats = new Map<number, StorySeat>();
  /** En la Historia, los ids de los rivales en el orden del guion. */
  private readonly foeIds: number[] = [];
  private readonly rng: SeededRng;
  private bots = new Map<number, BotController>();
  private readonly previous = new Map<number, Vec2>();
  /** Lo que hace cada mago en la serie, para el resumen del final. */
  private readonly stats: MatchStats;
  /** La mejor jugada de cada ronda y de la serie. */
  private readonly highlights = createHighlightTracker(HIGHLIGHT_RULES);
  /** Los últimos segundos y la mejor jugada, para repetirla al final. */
  private readonly recorder = new ReplayRecorder();
  /** Qué lanzó cada mago y qué pasó, ronda por ronda (ver docs/partidas.md). */
  private readonly logRounds: MatchLogRound[] = [];

  constructor(
    readonly options: MatchOptions,
    private readonly rules: GameRules,
    private readonly human: Controller,
    private readonly seed: number,
  ) {
    this.series = createSeries(teamCount(options.mode));
    this.rng = new SeededRng(seed ^ 0x2545f491);
    const randomOmen = OMENS[this.rng.int(0, OMENS.length - 1)] ?? (OMENS[0] as Omen);
    const story = options.story;
    // En la Historia el Presagio es parte del reto: el fijado, o ninguno.
    const fixedOmen = story ? story.omenId : undefined;
    this.omen = fixedOmen === undefined ? randomOmen : fixedOmen ? omenById(fixedOmen) : NO_OMEN;
    const total = playerCount(options.mode);
    for (let id = 1; id <= total; id++) {
      const random = ELEMENT_IDS[this.rng.int(0, ELEMENT_IDS.length - 1)] ?? null;
      this.affinities.set(id, id === PLAYER_ID ? options.affinity : random);
    }
    if (story) this.seatStory(story, seed);
    this.state = this.startRound();
    this.stats = createMatchStats(this.state.wizards.map((w) => w.id));
  }

  /**
   * Sienta a los personajes de un combate de la Historia: tus aliados en tu equipo y los demás
   * en orden, cada uno con la Afinidad de su Linaje. Los rivales con ventaja empiezan con Glifos.
   */
  private seatStory(story: StoryFight, seed: number): void {
    const { wizards } = modeSetup(this.options.mode, seed, this.options.deathRule, this.rules);
    const allies = [...story.allies];
    const foes = [...story.foes];
    wizards.forEach((w, index) => {
      const id = index + 1;
      if (id === PLAYER_ID) return;
      const seat = w.team === 0 ? allies.shift() : foes.shift();
      if (!seat) return;
      this.seats.set(id, seat);
      if (seat.school) this.affinities.set(id, seat.school);
      if (w.team !== 0) {
        this.foeIds.push(id);
        for (const glyph of this.glyphOptions(id, story.foeGlyphs)) this.glyphsOf(id).push(glyph);
      }
    });
  }

  replayClip(): ReplayClip | null {
    return this.stage.kind === 'finished' ? this.recorder.clip() : null;
  }

  matchSummary(): MatchSummary | null {
    if (this.stage.kind !== 'finished') return null;
    return { id: `ia-${this.seed}`, stats: this.stats, highlight: this.highlights.matchBest };
  }

  /** El registro de la serie para aprender combinaciones; null mientras no termina. */
  matchLog(version: string): MatchLog | null {
    if (this.stage.kind !== 'finished') return null;
    return {
      format: 1,
      source: 'ia',
      mode: modeKey(this.options.mode),
      botLevel: this.options.botLevel,
      wizards: this.state.wizards.map((w) => ({
        id: w.id,
        team: w.team,
        human: w.id === PLAYER_ID,
      })),
      rounds: this.logRounds,
      winnerTeam: this.series.winnerTeam ?? -1,
      version,
    };
  }

  get player(): Wizard {
    const found = this.state.wizards.find((w) => w.id === PLAYER_ID);
    if (!found) throw new Error('No existe el jugador');
    return found;
  }

  /** Número de la ronda en pantalla, desde 1. */
  get roundNumber(): number {
    return this.series.roundsPlayed + (this.stage.kind === 'playing' ? 1 : 0);
  }

  step(): readonly GameEvent[] {
    if (this.stage.kind === 'intermission') {
      if (--this.stage.ticksLeft <= 0) {
        this.offerGlyphs(this.stage.roundWinner);
      }
      return [];
    }
    if (this.stage.kind !== 'playing') {
      return [];
    }

    this.rememberPositions();
    const intents = new Map(
      this.state.wizards.map((wizard) => [
        wizard.id,
        this.controllerOf(wizard).intentsFor(this.state, wizard),
      ]),
    );
    stepMatch(this.state, intents, this.rules);
    recordMatchStats(this.stats, this.state);
    recordHighlights(this.highlights, this.state);
    const logRound = this.logRounds[this.logRounds.length - 1];
    if (logRound) recordLogRound(logRound, this.state);

    const roundWinner = this.state.winnerTeam;
    if (roundWinner !== null) {
      recordRound(this.series, roundWinner, this.rules.round);
      const highlight = finishHighlightRound(this.highlights);
      this.stage =
        this.series.winnerTeam === null
          ? { kind: 'intermission', roundWinner, ticksLeft: INTERMISSION_TICKS, highlight }
          : { kind: 'finished' };
    }
    // La simulación cambia el estado en su lugar: para repetirlo se guarda una copia liviana
    // por paso (0,1 ms con el procesador 4 veces más lento; ver docs/arquitectura.md).
    this.recorder.push({ state: snapshotState(this.state), hidden: [] });
    this.recorder.offer(this.highlights.matchBest);
    return this.state.events;
  }

  /** El jugador eligió su Glifo: los bots eligen el suyo y empieza la ronda siguiente. */
  chooseGlyph(glyph: Glyph): void {
    if (this.stage.kind !== 'choosing') return;
    this.glyphsOf(PLAYER_ID).push(glyph);
    for (const wizard of this.state.wizards) {
      if (wizard.id === PLAYER_ID) continue;
      const options = this.glyphOptions(wizard.id, GLYPH_OPTIONS);
      const pick = options[this.rng.int(0, options.length - 1)];
      if (pick) this.glyphsOf(wizard.id).push(pick);
    }
    this.state = this.startRound();
    this.stage = { kind: 'playing' };
  }

  glyphsOf(id: number): Glyph[] {
    let owned = this.glyphs.get(id);
    if (!owned) {
      owned = [];
      this.glyphs.set(id, owned);
    }
    return owned;
  }

  private offerGlyphs(roundWinner: number): void {
    const lost = roundWinner !== this.player.team;
    this.stage = {
      kind: 'choosing',
      options: this.glyphOptions(PLAYER_ID, GLYPH_OPTIONS + (lost ? 1 : 0)),
    };
  }

  /** Glifos al azar que el mago todavía no tiene. */
  private glyphOptions(id: number, count: number): Glyph[] {
    const owned = new Set(this.glyphsOf(id).map((g) => g.id));
    const pool = GLYPHS.filter((g) => !owned.has(g.id));
    const options: Glyph[] = [];
    while (options.length < count && pool.length > 0) {
      const [pick] = pool.splice(this.rng.int(0, pool.length - 1), 1);
      if (pick) options.push(pick);
    }
    return options;
  }

  /** Posición entre el paso anterior y el actual, según `alpha` (0 a 1). */
  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    const before = this.previous.get(id);
    if (!before || this.stage.kind !== 'playing') return current;
    return {
      x: before.x + (current.x - before.x) * alpha,
      z: before.z + (current.z - before.z) * alpha,
    };
  }

  private startRound(): MatchState {
    // Cada ronda tiene su propia semilla, derivada de la de la partida.
    const roundSeed = (this.seed + this.series.roundsPlayed * 0x9e3779b1) >>> 0;
    // Cada ronda se parte desde otro punto del borde (girada entera, sigue siendo pareja).
    const setup = modeSetup(this.options.mode, roundSeed, this.options.deathRule, this.rules, {
      matchSeed: this.seed,
      index: this.series.roundsPlayed,
    });
    // Cada mago lleva el Presagio de la partida, su Afinidad y sus Glifos.
    const wizards = setup.wizards.map((w, index) => {
      const affinity = this.affinities.get(index + 1) ?? null;
      const patches = this.glyphsOf(index + 1).map((g) => g.mods);
      if (affinity) {
        patches.push(
          affinityPatch(
            affinity,
            AFFINITY_RULES.ownFatigueMultiplier,
            AFFINITY_RULES.opposingFatigueMultiplier,
          ),
        );
      }
      return { ...w, affinity, mods: combineMods(this.omen.mods, ...patches) };
    });
    const state = createMatch({ ...setup, wizards }, this.rules);
    this.logRounds.push(createLogRound());
    this.bots = new Map(
      state.wizards
        .filter((w) => w.id !== PLAYER_ID)
        .map((w) => [
          w.id,
          new BotController(
            (roundSeed ^ Math.imul(w.id, 0x5bd1e995)) >>> 0,
            this.rules,
            this.botProfile(w.id),
          ),
        ]),
    );
    this.previous.clear();
    return state;
  }

  /**
   * Cómo juega un bot: en la Historia, cada personaje teje el de su Linaje y los de una cuenta
   * pendiente se buscan; si no, juega libre.
   */
  private botProfile(id: number): BotProfile {
    const base = BOT_PROFILES[this.options.botLevel];
    const story = this.options.story;
    if (story) {
      const school = this.seats.get(id)?.school;
      const focus = story.feud ? this.feudOf(id) : undefined;
      return {
        ...base,
        ...(school ? { spellbook: schoolSpellbook(school) } : {}),
        ...(focus !== undefined ? { focus } : {}),
      };
    }
    return base;
  }

  /** En una cuenta pendiente, los dos primeros rivales se buscan entre ellos. */
  private feudOf(id: number): number | undefined {
    const [first, second] = this.foeIds;
    if (id === first) return second;
    if (id === second) return first;
    return undefined;
  }

  private controllerOf(wizard: Wizard): Controller {
    if (wizard.id === PLAYER_ID) return this.human;
    const bot = this.bots.get(wizard.id);
    if (!bot) throw new Error(`El mago ${wizard.id} no tiene controlador`);
    return bot;
  }

  private rememberPositions(): void {
    this.previous.clear();
    for (const wizard of this.state.wizards) this.previous.set(wizard.id, wizard.pos);
    // Las bestias también: dibujadas paso a paso, a 60 cuadros avanzaban a saltos de 30.
    for (const beast of this.state.beasts) this.previous.set(beast.id, beast.pos);
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
  }
}
