import { describe, expect, it } from 'vitest';
import { SeededRng } from './rng';

describe('SeededRng', () => {
  it('con la misma semilla produce la misma secuencia', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('con semillas distintas produce secuencias distintas', () => {
    expect(new SeededRng(1).next()).not.toBe(new SeededRng(2).next());
  });

  it('restaurar un snapshot continúa la misma secuencia', () => {
    const rng = new SeededRng(7);
    rng.next();
    const restored = SeededRng.restore(rng.snapshot());
    expect(restored.next()).toBe(rng.next());
  });

  it('int respeta los límites', () => {
    const rng = new SeededRng(9);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});
