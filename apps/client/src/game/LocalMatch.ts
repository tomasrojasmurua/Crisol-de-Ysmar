import {
  BotController,
  type Controller,
  createMatch,
  createSeries,
  type DeathRule,
  type GameEvent,
  type GameMode,
  type GameRules,
  type MatchState,
  modeSetup,
  recordRound,
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
}

export type MatchStage =
  | { readonly kind: 'playing' }
  | { readonly kind: 'intermission'; readonly roundWinner: number; ticksLeft: number }
  | { readonly kind: 'finished' };

/**
 * Una partida completa en el celular: tú y hechiceros de la IA, al mejor de 3 rondas.
 * Guarda las posiciones del paso anterior para que el dibujo pueda interpolar.
 */
export class LocalMatch {
  state: MatchState;
  readonly series: SeriesState;
  stage: MatchStage = { kind: 'playing' };
  private bots = new Map<number, BotController>();
  private readonly previous = new Map<number, Vec2>();

  constructor(
    readonly options: MatchOptions,
    private readonly rules: GameRules,
    private readonly human: Controller,
    private readonly seed: number,
  ) {
    this.series = createSeries(teamCount(options.mode));
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
        this.state = this.startRound();
        this.stage = { kind: 'playing' };
      }
      return [];
    }
    if (this.stage.kind === 'finished') {
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
    const state = createMatch(
      modeSetup(this.options.mode, roundSeed, this.options.deathRule, this.rules),
      this.rules,
    );
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
