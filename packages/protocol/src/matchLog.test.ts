import { describe, expect, it } from 'vitest';
import { modeKey, parseMatchLog } from './matchLog';

const log = {
  format: 1,
  source: 'ia',
  mode: 'duel',
  botLevel: 'master',
  wizards: [
    { id: 1, team: 0, human: true },
    { id: 2, team: 1, human: false },
  ],
  rounds: [
    {
      ticks: 900,
      winnerTeam: 0,
      casts: [
        [30, 1, 'fireball'],
        [40, 2, 'no-existe'],
      ],
      hits: [[45, 1, 2, 12.5]],
      blocked: [[60, 2, 1]],
      combos: [[70, 1, 2, 'steam']],
      falls: [[900, 2]],
    },
  ],
  winnerTeam: 0,
  version: 'v80',
};

describe('registro de partidas', () => {
  it('lee un registro válido y descarta las filas raras', () => {
    const parsed = parseMatchLog(JSON.stringify(log));
    expect(parsed?.rounds[0]?.casts).toEqual([[30, 1, 'fireball']]);
    expect(parsed?.rounds[0]?.hits).toEqual([[45, 1, 2, 12.5]]);
    expect(parsed?.wizards).toHaveLength(2);
  });

  it('rechaza lo que no tiene la forma esperada', () => {
    expect(parseMatchLog('no es json')).toBeNull();
    expect(parseMatchLog(JSON.stringify({ ...log, format: 2 }))).toBeNull();
    expect(parseMatchLog(JSON.stringify({ ...log, mode: 'raro' }))).toBeNull();
    expect(parseMatchLog(JSON.stringify({ ...log, rounds: [] }))).toBeNull();
    expect(parseMatchLog(JSON.stringify({ ...log, nombre: 'Tomás' }))).not.toHaveProperty('nombre');
  });

  it('da el modo corto', () => {
    expect(modeKey({ kind: 'duel' })).toBe('duel');
    expect(modeKey({ kind: 'teams', size: 2 })).toBe('teams2');
    expect(modeKey({ kind: 'ffa', players: 4 })).toBe('ffa4');
  });
});
