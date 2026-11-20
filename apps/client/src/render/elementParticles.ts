import type { ElementId } from '@crisol/core';
import type { ParticleShape } from './particleAtlas';

/** La chispa propia de cada elemento: así cada magia se reconoce por cómo se deshace. */
export const ELEMENT_SHAPE: Readonly<Record<ElementId, ParticleShape>> = {
  brasa: 'ember',
  marea: 'drop',
  tormenta: 'spark',
  raiz: 'leaf',
  umbra: 'smoke',
};

/**
 * Cómo se mueve la estela de cada elemento detrás de un proyectil: el fuego sube, el agua
 * gotea, el rayo salta para cualquier lado, las hojas flotan y la sombra se queda quieta.
 */
export function trailMotion(element: ElementId): {
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly gravity: number;
  readonly size: number;
  readonly life: number;
} {
  const jitter = (amount: number): number => (Math.random() - 0.5) * amount;
  switch (element) {
    case 'brasa':
      return { vx: jitter(0.6), vy: 1.6, vz: jitter(0.6), gravity: 1.5, size: 0.5, life: 0.4 };
    case 'marea':
      return { vx: jitter(0.4), vy: 0.6, vz: jitter(0.4), gravity: -9, size: 0.35, life: 0.45 };
    case 'tormenta':
      return { vx: jitter(7), vy: jitter(5), vz: jitter(7), gravity: 0, size: 0.4, life: 0.18 };
    case 'raiz':
      return { vx: jitter(1), vy: 0.2, vz: jitter(1), gravity: -1.2, size: 0.4, life: 0.6 };
    case 'umbra':
      return { vx: jitter(0.3), vy: 0.25, vz: jitter(0.3), gravity: 0.3, size: 0.7, life: 0.55 };
  }
}
