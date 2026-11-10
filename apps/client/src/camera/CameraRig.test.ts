import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig } from './CameraRig';

function rig(): CameraRig {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  const r = new CameraRig(camera);
  // Empieza en (0, 10): mira hacia la plaza, o sea hacia -z.
  r.update({ x: 0, z: 10 }, null, 1 / 60);
  return r;
}

function run(
  r: CameraRig,
  focus: { id: number; pos: { x: number; z: number } } | null,
  seconds: number,
) {
  for (let t = 0; t < seconds; t += 1 / 60) r.update({ x: 0, z: 10 }, focus, 1 / 60);
}

describe('CameraRig', () => {
  it('sin nada fijado no gira sola', () => {
    const r = rig();
    run(r, null, 2);
    expect(r.forward().z).toBeCloseTo(-1, 2);
  });

  it('gira hacia lo fijado con velocidad limitada, no de golpe', () => {
    const r = rig();
    // Fijado a la derecha (+x): 90° de giro.
    const focus = { id: 7, pos: { x: 8, z: 10 } };
    run(r, focus, 0.2);
    expect(r.forward().x).toBeLessThan(0.7);
    run(r, focus, 2);
    expect(r.forward().x).toBeCloseTo(1, 1);
  });

  it('mientras se mantiene el joystick, la dirección no cambia aunque la cámara gire', () => {
    const r = rig();
    const before = r.moveToGround(0, 1);
    run(r, { id: 7, pos: { x: 8, z: 10 } }, 2);
    const held = r.moveToGround(0, 1);
    expect(held.x).toBeCloseTo(before.x);
    expect(held.z).toBeCloseTo(before.z);
    // Al soltar y volver a tocar, "arriba" es el nuevo adelante de la cámara.
    r.moveToGround(0, 0);
    expect(r.moveToGround(0, 1).x).toBeCloseTo(1, 1);
  });
});
