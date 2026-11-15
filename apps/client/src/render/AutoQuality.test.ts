import { describe, expect, it } from 'vitest';
import { AutoQuality } from './AutoQuality';

/** Simula `seconds` segundos con ese costo por cuadro; devuelve en qué segundo cambió. */
function run(auto: AutoQuality, frameMs: number, seconds: number, canLower = false): number | null {
  let t = 0;
  while (t < seconds * 1000) {
    if (auto.sample(frameMs, canLower)) return Math.round(t / 1000);
    t += frameMs;
  }
  return null;
}

describe('AutoQuality', () => {
  it('no cambia en un celular que va fluido', () => {
    expect(run(new AutoQuality(), 16.7, 120)).toBeNull();
  });

  it('cambia si sigue lento con la resolución ya al mínimo', () => {
    const at = run(new AutoQuality(), 50, 60);
    expect(at).not.toBeNull();
    expect(at).toBeLessThanOrEqual(12);
  });

  it('deja trabajar primero a la resolución mientras pueda bajar', () => {
    expect(run(new AutoQuality(), 50, 60, true)).toBeNull();
  });

  it('no cuenta los tirones del comienzo de la partida', () => {
    const auto = new AutoQuality();
    expect(run(auto, 60, 4)).toBeNull();
    expect(run(auto, 16.7, 60)).toBeNull();
  });

  it('cambia una sola vez, y nunca si el jugador eligió a mano', () => {
    const auto = new AutoQuality();
    expect(run(auto, 50, 60)).not.toBeNull();
    expect(run(auto, 50, 60)).toBeNull();
    const chosen = new AutoQuality();
    chosen.stop();
    expect(run(chosen, 50, 60)).toBeNull();
  });
});
