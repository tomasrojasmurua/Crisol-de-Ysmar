import type { Glyph, Omen } from '@crisol/content';
import {
  type Controller,
  createMatch,
  createSeries,
  ELEMENT_IDS,
  type ElementId,
  type GameEvent,
  type GameRules,
  type MatchState,
  modeSetup,
  type SeriesState,
  stepMatch,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { MatchOptions, MatchStage } from './LocalMatch';
import type { MatchView } from './MatchView';

const PLAYER = 1;
const DUMMY = 2;
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

/**
 * El modo entrenamiento: tú contra un muñeco que no ataca y se recupera solo, sin zona que se
 * cierre ni fin de ronda. Con "sin cansancio", tus elementos descansan al instante para que
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
    ]);
    const setup = modeSetup({ kind: 'duel' }, 1, 'out', this.rules);
    this.state = createMatch(setup, this.rules);
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
    const intents = new Map([
      [PLAYER, this.human.intentsFor(this.state, this.player)],
      [DUMMY, []],
    ]);
    stepMatch(this.state, intents, this.rules);
    for (const wizard of this.state.wizards) refill(wizard);
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

/** Nadie cae en el entrenamiento: con poca vida, vuelve a estar entero. */
function refill(wizard: Wizard): void {
  if (wizard.fallen || wizard.hp < wizard.maxHp * REFILL_BELOW) {
    wizard.fallen = null;
    wizard.hp = wizard.maxHp;
    wizard.statuses = {};
  }
}
