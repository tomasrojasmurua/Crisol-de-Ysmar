import type { Aura, Bubble, Wizard } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const WATER = elementColor('marea');
const MAGMA = new THREE.Color('#ff5a1f');
const ICE = new THREE.Color('#bfe6ff');

type Position = { x: number; z: number };

function additive(color: THREE.Color, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
}

// ---------- Burbuja ----------

/** Burbuja: una esfera de agua irisada alrededor del mago. */
export function createBubble(): THREE.Object3D {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({
      color: '#bfe9ff',
      emissive: WATER,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0.3,
      depthWrite: false,
    }),
  );
  shell.scale.set(0.95, 1.15, 0.95);
  shell.position.y = 1.05;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), additive(glow(ICE, 1.2), 0.5));
  shine.position.set(-0.4, 1.7, 0.45);
  group.add(shell, shine);
  group.userData.shell = shell;
  return group;
}

export function updateBubble(
  view: THREE.Object3D,
  bubble: Bubble,
  target: Wizard | undefined,
  pos: Position | undefined,
  time: number,
): void {
  view.visible = pos !== undefined && (target?.shield ?? 0) > 0;
  if (!pos) return;
  view.position.set(pos.x, 0, pos.z);
  const shell = view.userData.shell as THREE.Mesh;
  const wobble = 1 + 0.03 * Math.sin(time * 5);
  shell.scale.set(0.95 * wobble, 1.15 / wobble, 0.95 * wobble);
  // Al final, parpadea.
  if (bubble.ticksLeft < 30) view.visible &&= Math.sin(time * 30) > -0.3;
}

// ---------- Inmolación y Ojo del huracán ----------

export function createAura(aura: Aura): THREE.Object3D {
  const group = new THREE.Group();
  if (aura.mode === 'immolation') {
    // Un anillo de fuego en el suelo y una columna de calor.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(aura.radius * 0.85, aura.radius, 48).rotateX(-Math.PI / 2),
      additive(glow(FIRE, 1.4), 0.5),
    );
    ring.position.y = 0.06;
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(aura.radius, 40).rotateX(-Math.PI / 2),
      additive(glow(MAGMA, 0.8), 0.12),
    );
    floor.position.y = 0.05;
    group.add(ring, floor);
    group.userData.ring = ring;
  } else {
    // Un muro de viento que gira alrededor del mago, con el centro en calma.
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(aura.radius, aura.radius, 0.5, 40, 1, true, i, Math.PI * 1.3),
        additive(glow(i % 2 === 0 ? STORM : ICE, 1), 0.22),
      );
      band.position.y = 0.4 + i * 0.6;
      band.userData.spin = (i % 2 === 0 ? 1 : -1) * (5 + i);
      group.add(band);
    }
  }
  return group;
}

export function updateAura(
  view: THREE.Object3D,
  aura: Aura,
  pos: Position | undefined,
  time: number,
  particles: Particles,
): void {
  view.visible = pos !== undefined;
  if (!pos) return;
  view.position.set(pos.x, 0, pos.z);
  const fade = Math.min(1, aura.ticksLeft / 15);
  if (aura.mode === 'immolation') {
    const ring = view.userData.ring as THREE.Mesh;
    (ring.material as THREE.MeshBasicMaterial).opacity = (0.4 + 0.15 * Math.sin(time * 12)) * fade;
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.random() * aura.radius;
      particles.emit({
        x: pos.x + Math.cos(angle) * d,
        y: 0.1,
        z: pos.z + Math.sin(angle) * d,
        vy: 2 + Math.random() * 1.5,
        color: glow(i === 0 ? FIRE : MAGMA, 1.6 * fade),
        life: 0.5,
        size: 0.35,
        gravity: 1,
      });
    }
    return;
  }
  for (const band of view.children) {
    const spin = band.userData.spin as number | undefined;
    if (spin) band.rotation.y = time * spin;
    const material = (band as THREE.Mesh).material as THREE.MeshBasicMaterial;
    material.opacity = 0.22 * fade;
  }
  const angle = time * 8 + Math.random();
  particles.emit({
    x: pos.x + Math.cos(angle) * aura.radius,
    y: 0.2 + Math.random() * 2.4,
    z: pos.z + Math.sin(angle) * aura.radius,
    vx: -Math.sin(angle) * 6,
    vy: 0.3,
    vz: Math.cos(angle) * 6,
    color: glow(Math.random() < 0.5 ? STORM : ICE, 1.2 * fade),
    life: 0.3,
    size: 0.3,
  });
}
