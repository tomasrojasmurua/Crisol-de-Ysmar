import type { Summon } from '@crisol/core';
import * as THREE from 'three';
import { createGlowTexture } from './arena/textures';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const WATER = elementColor('marea');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');
const MAGMA = new THREE.Color('#ff5a1f');
const ICE = new THREE.Color('#bfe6ff');

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

/** Las invocaciones de los Grandes hechizos (el Gemelo sombrío se dibuja como un mago). */
export type GreatSummonKind = Exclude<
  Summon['summon'],
  'wisp' | 'lightningRod' | 'mossGuardian' | 'decoy' | 'shadowTwin' | 'mirage'
>;

export function createGreatSummon(kind: GreatSummonKind, summon: Summon): THREE.Object3D {
  switch (kind) {
    case 'wanderingSpark':
      return createSpark();
    case 'magmaGolem':
      return createGolem();
    case 'glacier':
      return createGlacier();
    case 'swarm':
      return createSwarm();
    case 'ancientTree':
      return createTree(summon.radius);
    case 'carnivore':
      return createCarnivore();
    case 'sentinel':
      return createSentinel();
  }
}

/** Centinela: un ojo de sombra que flota y mira alrededor. */
function createSentinel(): THREE.Object3D {
  const group = new THREE.Group();
  const eye = new THREE.Group();
  eye.position.y = 2.2;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 12),
    new THREE.MeshStandardMaterial({ color: '#1a1224', emissive: SHADOW, emissiveIntensity: 0.4 }),
  );
  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 16),
    new THREE.MeshBasicMaterial({ color: glow(SHADOW, 3) }),
  );
  iris.position.z = 0.31;
  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 12),
    new THREE.MeshBasicMaterial({ color: '#000' }),
  );
  pupil.position.z = 0.315;
  eye.add(ball, iris, pupil, halo(glow(SHADOW, 0.8), 1.6));
  group.add(eye);
  group.userData.eye = eye;
  return group;
}

/** Chispa errante: una brasa pequeña con chispas de trueno. */
function createSpark(): THREE.Object3D {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.14, 1),
    new THREE.MeshBasicMaterial({ color: glow(FIRE, 2.6) }),
  );
  core.position.y = 1.3;
  const light = halo(glow(FIRE, 1.3), 1.1);
  light.position.y = 1.3;
  group.add(core, light);
  return group;
}

/** Gólem de magma: un bulto de roca negra con grietas de lava. */
function createGolem(): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({
    color: '#2a1d18',
    emissive: MAGMA,
    emissiveIntensity: 0.35,
    roughness: 0.9,
    flatShading: true,
  });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), rock);
  torso.scale.set(1, 1.15, 0.85);
  torso.position.y = 1.15;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), rock);
  head.position.set(0, 2.05, 0.12);
  const eyes = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.05),
    new THREE.MeshBasicMaterial({ color: glow(MAGMA, 3) }),
  );
  eyes.position.set(0, 2.1, 0.4);
  const armGeometry = new THREE.DodecahedronGeometry(0.32, 0);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, rock);
    arm.scale.set(0.9, 1.6, 0.9);
    arm.position.set(side * 0.85, 0.85, 0.1);
    body.add(arm);
  }
  const legGeometry = new THREE.CylinderGeometry(0.2, 0.26, 0.6, 5);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, rock);
    leg.position.set(side * 0.35, 0.3, 0);
    body.add(leg);
  }
  const light = halo(glow(MAGMA, 0.35), 1.8);
  light.position.y = 1.2;
  body.add(torso, head, eyes, light);
  group.add(body);
  group.userData.body = body;
  group.userData.rock = rock;
  return group;
}

/** Glaciar vivo: un bloque de hielo con picos que avanza arrastrándose. */
function createGlacier(): THREE.Object3D {
  const group = new THREE.Group();
  const ice = new THREE.MeshStandardMaterial({
    color: '#cfefff',
    emissive: WATER,
    emissiveIntensity: 0.3,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
  });
  const block = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), ice);
  block.scale.set(1, 0.8, 1.1);
  block.position.y = 0.6;
  block.castShadow = true;
  group.add(block);
  const spikeGeometry = new THREE.ConeGeometry(0.16, 0.8, 5);
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(spikeGeometry, ice);
    const angle = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(angle) * 0.35, 1.05, Math.sin(angle) * 0.35);
    spike.rotation.set(Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5);
    group.add(spike);
  }
  const light = halo(glow(ICE, 0.6), 2.2);
  light.position.y = 0.8;
  group.add(light);
  group.userData.block = block;
  return group;
}

