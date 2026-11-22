import type { StateFrame } from '@crisol/protocol';
import { describe, expect, it } from 'vitest';
import { framesBetween } from './fillGap';

function frame(tick: number, x: number, round = 0): StateFrame {
  return {
    ack: 0,
    stage: { kind: 'playing' },
    wins: [],
    roundsPlayed: round,
    seriesWinner: null,
    glyphs: {},
    best: null,
    hidden: [],
    state: {
      tick,
      wizards: [{ id: 1, pos: { x, z: 0 }, hp: 100 }],
      beasts: [],
      spells: [],
      events: [{ type: 'golpe' }],
    },
  } as unknown as StateFrame;
}

describe('estados que faltan', () => {
  it('arma los del medio con cada cosa a medio camino y sin eventos', () => {
    const filled = framesBetween(frame(10, 0), frame(13, 3), 8);
    expect(filled.map((f) => f.state.tick)).toEqual([11, 12]);
    expect(filled.map((f) => f.state.wizards[0]?.pos.x)).toEqual([1, 2]);
    expect(filled.every((f) => f.state.events.length === 0)).toBe(true);
  });

  it('no arma nada si no falta ninguno, si es otra ronda o si falta demasiado', () => {
    expect(framesBetween(frame(10, 0), frame(11, 1), 8)).toEqual([]);
    expect(framesBetween(frame(10, 0), frame(13, 1, 1), 8)).toEqual([]);
    expect(framesBetween(frame(10, 0), frame(30, 1), 8)).toEqual([]);
  });

  it('un salto (empujón, portal) no se hace a medias', () => {
    const filled = framesBetween(frame(10, 0), frame(12, 9), 8);
    expect(filled[0]?.state.wizards[0]?.pos.x).toBe(0);
  });
});
