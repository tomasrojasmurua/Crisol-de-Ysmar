import { describe, expect, it } from 'vitest';
import { CALM_FPS, FrameLimiter, PLAY_FPS } from './FrameLimiter';

/** Cuántos cuadros se dibujan en un segundo de una pantalla de `hz`. */
function drawn(hz: number, fps: number): number {
  const limiter = new FrameLimiter();
  let count = 0;
  for (let i = 0; i < hz; i++) if (limiter.ready((i * 1000) / hz, fps)) count++;
  return count;
}

describe('FrameLimiter', () => {
  it('en una pantalla de 120 Hz dibuja 60 cuadros en partida', () => {
    expect(drawn(120, PLAY_FPS)).toBe(60);
  });

  it('en una pantalla de 60 Hz no se salta ninguno en partida', () => {
    expect(drawn(60, PLAY_FPS)).toBe(60);
  });

  it('en menús dibuja la mitad', () => {
    expect(drawn(60, CALM_FPS)).toBe(30);
    expect(drawn(120, CALM_FPS)).toBe(30);
  });
});
