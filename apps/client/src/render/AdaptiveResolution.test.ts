import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './AdaptiveResolution';

type FrameCost = number | ((pixelRatio: number) => number);

/**
 * Simula `seconds` segundos de juego y devuelve los cambios de resolución que hubo. El costo
 * del cuadro puede depender de la resolución, como en un celular de verdad.
 */
function run(adaptive: AdaptiveResolution, cost: FrameCost, seconds: number): number[] {
  const changes: number[] = [];
  let t = 0;
  while (t < seconds * 1000) {
    const frameMs = typeof cost === 'number' ? cost : cost(adaptive.pixelRatio);
    const next = adaptive.sample(frameMs);
    if (next !== null) changes.push(next);
    t += frameMs;
  }
  return changes;
}

/** La tarjeta gráfica no da abasto: menos píxeles, cuadros más cortos. */
const gpuBound =
  (msAtFullRes: number) =>
  (pixelRatio: number): number =>
    (msAtFullRes * pixelRatio * pixelRatio) / 4;

describe('AdaptiveResolution', () => {
  it('empieza con la resolución del celular, con tope en 2', () => {
    expect(new AdaptiveResolution(3).pixelRatio).toBe(2);
    expect(new AdaptiveResolution(2.625).pixelRatio).toBe(2);
    expect(new AdaptiveResolution(1).pixelRatio).toBe(1);
  });

  it('baja escalones mientras bajar ayude, hasta llegar a ir fluido', () => {
    const adaptive = new AdaptiveResolution(2);
    expect(run(adaptive, gpuBound(40), 10)).toEqual([1.75, 1.5, 1.25]);
    expect(adaptive.pixelRatio).toBe(1.25);
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

  it('si bajar no hace más fluido el juego, deshace la bajada y no vuelve a pixelar', () => {
    const adaptive = new AdaptiveResolution(2);
    // 50 cuadros por segundo por la lógica, no por los píxeles.
    expect(run(adaptive, 21, 30)).toEqual([1.75, 2]);
    expect(adaptive.pixelRatio).toBe(2);
  });

  it('en una pantalla de 60 Hz vuelve a subir cuando sobra, pero no justo después de bajar', () => {
    const adaptive = new AdaptiveResolution(2);
    run(adaptive, gpuBound(24), 3);
    expect(adaptive.pixelRatio).toBe(1.75);
    // Pasó el momento pesado: el celular anda a 60, el tope de Safari en iPhone.
    expect(run(adaptive, 16.7, 10)).toEqual([]);
    expect(run(adaptive, 16.7, 30)).toEqual([2]);
  });

  it('si subir vuelve a trabar, espera cada vez más antes de intentarlo de nuevo', () => {
    const adaptive = new AdaptiveResolution(2);
    const heavy = gpuBound(24);
    // Baja, sube a los ~30 s, vuelve a trabar y baja; la siguiente espera es de 60 s.
    expect(run(adaptive, (ratio) => (ratio === 2 ? heavy(ratio) : 16.7), 40)).toEqual([
      1.75, 2, 1.75,
    ]);
    expect(run(adaptive, 16.7, 45)).toEqual([]);
    expect(run(adaptive, 16.7, 25)).toEqual([2]);
  });
});
