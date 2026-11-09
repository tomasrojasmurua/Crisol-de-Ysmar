import type { Wall, Zone } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');

const discGeometry = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const rootGeometry = new THREE.ConeGeometry(0.28, 1, 6).translate(0, 0.5, 0);
const tetherGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true)
  .translate(0, 0.5, 0)
  .rotateX(Math.PI / 2);

function additive(color: THREE.Color, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Rastro del Cometa: un charco de brasas que late y suelta chispas. */
export function createZone(zone: Zone): THREE.Object3D {
  const disc = new THREE.Mesh(discGeometry, additive(glow(FIRE, 1.4), 0.45));
  disc.scale.setScalar(zone.radius);
  disc.position.set(zone.pos.x, 0.05, zone.pos.z);
  return disc;
}

export function updateZone(
  view: THREE.Object3D,
  zone: Zone,
  time: number,
  particles: Particles,
): void {
  const material = (view as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const fade = Math.min(1, zone.ticksLeft / 20);
  material.opacity = (0.35 + 0.15 * Math.sin(time * 9 + zone.id)) * fade;
  if (Math.random() < 0.25) {
    particles.emit({
      x: zone.pos.x + (Math.random() - 0.5) * zone.radius * 1.4,
      y: 0.1,
      z: zone.pos.z + (Math.random() - 0.5) * zone.radius * 1.4,
      vy: 1.6,
      color: glow(FIRE, 1.6),
      life: 0.5,
      size: 0.4,
      gravity: 1,
    });
  }
}

/** Muralla de raíces: raíces gruesas que suben del suelo a lo largo del muro. */
export function createRootWall(wall: Wall): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(wall.center.x, 0, wall.center.z);
  group.rotation.y = -Math.atan2(wall.along.z, wall.along.x);
  const material = new THREE.MeshStandardMaterial({
    color: '#3b2a1c',
    emissive: ROOT,
    emissiveIntensity: 0.25,
    roughness: 0.9,
    flatShading: true,
  });
  const count = Math.round(wall.halfLength * 3);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const root = new THREE.Mesh(rootGeometry, material);
    const x = (t * 2 - 1) * wall.halfLength;
    const height = 1.6 + Math.sin(i * 2.3) * 0.5 + Math.cos(i * 1.7) * 0.3;
    root.position.set(x, 0, Math.sin(i * 3.1) * 0.15);
    root.rotation.set(Math.sin(i) * 0.25, 0, Math.cos(i * 1.3) * 0.2);
    root.userData.height = height;
    root.scale.set(1, 0.01, 1);
    root.castShadow = true;
    group.add(root);
  }
  return group;
}

export function updateRootWall(view: THREE.Object3D, wall: Wall): void {
  const rise = Math.min(1, (wall.durationTicks - wall.ticksLeft) / 6);
  const sink = Math.min(1, wall.ticksLeft / 10);
  const grow = Math.min(rise, sink);
  for (const root of view.children) {
    root.scale.y = Math.max(0.01, (root.userData.height as number) * grow);
  }
}

/** Drenaje: un hilo violeta que late desde la víctima hacia quien lo lanzó. */
export function createTether(): THREE.Object3D {
  return new THREE.Mesh(tetherGeometry, additive(glow(SHADOW, 2.4), 0.9));
}

export function updateTether(
  view: THREE.Object3D,
  from: { x: number; z: number } | undefined,
  to: { x: number; z: number } | undefined,
  time: number,
  particles: Particles,
): void {
  view.visible = from !== undefined && to !== undefined;
  if (!from || !to) return;
  const start = new THREE.Vector3(to.x, 1.2, to.z);
  const end = new THREE.Vector3(from.x, 1.3, from.z);
  view.position.copy(start);
  view.lookAt(end);
  const width = 1 + 0.6 * Math.sin(time * 14);
  view.scale.set(width, width, start.distanceTo(end));
  if (Math.random() < 0.5) {
    const t = (time * 1.5 + Math.random() * 0.2) % 1;
    particles.emit({
      x: start.x + (end.x - start.x) * t,
      y: 1.25,
      z: start.z + (end.z - start.z) * t,
      vx: (end.x - start.x) * 1.2,
      vz: (end.z - start.z) * 1.2,
      color: glow(SHADOW, 2),
      life: 0.3,
      size: 0.3,
    });
  }
}
