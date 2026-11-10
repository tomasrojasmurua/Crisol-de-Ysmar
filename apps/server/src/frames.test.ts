import { StateDecoder, StateEncoder } from '@crisol/protocol';
import { describe, expect, it } from 'vitest';
import { DuelHost } from './duel';

/** Dos jugadores que se van al empezar: la IA juega por ambos y hay combate de verdad. */
function botDuel(): DuelHost {
  let n = 0;
  const duel = new DuelHost(11, () => `token-${++n}`);
  duel.join({ name: 'A' });
  duel.join({ name: 'B' });
  duel.leave(1);
  duel.leave(2);
  return duel;
}

describe('lo que la Sala manda en cada paso', () => {
  it('después del primero, cada estado pesa menos de 2 KB y llega idéntico', () => {
    const duel = botDuel();
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    const sizes: number[] = [];
    let first = 0;
    for (let tick = 0; tick < 30 * 60; tick++) {
      duel.tick();
      if (!duel.state) continue;
      const frame = duel.frameFor(1, structuredClone(duel.state));
      const bytes = encoder.encode(frame);
      if (first === 0) first = bytes.length;
      else sizes.push(bytes.length);
      const got = decoder.decode(bytes) as typeof frame;
      expect(got.state.tick).toBe(frame.state.tick);
      frame.state.wizards.forEach((w, i) => {
        const g = got.state.wizards[i];
        expect(g?.id).toBe(w.id);
        expect(Math.abs((g?.hp ?? 0) - w.hp)).toBeLessThan(0.0006);
        expect(Math.abs((g?.pos.x ?? 0) - w.pos.x)).toBeLessThan(0.0006);
      });
      expect(got.state.spells.map((s) => s.id)).toEqual(frame.state.spells.map((s) => s.id));
    }
    const average = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const p99 = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length * 0.99)] ?? 0;
    // Como texto completo eran varios KB por paso; ahora va solo lo que cambió.
    expect(JSON.stringify(duel.state).length).toBeGreaterThan(average * 5);
    expect(average).toBeLessThan(600);
    expect(p99).toBeLessThan(2048);
    expect(first).toBeGreaterThan(average);
  });

  it('un rival con Velo, que no ves, llega quieto, sin tejido y marcado como oculto', () => {
    const duel = botDuel();
    for (let i = 0; i < 30; i++) duel.tick();
    const state = duel.state;
    if (!state) throw new Error('sin partida');
    const rival = state.wizards.find((w) => w.id === 2);
    const me = state.wizards.find((w) => w.id === 1);
    if (!rival || !me) throw new Error('faltan magos');
    const seenAt = { ...rival.pos };
    duel.frameFor(1, structuredClone(state));
    // Se esconde lejos y se mueve.
    rival.statuses.veiled = { ticks: 300, sourceId: 2 };
    rival.pos = { x: me.pos.x + 20, z: me.pos.z };
    rival.weave = ['umbra'];
    const frame = duel.frameFor(1, structuredClone(state));
    const shown = frame.state.wizards.find((w) => w.id === 2);
    expect(frame.hidden).toEqual([2]);
    expect(shown?.pos).toEqual(seenAt);
    expect(shown?.weave).toEqual([]);
    // Para su dueño no cambia nada.
    const own = duel.frameFor(2, structuredClone(state));
    expect(own.hidden).toEqual([]);
    expect(own.state.wizards.find((w) => w.id === 2)?.weave).toEqual(['umbra']);
  });
});
