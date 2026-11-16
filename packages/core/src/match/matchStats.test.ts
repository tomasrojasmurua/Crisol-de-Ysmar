import { describe, expect, it } from 'vitest';
import { TEST_RULES } from '../testing/rules.fixture';
import { createMatch } from './createMatch';
import { createMatchStats, favoriteSpell, recordMatchStats } from './matchStats';
import type { GameEvent, MatchState } from './state';

/** Tres magos: 1 y 2 aliados, 3 rival. */
function trio(): MatchState {
  return createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 0, spawn: { x: 2, z: 0 } },
        { team: 1, spawn: { x: 0, z: 6 } },
      ],
    },
    TEST_RULES,
  );
}

function withEvents(state: MatchState, events: GameEvent[]): MatchState {
  state.events = events;
  return state;
}

describe('estadísticas de la partida', () => {
  it('cuenta daño a rivales, derribos, caídas y hechizos', () => {
    const state = trio();
    const stats = createMatchStats([1, 2, 3]);
    recordMatchStats(
      stats,
      withEvents(state, [
        { type: 'release', wizardId: 1, form: 'projectile', spell: 'spark' },
        { type: 'release', wizardId: 1, form: 'projectile', spell: 'spark' },
        { type: 'release', wizardId: 1, form: 'projectile', spell: 'step' },
        { type: 'hit', targetId: 3, sourceId: 1, amount: 30, form: 'projectile' },
        { type: 'combo', combo: 'conduction', targetId: 3, sourceId: 1 },
        { type: 'hit', targetId: 3, sourceId: 1, amount: 20, form: 'projectile' },
        { type: 'defeated', wizardId: 3 },
      ]),
    );
    const [me, ally, rival] = stats;
    expect(me).toMatchObject({ damage: 50, knockouts: 1, casts: 3, reactions: 1, falls: 0 });
    expect(me && favoriteSpell(me)).toBe('spark');
    expect(rival).toMatchObject({ taken: 50, falls: 1, damage: 0 });
    expect(ally && favoriteSpell(ally)).toBeNull();
  });

  it('la zona y los golpes entre aliados no suman daño ni derribos', () => {
    const state = trio();
    const stats = createMatchStats([1, 2, 3]);
    recordMatchStats(
      stats,
      withEvents(state, [
        { type: 'hit', targetId: 2, sourceId: 1, amount: 10, form: 'projectile' },
        { type: 'hit', targetId: 1, sourceId: 1, amount: 40, form: 'zone' },
        { type: 'defeated', wizardId: 1 },
      ]),
    );
    const [me, ally] = stats;
    expect(me).toMatchObject({ damage: 0, knockouts: 0, taken: 40, falls: 1 });
    expect(ally).toMatchObject({ taken: 10 });
  });

  it('el derribo es de quien dio el último golpe en ese paso', () => {
    const state = trio();
    const stats = createMatchStats([1, 2, 3]);
    recordMatchStats(
      stats,
      withEvents(state, [
        { type: 'hit', targetId: 3, sourceId: 1, amount: 10, form: 'projectile' },
        { type: 'hit', targetId: 3, sourceId: 2, amount: 10, form: 'projectile' },
        { type: 'defeated', wizardId: 3 },
        { type: 'beastSlain', beastId: 99, element: 'raiz', killerId: 2, guardian: false },
      ]),
    );
    expect(stats[0]?.knockouts).toBe(0);
    expect(stats[1]).toMatchObject({ knockouts: 1, beasts: 1, damage: 10 });
  });
});
