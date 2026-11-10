import { createMatch } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { GAME_RULES } from './rules';
import { blindedFrom } from './sight';

function duel() {
  const state = createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: 0, z: 10 } },
      ],
    },
    GAME_RULES,
  );
  const [me, rival] = state.wizards;
  if (!me || !rival) throw new Error('faltan magos');
  return { me, rival };
}

describe('vista con ceguera', () => {
  it('cegado, el rival lejano no se dibuja', () => {
    const { me, rival } = duel();
    me.statuses.blind = { ticks: 60, sourceId: rival.id };
    expect(blindedFrom(me, rival, GAME_RULES)).toBe(true);
  });

  it('con el Cazador se ve al rival aunque haya Eclipse, salvo si borró su rastro', () => {
    const { me, rival } = duel();
    me.statuses.blind = { ticks: 60, sourceId: rival.id };
    me.statuses.hunting = { ticks: 60, sourceId: me.id };
    expect(blindedFrom(me, rival, GAME_RULES)).toBe(false);
    rival.statuses.unseen = { ticks: 60, sourceId: rival.id };
    expect(blindedFrom(me, rival, GAME_RULES)).toBe(true);
  });
});
