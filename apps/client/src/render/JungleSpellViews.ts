import type { GrownTree } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const ROOT = elementColor('raiz');
const GROW_TICKS = 20;

const bark = new THREE.MeshStandardMaterial({ color: '#4a3b2c', roughness: 0.95 });
const leaves = new THREE.MeshStandardMaterial({
  color: '#3f6a4a',
  emissive: ROOT,
  emissiveIntensity: 0.08,
  roughness: 0.9,
  flatShading: true,
});
const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7).translate(0, 1.3, 0);
const crownGeometry = new THREE.ConeGeometry(1.5, 2.4, 7).translate(0, 3.4, 0);
const topGeometry = new THREE.ConeGeometry(1.05, 1.9, 7).translate(0, 4.6, 0);

/** Brote de árbol: un árbol como los de la jungla, que crece de golpe del suelo. */
export function createGrownTree(tree: GrownTree): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(tree.pos.x, 0, tree.pos.z);
  const s = tree.radius / 0.7;
  const inner = new THREE.Group();
  inner.scale.set(s, 1, s);
  const trunk = new THREE.Mesh(trunkGeometry, bark);
  const crown = new THREE.Mesh(crownGeometry, leaves);
  const top = new THREE.Mesh(topGeometry, leaves);
  for (const mesh of [trunk, crown, top]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  inner.add(trunk, crown, top);
  inner.rotation.y = tree.id;
  group.add(inner);
  group.userData.inner = inner;
  return group;
}

export function updateGrownTree(view: THREE.Object3D, tree: GrownTree, particles: Particles): void {
  const inner = view.userData.inner as THREE.Group;
  const t = Math.min(1, tree.age / GROW_TICKS);
  // Brota con un pequeño rebote.
  const grow = t < 1 ? t * (1.15 - 0.15 * t) : 1;
  inner.scale.y = Math.max(0.01, grow);
  if (t < 1) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.emit({
        x: tree.pos.x + Math.cos(angle) * 0.8,
        y: 0.1,
        z: tree.pos.z + Math.sin(angle) * 0.8,
        vx: Math.cos(angle) * 2,
        vy: 1.5,
        vz: Math.sin(angle) * 2,
        color: glow(i === 0 ? ROOT : new THREE.Color('#6a5040'), 1),
        life: 0.5,
        size: 0.35,
        gravity: 3,
      });
    }
  }
}
