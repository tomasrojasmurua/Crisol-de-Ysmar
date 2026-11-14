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