/** Enjambre: una nube de insectos verdes y violetas que zumban. */
function createSwarm(): THREE.Object3D {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.06, 5, 4);
  const bugs: THREE.Mesh[] = [];
  for (let i = 0; i < 18; i++) {
    const bug = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: glow(i % 3 === 0 ? STORM : ROOT, 1.6) }),
    );
    bug.userData.phase = i * 1.7;
    bug.userData.radius = 0.25 + (i % 5) * 0.12;
    bugs.push(bug);
    group.add(bug);
  }
  group.userData.bugs = bugs;
  return group;
}

/** Árbol ancestral: un tronco ancho y una copa enorme con luz verde. */
function createTree(radius: number): THREE.Object3D {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: '#3d2a1c',
    roughness: 1,
    flatShading: true,
  });
  const leaves = new THREE.MeshStandardMaterial({
    color: '#2f5a24',
    emissive: ROOT,
    emissiveIntensity: 0.2,
    roughness: 0.9,
    flatShading: true,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.45, radius * 0.75, 3.2, 7),
    bark,
  );
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.22, radius * 1.4, 5), bark);
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    root.rotation.set(Math.PI / 2 - 0.3, angle, 0, 'YXZ');
    root.position.set(Math.sin(angle) * radius * 0.7, 0.2, Math.cos(angle) * radius * 0.7);
    group.add(root);
  }
  const canopy = new THREE.Group();
  for (const [x, y, z, s] of [
    [0, 3.8, 0, 1.6],
    [0.9, 3.4, 0.3, 1.1],
    [-0.8, 3.5, -0.4, 1.15],
    [0.1, 3.3, -0.9, 1],
  ] as const) {
    const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), leaves);
    clump.position.set(x, y, z);
    clump.castShadow = true;
    canopy.add(clump);
  }
  group.add(canopy);
  group.userData.canopy = canopy;
  return group;
}

/** Planta carnívora: un tallo grueso con una boca de dos mandíbulas con dientes. */
function createCarnivore(): THREE.Object3D {
  const group = new THREE.Group();
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: '#2f4a22',
    roughness: 0.8,
    flatShading: true,
  });
  const jawMaterial = new THREE.MeshStandardMaterial({
    color: '#6a1f2a',
    emissive: SHADOW,
    emissiveIntensity: 0.3,
    roughness: 0.6,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.3, 6), stemMaterial);
  stem.position.y = 0.65;
  const head = new THREE.Group();
  head.position.y = 1.45;
  const toothGeometry = new THREE.ConeGeometry(0.05, 0.18, 4);
  const toothMaterial = new THREE.MeshBasicMaterial({ color: '#f2ead8' });
  const jaws: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const jaw = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      jawMaterial,
    );
    shell.scale.set(1, 0.6, 1);
    shell.rotation.x = side > 0 ? 0 : Math.PI;
    jaw.add(shell);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
      tooth.position.set(Math.cos(angle) * 0.52, 0, Math.sin(angle) * 0.52);
      tooth.rotation.x = side > 0 ? Math.PI : 0;
      jaw.add(tooth);
    }
    jaw.userData.side = side;
    jaws.push(jaw);
    head.add(jaw);
  }
  const leafGeometry = new THREE.SphereGeometry(0.5, 6, 4);
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(leafGeometry, stemMaterial);
    const angle = (i / 3) * Math.PI * 2;
    leaf.scale.set(0.35, 0.08, 1);
    leaf.position.set(Math.sin(angle) * 0.45, 0.06, Math.cos(angle) * 0.45);
    leaf.rotation.y = angle;
    group.add(leaf);
  }
  group.add(stem, head);
  group.userData.head = head;
  group.userData.jaws = jaws;
  return group;
}

