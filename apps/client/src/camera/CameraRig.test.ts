import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type CameraFocus, CameraRig } from './CameraRig';

const STEP = 1 / 60;

function rig(): CameraRig {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  const r = new CameraRig(camera);
  // Empieza en (0, 10): mira hacia la plaza, o sea hacia -z.
  r.update({ x: 0, z: 10 }, null, STEP);
  return r;
}

function run(r: CameraRig, focus: CameraFocus | null, seconds: number, player = { x: 0, z: 10 }) {
  for (let t = 0; t < seconds; t += STEP) r.update(player, focus, STEP);
}

/** Ángulo entre lo que mira la cámara y la dirección hacia `target`, en radianes. */
function offAxis(r: CameraRig, from: { x: number; z: number }, target: { x: number; z: number }) {
  const f = r.forward();
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const len = Math.hypot(dx, dz);
  return Math.acos(Math.min(1, (f.x * dx + f.z * dz) / len));
}

describe('CameraRig', () => {
  it('sin nada fijado no gira sola', () => {
    const r = rig();
    run(r, null, 2);
    expect(r.forward().z).toBeCloseTo(-1, 2);
  });

  it('en duelo gira hacia el rival con suavidad, no de golpe', () => {
    const r = rig();
    // Rival a la derecha (+x): 90° de giro.
    const focus: CameraFocus = { id: 7, pos: { x: 8, z: 10 }, kind: 'duel' };
    run(r, focus, 0.05);
    expect(r.forward().x).toBeLessThan(0.7);
    run(r, focus, 1);
    expect(r.forward().x).toBeCloseTo(1, 1);
  });

  it('en duelo lo mantiene al frente aunque lo rodees, sin esperar a que se salga', () => {
    const r = rig();
    const target = { x: 0, z: 0 };
    const focus: CameraFocus = { id: 7, pos: target, kind: 'duel' };
    run(r, focus, 1, { x: 0, z: 8 });
    // Lo rodeas a 8 m corriendo a toda velocidad (5,5 m/s) durante 4 segundos.
    const radius = 8;
    const angular = 5.5 / radius;
    let worst = 0;
    for (let t = 0; t < 4; t += STEP) {
      const angle = Math.PI / 2 + t * angular;
      const player = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      r.update(player, focus, STEP);
      if (t > 0.3) worst = Math.max(worst, offAxis(r, player, target));
    }
    // Siempre a menos de ~10° del centro: nunca cerca del borde de la pantalla.
    expect(worst).toBeLessThan(0.18);
  });

  it('en duelo el joystick se lee contra la cámara: los lados rodean al rival', () => {
    const r = rig();
    run(r, { id: 7, pos: { x: 8, z: 10 }, kind: 'duel' }, 1);
    // La cámara mira a +x: arriba es +x y la derecha es +z.
    const up = r.moveToGround(0, 1);
    expect(up.x).toBeCloseTo(1, 1);
    const right = r.moveToGround(1, 0);
    expect(right.z).toBeCloseTo(1, 1);
  });

  it('sin duelo, mientras se mantiene el joystick la dirección no cambia aunque la cámara gire', () => {
    const r = rig();
    const before = r.moveToGround(0, 1);
    run(r, { id: 7, pos: { x: 8, z: 10 }, kind: 'watch' }, 3);
    const held = r.moveToGround(0, 1);
    expect(held.x).toBeCloseTo(before.x);
    expect(held.z).toBeCloseTo(before.z);
    // Al soltar y volver a tocar, "arriba" es el nuevo adelante de la cámara.
    r.moveToGround(0, 0);
    expect(r.moveToGround(0, 1).x).toBeCloseTo(1, 1);
  });

  it('mirando a otro mago, no se mueve mientras su blanco siga cerca del centro', () => {
    const r = rig();
    // A ~11° del centro: dentro del margen.
    run(r, { id: 7, pos: { x: 1.6, z: 2 }, kind: 'watch' }, 1);
    expect(r.forward().z).toBeCloseTo(-1, 2);
  });
});
