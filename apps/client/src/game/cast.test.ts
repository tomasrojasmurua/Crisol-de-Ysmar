import { DEFAULT_LOOK, GAME_RULES } from '@crisol/content';
import { createMatch } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { castOf } from './cast';
import type { MatchView } from './MatchView';

function view(mode: 'teams' | 'ffa'): MatchView {
  const state = createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 0, spawn: { x: 2, z: 0 } },
        { team: 1, spawn: { x: 0, z: 9 } },
      ],
    },
    GAME_RULES,
  );
  const player = state.wizards[0];
  if (!player) throw new Error('falta el jugador');
  return {
    state,
    player,
    playerId: player.id,
    options: { mode: mode === 'ffa' ? { kind: 'ffa', players: 3 } : { kind: 'teams', size: 2 } },
    affinities: new Map([[player.id, 'brasa']]),
  } as unknown as MatchView;
}

describe('castOf', () => {
  it('nombra a cada mago, te pone tu nombre y le da su aspecto con el color de su bando', () => {
    const profile = { name: 'Tomás', look: DEFAULT_LOOK, affinity: 'brasa' as const };
    const { badges, looks } = castOf(view('teams'), profile, (id) => ({
      name: `Mago ${id}`,
      look: DEFAULT_LOOK,
    }));
    const [me, ally, rival] = [...badges.values()];
    expect(me?.name).toBe('Tomás');
    expect(ally?.name).toMatch(/^Mago/);
    expect(rival?.color).not.toBe(ally?.color);
    expect([...looks.values()][0]?.isPlayer).toBe(true);
    expect([...looks.values()][0]?.affinity).toBe('brasa');
    expect([...looks.values()][2]?.teamColor).toBe(rival?.color);
  });

  it('sin nombre propio, eres "Tú"', () => {
    const profile = { name: '', look: DEFAULT_LOOK, affinity: null };
    const { badges } = castOf(view('ffa'), profile, () => ({ name: 'X', look: DEFAULT_LOOK }));
    expect([...badges.values()][0]?.name).toBe('Tú');
  });
});
