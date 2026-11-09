import { describe, expect, it } from 'vitest';
import { FixedStepClock, TICK_MS } from './fixedStep';

describe('FixedStepClock', () => {
  it('no avanza si no pasó un paso completo', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(TICK_MS / 2).steps).toBe(0);
  });

  it('acumula el tiempo sobrante entre cuadros', () => {
    const clock = new FixedStepClock();
    clock.advance(TICK_MS * 0.6);
    expect(clock.advance(TICK_MS * 0.6).steps).toBe(1);
  });

  it('entrega alpha entre 0 y 1 para interpolar', () => {
    const clock = new FixedStepClock();
    const { alpha } = clock.advance(TICK_MS * 1.5);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('limita los pasos por cuadro tras una pausa larga', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(10_000).steps).toBe(5);
  });
});
