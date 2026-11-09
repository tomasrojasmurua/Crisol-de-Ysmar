/** Vector en el plano del suelo de la arena (x hacia la derecha, z hacia el frente). */
export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export const ZERO: Vec2 = { x: 0, z: 0 };

export const vec = (x: number, z: number): Vec2 => ({ x, z });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
export const length = (a: Vec2): number => Math.hypot(a.x, a.z);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Vector de largo 1, o `fallback` si `a` es casi cero. */
export function normalize(a: Vec2, fallback: Vec2 = ZERO): Vec2 {
  const len = length(a);
  return len < 1e-6 ? fallback : { x: a.x / len, z: a.z / len };
}

/** Limita el largo de un vector, útil para el joystick. */
export function clampLength(a: Vec2, max: number): Vec2 {
  const len = length(a);
  return len > max ? scale(a, max / len) : a;
}

/** Perpendicular, girando 90° a la izquierda. */
export const perpendicular = (a: Vec2): Vec2 => ({ x: -a.z, z: a.x });

/** Mantiene un punto dentro de un círculo centrado en el origen. */
export function clampToCircle(p: Vec2, radius: number): Vec2 {
  const len = length(p);
  return len > radius ? scale(p, radius / len) : p;
}

/** Distancia de un punto a un segmento. */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / lenSq));
  return distance(p, add(a, scale(ab, t)));
}
