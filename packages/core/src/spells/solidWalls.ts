import type { MatchState } from '../match/state';
import { add, dot, perpendicular, scale, sub, type Vec2 } from '../math/vec2';

/**
 * Las murallas sólidas cortan el paso: quien camina contra una se queda del lado en que estaba.
 * `from` es dónde estaba antes de moverse; decide de qué lado del muro queda.
 */
export function blockBySolidWalls(state: MatchState, from: Vec2, to: Vec2, radius: number): Vec2 {
  let pos = to;
  for (const wall of state.spells) {
    if (wall.kind !== 'wall' || !wall.solid) continue;
    const offset = sub(pos, wall.center);
    const along = dot(offset, wall.along);
    if (Math.abs(along) > wall.halfLength + radius) continue;
    const normal = perpendicular(wall.along);
    const across = dot(offset, normal);
    const min = wall.thickness + radius;
    if (Math.abs(across) >= min) continue;
    const side = dot(sub(from, wall.center), normal) >= 0 ? 1 : -1;
    pos = add(wall.center, add(scale(wall.along, along), scale(normal, side * min)));
  }
  return pos;
}
