import { describe, expect, it } from 'vitest';
import { createMatch, duelSetup } from '../match/createMatch';
import { stateHash } from '../match/hash';
import type { MatchState } from '../match/state';
import { stepMatch } from '../match/step';
import { TEST_RULES } from '../testing/rules.fixture';
import { BotController } from './bot';

const MAX_TICKS = 30 * 60 * 3;

function botDuel(seed: number): MatchState {
  const state = createMatch(duelSetup(seed, TEST_RULES), TEST_RULES);
  const bots = new Map(
    state.wizards.map((w) => [w.id, new BotController(seed * 31 + w.id, TEST_RULES)]),
  );
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
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
});
