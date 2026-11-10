import { afterEach, describe, expect, it, vi } from 'vitest';
import { LagSimulator } from './LagSimulator';

describe('simulador de mala conexión', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('solo se activa si la dirección lo pide', () => {
    expect(LagSimulator.fromUrl('')).toBeNull();
    expect(LagSimulator.fromUrl('?sala=K7QF')).toBeNull();
    const lag = LagSimulator.fromUrl('?lag=150&perdida=5');
    expect(lag?.lagMs).toBe(150);
    expect(lag?.lossPercent).toBe(5);
  });

  it('demora los mensajes pero nunca los desordena', () => {
    vi.useFakeTimers();
    const lag = new LagSimulator(150, 30);
    const got: number[] = [];
    for (let i = 0; i < 200; i++) {
      lag.incoming(() => got.push(i));
      vi.advanceTimersByTime(3);
    }
    expect(got.length).toBeLessThan(200);
    vi.advanceTimersByTime(5000);
    expect(got).toEqual([...Array(200).keys()]);
  });
});
