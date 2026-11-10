import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './AdaptiveResolution';

/** Simula `seconds` segundos de cuadros de `frameMs` y devuelve los cambios que hubo. */
function run(adaptive: AdaptiveResolution, frameMs: number, seconds: number): number[] {
  const changes: number[] = [];
  for (let t = 0; t < seconds * 1000; t += frameMs) {
    const next = adaptive.sample(frameMs);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe('AdaptiveResolution', () => {
  it('empieza con la resolución del celular, con tope en 2', () => {
    expect(new AdaptiveResolution(3).pixelRatio).toBe(2);
    expect(new AdaptiveResolution(2.625).pixelRatio).toBe(2);
    expect(new AdaptiveResolution(1).pixelRatio).toBe(1);
  });

  it('baja un escalón por segundo mientras el juego va lento, hasta 1', () => {
    const adaptive = new AdaptiveResolution(2);
    expect(run(adaptive, 33, 10)).toEqual([1.75, 1.5, 1.25, 1]);
    expect(adaptive.pixelRatio).toBe(1);
  });

  it('no cambia nada a 60 cuadros por segundo', () => {
    const adaptive = new AdaptiveResolution(2);
    expect(run(adaptive, 16.7, 20)).toEqual([]);
  });

  it('ignora el calentamiento y las pausas largas', () => {
    const adaptive = new AdaptiveResolution(2);
    expect(run(adaptive, 40, 1.4)).toEqual([]);
    expect(adaptive.sample(5000)).toBeNull();
  });

  it('vuelve a subir con holgura, pero no justo después de bajar', () => {
    const adaptive = new AdaptiveResolution(2);
    run(adaptive, 33, 3);
    expect(adaptive.pixelRatio).toBe(1.75);
    expect(run(adaptive, 8, 10)).toEqual([]);
    expect(run(adaptive, 8, 30)).toEqual([2]);
  });
});
