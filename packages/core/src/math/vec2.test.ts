import { describe, expect, it } from 'vitest';
import { clampToCircle, distanceToSegment, normalize, vec } from './vec2';

describe('vec2', () => {
  it('normaliza y usa el respaldo para vectores nulos', () => {
    expect(normalize(vec(3, 4))).toEqual({ x: 0.6, z: 0.8 });
    expect(normalize(vec(0, 0), vec(1, 0))).toEqual({ x: 1, z: 0 });
  });

  it('mantiene puntos dentro del círculo', () => {
    expect(clampToCircle(vec(10, 0), 5)).toEqual({ x: 5, z: 0 });
    expect(clampToCircle(vec(1, 1), 5)).toEqual({ x: 1, z: 1 });
  });

  it('mide la distancia a un segmento', () => {
    expect(distanceToSegment(vec(0, 2), vec(-1, 0), vec(1, 0))).toBe(2);
    expect(distanceToSegment(vec(3, 0), vec(-1, 0), vec(1, 0))).toBe(2);
  });
});
