import type { MatchState, Wizard } from '../match/state';
import { add, distance, dot, normalize, perpendicular, scale, sub, type Vec2 } from '../math/vec2';

/**
 * Los muros cortan el paso: quien camina contra uno se queda del lado en que estaba.
 * La Muralla de raíces frena a todos; el Muro de hielo, solo a los rivales de quien lo levantó.
 */
export function blockByWalls(state: MatchState, wizard: Wizard, to: Vec2, radius: number): Vec2 {
  const from = wizard.pos;
  let pos = to;
  for (const wall of state.spells) {
    if (wall.kind !== 'wall' || wall.passable) continue;
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

/**
 * El Anillo de zarzas encierra: quien estaba dentro no sale caminando y quien estaba fuera
 * no entra. Saltar o teletransportarse sí lo cruza.
 */
export function blockByRings(state: MatchState, wizard: Wizard, to: Vec2, radius: number): Vec2 {
  let pos = to;
  for (const ring of state.spells) {
    if (ring.kind !== 'thornRing') continue;
    const inside = distance(wizard.pos, ring.pos) < ring.radius;
    const offset = sub(pos, ring.pos);
    const d = distance(pos, ring.pos);
    const outward = normalize(offset, { x: 1, z: 0 });
    if (inside && d > ring.radius - radius) {
      pos = add(ring.pos, scale(outward, ring.radius - radius));
    } else if (!inside && d < ring.radius + radius) {
      pos = add(ring.pos, scale(outward, ring.radius + radius));
    }
  }
  return pos;
}
