import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { edgeSpot } from './EdgeIndicators';

function camera(): THREE.PerspectiveCamera {
  // En (0, 7, 7) mirando hacia -z, como la cámara sobre el hombro.
  const cam = new THREE.PerspectiveCamera(55, 844 / 390, 0.1, 400);
  cam.position.set(0, 7, 7);
  cam.lookAt(0, 1.2, -4);
  cam.updateMatrixWorld();
  return cam;
}

describe('edgeSpot', () => {
  it('no pone flecha si el rival se ve', () => {
    expect(edgeSpot(camera(), { x: 0, z: -5 }, 844, 390)).toBeNull();
  });

  it('un rival muy a la derecha da una flecha en el borde derecho que apunta a la derecha', () => {
    const spot = edgeSpot(camera(), { x: 30, z: -3 }, 844, 390);
    expect(spot?.x).toBeGreaterThan(700);
    expect(spot?.angle).toBeGreaterThan(Math.PI / 4);
    expect(spot?.angle).toBeLessThan((3 * Math.PI) / 4);
  });

  it('un rival a la espalda da una flecha abajo que apunta hacia abajo', () => {
    const spot = edgeSpot(camera(), { x: 0, z: 20 }, 844, 390);
    expect(spot?.y).toBeGreaterThan(300);
    expect(Math.abs(Math.cos(spot?.angle ?? 0))).toBeGreaterThan(0.9);
    expect(Math.cos(spot?.angle ?? 0)).toBeLessThan(0);
  });
});
