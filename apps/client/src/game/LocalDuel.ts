import {
  BotController,
  type Controller,
  createMatch,
  duelSetup,
  type GameEvent,
  type GameRules,
  type MatchState,
  stepMatch,
  type Vec2,
  type Wizard,
} from '@crisol/core';

export const PLAYER_ID = 1;
export const BOT_ID = 2;

/**
 * Un duelo en el mismo celular: tú contra un hechicero de la IA.
 * Guarda las posiciones del paso anterior para que el dibujo pueda interpolar.
 */
export class LocalDuel {
  state: MatchState;
  private bot: BotController;
  private previous = new Map<number, Vec2>();

  constructor(
    private readonly rules: GameRules,
    private readonly human: Controller,
    seed: number,
  ) {
    this.state = createMatch(duelSetup(seed, rules), rules);
    this.bot = new BotController(seed ^ 0x5bd1e995, rules);
  }

  restart(seed: number): void {
    this.state = createMatch(duelSetup(seed, this.rules), this.rules);
    this.bot = new BotController(seed ^ 0x5bd1e995, this.rules);
    this.previous.clear();
  }

  get player(): Wizard {
    return this.wizard(PLAYER_ID);
  }

  get rival(): Wizard {
    return this.wizard(BOT_ID);
  }

  step(): readonly GameEvent[] {
    this.previous.clear();
    for (const wizard of this.state.wizards) this.previous.set(wizard.id, wizard.pos);
    for (const spell of this.state.spells) {
      if (spell.kind === 'projectile') this.previous.set(spell.id, spell.pos);
    }
    const intents = new Map([
      [PLAYER_ID, this.human.intentsFor(this.state, this.player)],
      [BOT_ID, this.bot.intentsFor(this.state, this.rival)],
    ]);
    stepMatch(this.state, intents, this.rules);
    return this.state.events;
  }

  /** Posición entre el paso anterior y el actual, según `alpha` (0 a 1). */
  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    const before = this.previous.get(id);
    if (!before) return current;
    return {
      x: before.x + (current.x - before.x) * alpha,
      z: before.z + (current.z - before.z) * alpha,
    };
  }

  private wizard(id: number): Wizard {
    const found = this.state.wizards.find((w) => w.id === id);
    if (!found) throw new Error(`No existe el mago ${id}`);
    return found;
  }
}