export function updateGreatSummon(
  view: THREE.Object3D,
  kind: GreatSummonKind,
  summon: Summon,
  pos: Position,
  time: number,
  particles: Particles,
): void {
  switch (kind) {
    case 'wanderingSpark':
      if (Math.random() < 0.5) {
        particles.emit({
          x: pos.x,
          y: 1.3,
          z: pos.z,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          vz: (Math.random() - 0.5) * 1.5,
          color: glow(Math.random() < 0.7 ? FIRE : STORM, 2),
          life: 0.2,
          size: 0.16,
        });
      }
      return;
    case 'magmaGolem': {
      const body = view.userData.body as THREE.Group;
      const rock = view.userData.rock as THREE.MeshStandardMaterial;
      body.position.y = Math.abs(Math.sin(time * 4)) * 0.04;
      // Cuanto más herido, más brilla la lava: está por estallar.
      const hurt = 1 - summon.hp / summon.maxHp;
      rock.emissiveIntensity = 0.3 + hurt * 0.6 + 0.1 * Math.sin(time * (6 + hurt * 18));
      if (Math.random() < 0.25) {
        particles.emit({
          x: pos.x + (Math.random() - 0.5) * 0.9,
          y: 1 + Math.random() * 1,
          z: pos.z + (Math.random() - 0.5) * 0.9,
          vy: 1,
          color: glow(MAGMA, 1.6),
          life: 0.5,
          size: 0.25,
          gravity: 1,
        });
      }
      return;
    }
    case 'glacier': {
      const block = view.userData.block as THREE.Mesh;
      block.rotation.y = time * 0.4;
      if (Math.random() < 0.3) {
        particles.emit({
          x: pos.x + (Math.random() - 0.5) * 1.2,
          y: 0.1,
          z: pos.z + (Math.random() - 0.5) * 1.2,
          vy: 0.4,
          color: glow(ICE, 0.9),
          life: 0.6,
          size: 0.3,
        });
      }
      return;
    }
    case 'swarm': {
      view.position.y = 1.2;
      const bugs = view.userData.bugs as THREE.Mesh[];
      for (const bug of bugs) {
        const phase = bug.userData.phase as number;
        const r = bug.userData.radius as number;
        bug.position.set(
          Math.cos(time * 9 + phase) * r,
          Math.sin(time * 13 + phase * 2) * 0.35,
          Math.sin(time * 11 + phase) * r,
        );
      }
      return;
    }
    case 'ancientTree': {
      const canopy = view.userData.canopy as THREE.Group;
      canopy.rotation.y = Math.sin(time * 0.8) * 0.05;
      // Justo antes de azotar, las hojas se agitan.
      canopy.rotation.z = summon.cooldown < 8 ? Math.sin(time * 40) * 0.05 : 0;
      if (Math.random() < 0.08) {
        particles.emit({
          x: pos.x + (Math.random() - 0.5) * 3,
          y: 3.5,
          z: pos.z + (Math.random() - 0.5) * 3,
          vy: -0.6,
          vx: 0.4,
          color: glow(ROOT, 1.2),
          life: 2,
          size: 0.25,
        });
      }
      return;
    }
    case 'sentinel': {
      const eye = view.userData.eye as THREE.Group;
      eye.position.y = 2.2 + Math.sin(time * 1.5 + summon.id) * 0.12;
      // Mira de un lado a otro, despacio.
      eye.rotation.y = Math.sin(time * 0.6 + summon.id) * Math.PI;
      if (Math.random() < 0.2) {
        particles.emit({
          x: pos.x + (Math.random() - 0.5) * 0.4,
          y: eye.position.y - 0.3,
          z: pos.z + (Math.random() - 0.5) * 0.4,
          vy: -0.4,
          color: SHADOW.clone().multiplyScalar(0.6),
          life: 0.8,
          size: 0.35,
        });
      }
      return;
    }
    case 'carnivore': {
      const jaws = view.userData.jaws as THREE.Object3D[];
      const head = view.userData.head as THREE.Group;
      const full = summon.targetId !== null;
      // Abierta y esperando, o cerrada y masticando.
      const open = full
        ? 0.05 + 0.05 * Math.abs(Math.sin(time * 8))
        : 0.45 + 0.1 * Math.sin(time * 3);
      for (const jaw of jaws) jaw.rotation.x = (jaw.userData.side as number) * -open;
      head.scale.setScalar(full ? 1.25 : 1);
      head.rotation.z = Math.sin(time * 2) * 0.1;
      return;
    }
  }
}
