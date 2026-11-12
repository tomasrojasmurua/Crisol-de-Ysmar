import { describe, expect, it } from 'vitest';
import { applyStatus } from '../combat/hit';
import { createMatch, duelSetup, type MatchSetup } from '../match/createMatch';
import { stateHash } from '../match/hash';
import { modeSetup } from '../match/modes';
import type { MatchState, Strike } from '../match/state';
import { stepMatch } from '../match/step';
import { TEST_RULES } from '../testing/rules.fixture';
import { BotController, type BotProfile, DEFAULT_BOT } from './bot';

const MAX_TICKS = 30 * 60 * 3;

function botDuel(seed: number, setup: MatchSetup = duelSetup(seed, TEST_RULES)): MatchState {
  const state = createMatch(setup, TEST_RULES);
  const bots = new Map(
    state.wizards.map((w) => [w.id, new BotController(seed * 31 + w.id, TEST_RULES)]),
  );
  while (state.winnerTeam === null && state.tick < MAX_TICKS * 2) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, TEST_RULES);
  }
  return state;
}

describe('bots y repetición', () => {
  it('la misma semilla produce exactamente la misma partida', () => {
    expect(stateHash(botDuel(7))).toBe(stateHash(botDuel(7)));
  });

  it('semillas distintas producen partidas distintas', () => {
    expect(stateHash(botDuel(7))).not.toBe(stateHash(botDuel(8)));
  });

  it('dos bots terminan un duelo en menos de tres minutos', () => {
    const state = botDuel(3);
    expect(state.winnerTeam).not.toBeNull();
  });

  it('los bots terminan una ronda de 3 contra 3 con Vidas', () => {
    const state = botDuel(5, modeSetup({ kind: 'teams', size: 3 }, 5, 'lives', TEST_RULES));
    expect(state.winnerTeam).not.toBeNull();
  });

  it('los bots terminan un todos contra todos de 6 sin Vidas', () => {
    const state = botDuel(9, modeSetup({ kind: 'ffa', players: 6 }, 9, 'out', TEST_RULES));
    expect(state.winnerTeam).not.toBeNull();
    expect(state.tick).toBeLessThanOrEqual(TEST_RULES.round.durationTicks);
  });
});

describe('IA: no se congela, esquiva y tiene dificultades', () => {
  const MASTER: BotProfile = {
    ...DEFAULT_BOT,
    dodgeProjectiles: 1,
    dodgeStrikes: 1,
    readWeave: 1,
  };

  function duel(): MatchState {
    const state = createMatch(
      {
        seed: 1,
        deathRule: 'out',
        wizards: [
          { team: 0, spawn: { x: 0, z: 0 } },
          { team: 1, spawn: { x: 0, z: 8 } },
        ],
      },
      TEST_RULES,
    );
    return state;
  }

  it('ciego sigue moviéndose y peleando contra donde vio al rival', () => {
    const state = duel();
    const bot = new BotController(5, TEST_RULES, MASTER);
    const self = state.wizards[0];
    if (!self) throw new Error('falta el bot');
    // Lo ve una vez y después lo ciegan.
    bot.intentsFor(state, self);
    applyStatus(state, self, 'blind', 2, TEST_RULES, 300);
    let moved = 0;
    let acted = 0;
    for (let i = 0; i < 120; i++) {
      const intents = bot.intentsFor(state, self);
      for (const intent of intents) {
        if (intent.kind === 'move' && Math.hypot(intent.x, intent.z) > 0.5) moved++;
        if (intent.kind === 'weave' || intent.kind === 'cast') acted++;
      }
      stepMatch(state, new Map([[self.id, intents]]), TEST_RULES);
    }
    expect(moved).toBeGreaterThan(100);
    expect(acted).toBeGreaterThan(0);
  });

  it('ciego y sin recuerdo del rival tampoco se queda quieto', () => {
    const state = duel();
    const bot = new BotController(5, TEST_RULES, MASTER);
    const self = state.wizards[0];
    if (!self) throw new Error('falta el bot');
    applyStatus(state, self, 'blind', 2, TEST_RULES, 300);
    const [move] = bot.intentsFor(state, self);
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') expect(Math.hypot(move.x, move.z)).toBeGreaterThan(0.5);
  });

  /** Cuántos pasos de 30 pasa dentro del aviso de un meteoro que cae junto a él. */
  function stepsInsideStrike(profile: BotProfile, seed: number): number {
    const state = duel();
    const bot = new BotController(seed, TEST_RULES, profile);
    const self = state.wizards[0];
    if (!self) throw new Error('falta el bot');
    // El aviso queda corrido hacia un lado: hay una salida corta y una larga.
    const center = { x: self.pos.x - 1.5, z: self.pos.z };
    const radius = 3;
    state.spells.push({
      kind: 'strike',
      id: 999,
      ownerId: 2,
      team: 1,
      pos: center,
      radius,
      line: null,
      delayTicks: 600,
      ticksLeft: 600,
      effect: 'scorch',
      payload: {
        form: 'projectile',
        weave: ['brasa', 'brasa', 'brasa'],
        damage: 0,
        statuses: [],
        spell: 'meteor',
        blastRadius: 0,
        pierce: false,
      },
    } as Strike);
    let inside = 0;
    for (let i = 0; i < 30; i++) {
      stepMatch(state, new Map([[self.id, bot.intentsFor(state, self)]]), TEST_RULES);
      if (Math.hypot(self.pos.x - center.x, self.pos.z - center.z) < radius) inside++;
    }
    return inside;
  }

  it('sale del aviso de un meteoro que le va a caer encima', () => {
    const careless: BotProfile = { ...MASTER, dodgeStrikes: 0 };
    let dodging = 0;
    let staying = 0;
    for (let seed = 1; seed <= 8; seed++) {
      dodging += stepsInsideStrike(MASTER, seed);
      staying += stepsInsideStrike(careless, seed);
    }
    expect(dodging).toBeLessThan(staying * 0.6);
  });
});
