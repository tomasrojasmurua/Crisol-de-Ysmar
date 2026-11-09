import type { MatchState, Wizard } from '../match/state';
import { add, dot, perpendicular, scale, sub, type Vec2 } from '../math/vec2';

/**
 * Los muros cortan el paso: quien camina contra uno se queda del lado en que estaba.
 * La Muralla de raíces frena a todos; el Muro de hielo, solo a los rivales de quien lo levantó.
 */
export function blockByWalls(state: MatchState, wizard: Wizard, to: Vec2, radius: number): Vec2 {
  const from = wizard.pos;
  let pos = to;
  for (const wall of state.spells) {
    if (wall.kind !== 'wall') continue;
    if (!wall.solid && wall.team === wizard.team) continue;
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
