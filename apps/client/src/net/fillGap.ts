import type { Vec2 } from '@crisol/core';
import type { StateFrame } from '@crisol/protocol';

/**
 * Por el canal que no espera, un estado perdido no se reenvía: llega el 41 y después el 43. El
 * colchón muestra un estado por paso, así que sin el 42 se vaciaría más rápido de lo que se llena
 * y el juego se trabaría aunque la red ande. Aquí se arma el que falta entre los dos que llegaron:
 * igual al anterior, con cada cosa que se mueve a medio camino del siguiente. Sus eventos llegan
 * con el siguiente (la Sala los repite), así que no se pierde ningún golpe ni sonido.
 */
export function framesBetween(
  before: StateFrame,
  after: StateFrame,
  maxMissing: number,
): StateFrame[] {
  if (before.stage.kind !== 'playing' || after.stage.kind !== 'playing') return [];
  if (before.roundsPlayed !== after.roundsPlayed) return [];
  const missing = after.state.tick - before.state.tick - 1;
  if (missing <= 0 || missing > maxMissing) return [];
  const frames: StateFrame[] = [];
  for (let i = 1; i <= missing; i++) {
    const t = i / (missing + 1);
    frames.push({
      ...before,
      best: null,
      state: {
        ...before.state,
        tick: before.state.tick + i,
        events: [],
        wizards: moved(before.state.wizards, after.state.wizards, t),
        beasts: moved(before.state.beasts, after.state.beasts, t),
        spells: moved(before.state.spells, after.state.spells, t),
      },
    });
  }
  return frames;
}

/** Más que esto entre dos estados es un salto (un empujón, un portal): no se hace a medias. */
const JUMP = 3;

function moved<T extends { readonly id: number }>(
  from: readonly T[],
  to: readonly T[],
  t: number,
): T[] {
  const next = new Map<number, T>();
  for (const item of to) next.set(item.id, item);
  return from.map((item) => {
    const a = (item as { pos?: Vec2 }).pos;
    const b = (next.get(item.id) as { pos?: Vec2 } | undefined)?.pos;
    if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) > JUMP) return item;
    return { ...item, pos: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t } };
  });
}
