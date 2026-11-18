import { describe, expect, it } from 'vitest';
import { CALM_FPS, FrameLimiter, PLAY_FPS } from './FrameLimiter';

/** Cuántos cuadros se dibujan en el segundo segundo de una pantalla de `hz` (con algo de vaivén). */
function drawn(hz: number, fps: number): number {
  const limiter = new FrameLimiter();
  let count = 0;
  for (let i = 0; i < hz * 2; i++) {
    const jitter = i % 2 === 0 ? 0.4 : -0.4;
    const ready = limiter.ready((i * 1000) / hz + jitter, fps);
    if (ready && i >= hz) count++;
  }
  return count;
}

describe('FrameLimiter', () => {
  it('en una pantalla de 120 Hz dibuja 60 cuadros en partida', () => {
    expect(drawn(120, PLAY_FPS)).toBe(60);
  });

  it('en una pantalla de 60 Hz no se salta ninguno en partida', () => {
    expect(drawn(60, PLAY_FPS)).toBe(60);
  });

  it('en una pantalla de 90 Hz va parejo a 90 (antes quedaba en 45 disparejos)', () => {
    expect(drawn(90, PLAY_FPS)).toBe(90);
  });

  it('en una pantalla de 144 Hz dibuja uno de cada dos', () => {
    expect(drawn(144, PLAY_FPS)).toBe(72);
  });

  it('en menús dibuja la mitad o menos, siempre parejo', () => {
    expect(drawn(60, CALM_FPS)).toBe(30);
    expect(drawn(90, CALM_FPS)).toBe(30);
    expect(drawn(120, CALM_FPS)).toBe(30);
  });
});

/**
 * Una pantalla de `hz` donde dibujar cada cuadro tarda lo que dice `costs`, en ronda: si pasa de un cuadro de pantalla,
 * la llamada siguiente llega uno o más cuadros después. Devuelve los huecos entre cuadros
 * dibujados durante el segundo segundo.
 */
function drawnGaps(hz: number, fps: number, costs: readonly number[]): number[] {
  const limiter = new FrameLimiter();
  const vsync = 1000 / hz;
  const gaps: number[] = [];
  let now = 0;
  let lastDrawn = Number.NaN;
  let drawnCount = 0;
  while (now < 2000) {
    if (limiter.ready(now, fps)) {
      if (now >= 1000) gaps.push(now - lastDrawn);
      lastDrawn = now;
      const costMs = costs[drawnCount++ % costs.length] ?? 0;
      now += Math.max(1, Math.ceil(costMs / vsync - 1e-9)) * vsync;
    } else {
      now += vsync;
    }
  }
  return gaps;
}

describe('FrameLimiter con cuadros caros', () => {
  it('en 120 Hz, si algunos cuadros tardan más de un cuadro de pantalla, sigue parejo a 60', () => {
    // Antes el promedio de huecos (8 y 17 ms) parecía una pantalla de 80 Hz y se dibujaba en
    // cada llamada: iba a 96 cuadros disparejos, con mucho más trabajo gráfico (Galaxy A35).
    const gaps = drawnGaps(120, PLAY_FPS, [6, 6, 6, 12]);
    expect(gaps.length).toBeGreaterThanOrEqual(59);
    expect(gaps.length).toBeLessThanOrEqual(61);
    for (const gap of gaps) expect(gap).toBeCloseTo(1000 / 60, 0);
  });

  it('en 120 Hz con cuadros baratos también va a 60', () => {
    const gaps = drawnGaps(120, PLAY_FPS, [7, 9]);
    for (const gap of gaps) expect(gap).toBeCloseTo(1000 / 60, 0);
  });

  it('si no alcanza ni a 60, dibuja en cada llamada que llega (no se salta de más)', () => {
    const gaps = drawnGaps(120, PLAY_FPS, [20]);
    for (const gap of gaps) expect(gap).toBeCloseTo(25, 0);
  });

  it('si la pantalla baja de 120 a 60 Hz, sigue dibujando todos los cuadros', () => {
    const limiter = new FrameLimiter();
    for (let i = 1; i <= 240; i++) limiter.ready((i * 1000) / 120, PLAY_FPS);
    let drawnCount = 0;
    for (let i = 1; i <= 60; i++) {
      if (limiter.ready(2000 + (i * 1000) / 60, PLAY_FPS)) drawnCount++;
    }
    expect(drawnCount).toBe(60);
  });
});
