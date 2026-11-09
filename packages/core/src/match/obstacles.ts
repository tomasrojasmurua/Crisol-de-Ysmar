import { distance, type Vec2 } from '../math/vec2';
import type { GameRules, Obstacle } from '../rules';

/**
 * Saca un círculo de radio `radius` de todos los obstáculos que pisa: así un mago o una bestia
 * se desliza por el costado de un árbol en vez de atravesarlo. Dos pasadas bastan para
 * los rincones entre dos obstáculos.
 */
export function pushOutOfObstacles(
  pos: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
): Vec2 {
  let x = pos.x;
  let z = pos.z;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = x - o.x;
      const dz = z - o.z;
      const min = o.radius + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) {
        x = o.x + min;
        continue;
      }
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    }
  }
  return x === pos.x && z === pos.z ? pos : { x, z };
}

/** El obstáculo que toca un círculo, si hay alguno. */
export function obstacleAt(
  pos: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
): Obstacle | undefined {
  return obstacles.find((o) => distance(pos, o) < o.radius + radius);
}

/** Si un obstáculo corta la línea entre dos puntos (con un margen a cada lado). */
export function lineBlocked(a: Vec2, b: Vec2, obstacles: readonly Obstacle[], margin = 0): boolean {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  for (const o of obstacles) {
    const t =
      len2 > 0 ? Math.max(0, Math.min(1, ((o.x - a.x) * abx + (o.z - a.z) * abz) / len2)) : 0;
    const px = a.x + abx * t - o.x;
    const pz = a.z + abz * t - o.z;
    const r = o.radius + margin;
    if (px * px + pz * pz < r * r) return true;
  }
  return false;
}

/** Mueve a un cuerpo dentro de la arena y fuera de los obstáculos. */
export function placeInArena(pos: Vec2, radius: number, rules: GameRules): Vec2 {
  const limit = rules.arenaRadius - radius;
  const len = Math.hypot(pos.x, pos.z);
  const inside = len > limit ? { x: (pos.x / len) * limit, z: (pos.z / len) * limit } : pos;
  return pushOutOfObstacles(inside, radius, rules.map.obstacles);
}
