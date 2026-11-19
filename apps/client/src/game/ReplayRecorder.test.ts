import type { Highlight, MatchState } from '@crisol/core';
import { describe, expect, it } from 'vitest';
import { ENDING_TICKS, REPLAY_CAPACITY, ReplayRecorder } from './ReplayRecorder';

const frame = (tick: number) => ({ state: { tick } as MatchState, hidden: [] });

const play = (endTick: number, ticks: number, score = 100): Highlight => ({
  wizardId: 2,
  round: 1,
  damage: 80,
  hits: 3,
  knockouts: 1,
  targets: 1,
  reactions: 0,
  spells: ['spark'],
  ticks,
  endTick,
  decisive: false,
  score,
});

const ticksOf = (recorder: ReplayRecorder): number[] =>
  recorder.clip()?.frames.map((f) => f.state.tick) ?? [];

describe('la repetición', () => {
  it('aparta la jugada con un segundo antes y uno después', () => {
    const recorder = new ReplayRecorder();
    for (let tick = 0; tick <= 200; tick++) recorder.push(frame(tick));
    recorder.offer(play(150, 60));
    const ticks = ticksOf(recorder);
    expect(ticks[0]).toBe(45);
    expect(ticks.at(-1)).toBe(195);
    expect(recorder.clip()?.highlight?.endTick).toBe(150);
  });

  it('la jugada guardada sobrevive a las rondas siguientes', () => {
    const recorder = new ReplayRecorder();
    for (let tick = 0; tick <= 200; tick++) recorder.push(frame(tick));
    recorder.offer(play(150, 60));
    // Otra ronda: el reloj vuelve a cero y una jugada peor no la reemplaza (la Sala no la manda).
    for (let tick = 0; tick <= 400; tick++) recorder.push(frame(tick));
    expect(ticksOf(recorder)[0]).toBe(45);
  });

  it('si los pasos de la jugada ya no están, repite el desenlace', () => {
    const recorder = new ReplayRecorder();
    for (let tick = 0; tick <= REPLAY_CAPACITY + 500; tick++) recorder.push(frame(tick));
    recorder.offer(play(100, 30));
    const clip = recorder.clip();
    expect(clip?.highlight).toBeNull();
    expect(clip?.frames).toHaveLength(ENDING_TICKS);
    expect(clip?.frames.at(-1)?.state.tick).toBe(REPLAY_CAPACITY + 500);
  });

  it('no guarda dos veces el mismo paso y olvida todo al empezar otra partida', () => {
    const recorder = new ReplayRecorder();
    for (let tick = 0; tick <= 60; tick++) {
      recorder.push(frame(tick));
      recorder.push(frame(tick));
    }
    expect(ticksOf(recorder)).toHaveLength(61);
    recorder.reset();
    expect(recorder.clip()).toBeNull();
  });
});
