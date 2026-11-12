import { describe, expect, it } from 'vitest';
import { createMatch, duelSetup, type MatchSetup } from '../match/createMatch';
import { stateHash } from '../match/hash';
import { modeSetup } from '../match/modes';
import type { MatchState } from '../match/state';
import { stepMatch } from '../match/step';
import { TEST_RULES } from '../testing/rules.fixture';
import { BotController } from './bot';

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
