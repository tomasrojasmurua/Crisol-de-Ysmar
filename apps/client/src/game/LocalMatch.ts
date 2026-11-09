import { AFFINITY_RULES, GLYPHS, type Glyph, OMENS, type Omen } from '@crisol/content';
import {
  affinityPatch,
  BotController,
  type Controller,
  combineMods,
  createMatch,
  createSeries,
  type DeathRule,
  ELEMENT_IDS,
  type ElementId,
  type GameEvent,
  type GameMode,
  type GameRules,
  type MatchState,
  modeSetup,
  playerCount,
  recordRound,
  SeededRng,
  type SeriesState,
  stepMatch,
  TICK_RATE,
  teamCount,
  type Vec2,
  type Wizard,
} from '@crisol/core';

export const PLAYER_ID = 1;

/** Pausa entre rondas, en pasos: tiempo para leer quién ganó. */
const INTERMISSION_TICKS = TICK_RATE * 4;

export interface MatchOptions {
  readonly mode: GameMode;
  readonly deathRule: DeathRule;
  /** La Afinidad del jugador, o ninguna. */
  readonly affinity: ElementId | null;
}

export type MatchStage =
  | { readonly kind: 'playing' }
  | { readonly kind: 'intermission'; readonly roundWinner: number; ticksLeft: number }
  /** Entre rondas: el jugador elige un Glifo entre estas opciones. */
  | { readonly kind: 'choosing'; readonly options: readonly Glyph[] }
  | { readonly kind: 'finished' };

/** Glifos que se ofrecen entre rondas; quien perdió la ronda ve uno más. */
const GLYPH_OPTIONS = 3;

/**
 * Una partida completa en el celular: tú y hechiceros de la IA, al mejor de 3 rondas.
 * Guarda las posiciones del paso anterior para que el dibujo pueda interpolar.
 */
export class LocalMatch {
  state: MatchState;
  readonly series: SeriesState;
  stage: MatchStage = { kind: 'playing' };
  /** El Presagio de esta partida: afecta a todos por igual. */
  readonly omen: Omen;
  /** Glifos elegidos por cada mago, por id. */
  readonly glyphs = new Map<number, Glyph[]>();
  /** Afinidad de cada mago, por id: la del jugador y una al azar para cada bot. */
  readonly affinities = new Map<number, ElementId | null>();
  private readonly rng: SeededRng;
  private bots = new Map<number, BotController>();
  private readonly previous = new Map<number, Vec2>();

  constructor(
    readonly options: MatchOptions,
    private readonly rules: GameRules,
    private readonly human: Controller,
    private readonly seed: number,
  ) {
    this.series = createSeries(teamCount(options.mode));
    this.rng = new SeededRng(seed ^ 0x2545f491);
    this.omen = OMENS[this.rng.int(0, OMENS.length - 1)] ?? (OMENS[0] as Omen);
    const total = playerCount(options.mode);
    for (let id = 1; id <= total; id++) {
      this.affinities.set(
        id,
        id === PLAYER_ID
          ? options.affinity
          : (ELEMENT_IDS[this.rng.int(0, ELEMENT_IDS.length - 1)] ?? null),
      );
    }
    this.state = this.startRound();
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
    if (this.stage.kind === 'finished' || this.stage.kind === 'choosing') {
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

    const roundWinner = this.state.winnerTeam;
    if (roundWinner !== null) {
      recordRound(this.series, roundWinner, this.rules.round);
      this.stage =
        this.series.winnerTeam === null
          ? { kind: 'intermission', roundWinner, ticksLeft: INTERMISSION_TICKS }
          : { kind: 'finished' };
    }
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
    const setup = modeSetup(this.options.mode, roundSeed, this.options.deathRule, this.rules);
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
    this.bots = new Map(
      state.wizards
        .filter((w) => w.id !== PLAYER_ID)
        .map((w) => [
          w.id,
          new BotController((roundSeed ^ Math.imul(w.id, 0x5bd1e995)) >>> 0, this.rules),
        ]),
    );
    this.previous.clear();
    return state;
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
    for (const spell of this.state.spells) {
      if (spell.kind === 'projectile') this.previous.set(spell.id, spell.pos);
    }
  }
}
