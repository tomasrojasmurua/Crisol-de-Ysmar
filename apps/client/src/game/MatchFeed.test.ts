import { DUEL_RULES } from '@crisol/content';
import { createMatch, type GameEvent, type MatchState, TICK_RATE } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { MatchFeed } from './MatchFeed';

const NAMES: Record<number, string> = { 1: 'Tomás', 2: 'Pedro', 3: 'Ana', 4: 'Luis' };
const names = { playerId: 1, nameOf: (id: number) => NAMES[id] ?? 'Hechicero' };

/** 2v2: tú (1) y Ana (3) contra Pedro (2) y Luis (4). */
function teams(): MatchState {
  return createMatch(
    {
      seed: 3,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: { x: 0, z: 8 } },
        { team: 0, spawn: { x: 2, z: 0 } },
        { team: 1, spawn: { x: 2, z: 8 } },
      ],
    },
    DUEL_RULES,
  );
}

const hit = (sourceId: number, targetId: number, form: 'bolt' | 'zone' = 'bolt'): GameEvent =>
  ({ type: 'hit', sourceId, targetId, amount: 30, form }) as GameEvent;

function fall(state: MatchState, id: number): GameEvent {
  const w = state.wizards.find((x) => x.id === id);
  if (w) w.fallen = { respawnTicks: null, reviveProgress: 0 };
  return { type: 'defeated', wizardId: id };
}

describe('los avisos de la partida', () => {
  it('dice quién derribó a quién, en tu voz si fuiste tú', () => {
    const state = teams();
    const feed = new MatchFeed();
    const lines = feed.onStep([hit(1, 2), fall(state, 2)], state, names);
    expect(lines[0]).toMatchObject({ text: 'Tú derribaste a Pedro', tone: 'own' });
    const other = feed.onStep([hit(4, 3), fall(state, 3)], state, names);
    expect(other[0]).toMatchObject({ text: 'Luis derribó a Ana', tone: 'foe' });
  });

  it('dos derribos seguidos del mismo mago son un doble derribo', () => {
    const state = teams();
    const feed = new MatchFeed();
    feed.onStep([hit(1, 2), fall(state, 2)], state, names);
    state.tick += 3 * TICK_RATE;
    const lines = feed.onStep([hit(1, 4), fall(state, 4)], state, names);
    expect(lines.map((l) => l.text)).toContain('¡Doble derribo!');
  });

  it('la zona también derriba, y avisa cuando a un equipo le queda uno', () => {
    const state = teams();
    const feed = new MatchFeed();
    const lines = feed.onStep([hit(2, 3, 'zone'), fall(state, 3)], state, names);
    expect(lines.map((l) => l.text)).toEqual([
      'Cayó Ana en la zona',
      'Eres el último en pie de tu equipo',
    ]);
    // Una sola vez por equipo y ronda: ahora le toca al equipo rival.
    expect(feed.onStep([fall(state, 4)], state, names).map((l) => l.text)).toEqual([
      'Cayó Luis',
      'Pedro es el último en pie',
    ]);
    expect(feed.onStep([hit(1, 3), fall(state, 3)], state, names).map((l) => l.text)).toEqual([
      'Cayó Ana',
    ]);
  });
});
