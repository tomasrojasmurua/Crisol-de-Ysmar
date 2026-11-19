import type { Highlight, MatchState } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import type { MatchView } from './MatchView';
import { ReplayView } from './ReplayView';

const frame = (tick: number, x: number) => ({
  state: {
    tick,
    events: [],
    spells: [],
    wizards: [{ id: 2, pos: { x, z: 0 } }],
  } as unknown as MatchState,
  hidden: [],
});

const best = { wizardId: 2, endTick: 20, round: 1 } as Highlight;

describe('la repetición en pantalla', () => {
  it('va sobre quien hizo la jugada, en cámara lenta cerca del golpe y queda quieta al final', () => {
    const frames = Array.from({ length: 31 }, (_, i) => frame(i, i));
    const view = new ReplayView({ highlight: best, frames }, { playerId: 1 } as MatchView);
    expect(view.playerId).toBe(2);
    let steps = 0;
    while (!view.done && steps < 500) {
      view.step();
      steps++;
    }
    // 30 pasos guardados, los que caen a 12 pasos del golpe al doble, y 30 quieta al final.
    const slow = frames.filter((f) => f.state.tick > 0 && Math.abs(f.state.tick - 20) <= 12).length;
    expect(steps).toBe(30 + slow + 30);
  });

  it('en cámara lenta el movimiento se reparte sin volver atrás', () => {
    const frames = Array.from({ length: 31 }, (_, i) => frame(i, i));
    const view = new ReplayView({ highlight: best, frames }, { playerId: 1 } as MatchView);
    while (view.state.tick < 12) view.step();
    // El paso guardado 12 va en cámara lenta: dura dos pasos de reloj, de 11 a 12.
    expect(view.state.tick).toBe(12);
    expect(view.interpolated(2, { x: 12, z: 0 }, 0.5).x).toBeCloseTo(11.25);
    view.step();
    expect(view.state.tick).toBe(12);
    expect(view.interpolated(2, { x: 12, z: 0 }, 0.5).x).toBeCloseTo(11.75);
  });
});
