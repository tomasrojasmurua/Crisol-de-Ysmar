import type { WizardMatchStats } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { addMatch, EMPTY_RECORD, type FinishedMatch, parseRecord, topSpells } from './PlayerStats';

function own(patch: Partial<WizardMatchStats> = {}): WizardMatchStats {
  return {
    id: 1,
    damage: 120.4,
    taken: 80,
    knockouts: 2,
    falls: 1,
    casts: 10,
    reactions: 1,
    beasts: 0,
    spells: { spark: 6, step: 4 },
    ...patch,
  };
}

function match(id: string, outcome: FinishedMatch['outcome'], online = false): FinishedMatch {
  return { id, outcome, mode: 'duel', online, own: own() };
}

describe('historial del jugador', () => {
  it('suma partidas, rachas, modos y récords', () => {
    let record = addMatch(EMPTY_RECORD, match('a', 'win'));
    record = addMatch(record, match('b', 'win', true));
    record = addMatch(record, match('c', 'loss'));
    expect(record).toMatchObject({
      played: 3,
      wins: 2,
      streak: 0,
      bestStreak: 2,
      damage: 360,
      knockouts: 6,
      bestDamage: 120,
      online: { played: 1, wins: 1 },
      byMode: { duel: { played: 3, wins: 2 } },
    });
    expect(topSpells(record, 1)).toEqual([{ spell: 'spark', count: 18 }]);
  });

  it('no suma dos veces la misma partida', () => {
    const once = addMatch(EMPTY_RECORD, match('a', 'win'));
    expect(addMatch(once, match('a', 'win'))).toBe(once);
  });

  it('lo guardado sobrevive a un viaje por texto y un respaldo roto da un historial vacío', () => {
    const record = addMatch(EMPTY_RECORD, match('a', 'draw'));
    expect(parseRecord(JSON.stringify(record))).toEqual(record);
    expect(parseRecord('no es json')).toEqual(EMPTY_RECORD);
    expect(parseRecord('{"played":-3,"wins":9,"spells":{"inventado":4}}')).toEqual(EMPTY_RECORD);
  });
});
