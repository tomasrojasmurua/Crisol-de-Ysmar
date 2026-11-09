import type { Summon } from '@crisol/core';
import * as THREE from 'three';
import { createGlowTexture } from './arena/textures';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const ROOT = elementColor('raiz');
const WISP_BLUE = new THREE.Color('#5fa8ff');

type Position = { x: number; z: number };

const glowTexture = createGlowTexture();

function halo(color: THREE.Color, size: number): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** Fuego fatuo: una llama azul y naranja que flota y deja chispas. */
function createWisp(): THREE.Object3D {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 2),
    new THREE.MeshBasicMaterial({ color: glow(WISP_BLUE, 2.5) }),
  );
  const outer = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 1),
    new THREE.MeshBasicMaterial({
      color: glow(FIRE, 1.6),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(core, outer, halo(glow(FIRE, 1.4), 2.2));
  group.userData.outer = outer;
  return group;
}

/** Pararrayos: un tótem de madera con una punta eléctrica. */
function createRod(): THREE.Object3D {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({
    color: '#4a3424',
    roughness: 0.9,
    flatShading: true,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2, 6), wood);
  pole.position.y = 1;
  pole.castShadow = true;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#2b3a22', emissive: ROOT, emissiveIntensity: 0.5 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.3;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.5, 6),
    new THREE.MeshBasicMaterial({ color: glow(STORM, 2.4) }),
  );
  tip.position.y = 2.25;
  const light = halo(glow(STORM, 1.6), 1.6);
  light.position.y = 2.3;
  group.add(pole, band, tip, light);
  group.userData.light = light;
  return group;
}

/** Guardián de musgo: una bestia baja de piedra con musgo encima y ojos que brillan. */
function createGuardian(): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: '#5b6159',
    roughness: 0.95,
    flatShading: true,
  });
  const moss = new THREE.MeshStandardMaterial({
    color: '#3f6b2c',
    emissive: ROOT,
    emissiveIntensity: 0.15,
    roughness: 1,
    flatShading: true,
  });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), stone);
  torso.scale.set(1.15, 0.8, 1);
  torso.position.y = 0.7;
  torso.castShadow = true;
  const back = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), moss);
  back.scale.set(1.1, 0.45, 0.9);
  back.position.set(0, 1.05, -0.1);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), stone);
  head.position.set(0, 0.85, 0.6);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: glow(ROOT, 3) });
  const eyeGeometry = new THREE.SphereGeometry(0.05, 6, 4);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(side * 0.13, 0.92, 0.88);
    body.add(eye);
  }
  const legGeometry = new THREE.CylinderGeometry(0.13, 0.16, 0.5, 5);
  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [
    [-0.4, 0.3],
    [0.4, 0.3],
    [-0.4, -0.3],
    [0.4, -0.3],
  ] as const) {
    const leg = new THREE.Mesh(legGeometry, stone);
    leg.position.set(lx, 0.25, lz);
    legs.push(leg);
    body.add(leg);
  }
  body.add(torso, back, head);
  group.add(body);
  group.userData.body = body;
  group.userData.legs = legs;
  return group;
}

/** Crea la vista de una invocación (salvo el Señuelo, que se dibuja como un mago). */
export function createSummon(summon: Summon): THREE.Object3D {
  switch (summon.summon) {
    case 'wisp':
      return createWisp();
    case 'lightningRod':
      return createRod();
    case 'mossGuardian':
      return createGuardian();
    case 'decoy':
      return new THREE.Group();
  }
}

export function updateSummon(
  view: THREE.Object3D,
  summon: Summon,
  pos: Position,
  time: number,
  particles: Particles,
): void {
  view.position.set(pos.x, 0, pos.z);
  view.rotation.y = Math.atan2(summon.facing.x, summon.facing.z);
  // Al final de su tiempo, parpadea.
  view.visible = summon.ticksLeft > 30 || Math.sin(time * 30) > -0.3;
  switch (summon.summon) {
    case 'wisp': {
      const y = 1.1 + Math.sin(time * 5 + summon.id) * 0.15;
      view.position.y = y;
      const outer = view.userData.outer as THREE.Mesh;
      outer.scale.setScalar(1 + 0.2 * Math.sin(time * 14));
      outer.rotation.set(time * 3, time * 2, 0);
      particles.emit({
        x: pos.x + (Math.random() - 0.5) * 0.2,
        y: y + (Math.random() - 0.5) * 0.2,
        z: pos.z + (Math.random() - 0.5) * 0.2,
        vy: 0.8,
        color: glow(Math.random() < 0.5 ? FIRE : WISP_BLUE, 1.8),
        life: 0.45,
        size: 0.3,
      });
      break;
    }
    case 'lightningRod': {
      const light = view.userData.light as THREE.Sprite;
      light.scale.setScalar(1.3 + 0.4 * Math.random());
      if (Math.random() < 0.25) {
        const angle = Math.random() * Math.PI * 2;
        particles.emit({
          x: pos.x + Math.cos(angle) * 0.25,
          y: 2.3,
          z: pos.z + Math.sin(angle) * 0.25,
          vx: Math.cos(angle) * 2,
          vy: (Math.random() - 0.5) * 2,
          vz: Math.sin(angle) * 2,
          color: glow(STORM, 2),
          life: 0.15,
          size: 0.2,
        });
      }
      break;
    }
    case 'mossGuardian': {
      const body = view.userData.body as THREE.Group;
      const legs = view.userData.legs as THREE.Mesh[];
      const last = (view.userData.last as Position | undefined) ?? pos;
      const moving = Math.hypot(pos.x - last.x, pos.z - last.z) > 0.01;
      view.userData.last = { x: pos.x, z: pos.z };
      const step = moving ? Math.sin(time * 12) : 0;
      body.position.y = Math.abs(step) * 0.08;
      legs.forEach((leg, i) => {
        leg.rotation.x = (i % 2 === 0 ? 1 : -1) * step * 0.5;
      });
      // Se ve más agrietado cuanto menos vida le queda.
      body.rotation.z = (1 - summon.hp / summon.maxHp) * 0.15 * Math.sin(time * 20);
      break;
    }
    case 'decoy':
      break;
  }
}
