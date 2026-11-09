import type { Field, GuidedBolt } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const WATER = elementColor('marea');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');
const ICE = new THREE.Color('#bfe6ff');
const LIGHTNING = new THREE.Color('#e9f6ff');
const SMOKE = new THREE.Color('#5a5660');
const POLLEN = new THREE.Color('#ffe066');
const GOLD = new THREE.Color('#ffd27a');

type Position = { x: number; z: number };

const discGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2);
const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true)
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

function solid(color: string, emissive = '#000000', intensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: intensity,
    roughness: 0.9,
    flatShading: true,
  });
}

const fade = (field: Field): number =>
  Math.min(1, field.ticksLeft / 15, (field.durationTicks - field.ticksLeft + 1) / 6);

/** Un disco tenue con borde, la base de casi todas las zonas. */
function groundDisc(group: THREE.Group, radius: number, color: THREE.Color, opacity: number): void {
  const disc = new THREE.Mesh(discGeometry, additive(glow(color, 1.2), opacity));
  disc.scale.setScalar(radius);
  const ring = new THREE.Mesh(ringGeometry, additive(glow(color, 1.3), 0.6));
  ring.scale.setScalar(radius);
  group.add(disc, ring);
  group.userData.disc = disc;
  group.userData.ring = ring;
}

/** Un tramo recto entre dos puntos, a cierta altura. */
function beamBetween(mesh: THREE.Object3D, a: Position, b: Position, height: number): void {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  mesh.position.set(a.x, height, a.z);
  mesh.scale.set(1, 1, Math.max(0.01, len));
  mesh.lookAt(b.x, height, b.z);
}

/**
 * Lo que la cuarta tanda deja en el campo. La Mandrágora no la ve el equipo rival.
 * Las posiciones de `points` son absolutas: el grupo queda en el origen.
 */
export function createField(field: Field): THREE.Object3D {
  const group = new THREE.Group();
  const { x, z } = field.pos;
  const r = field.radius;
  switch (field.mode) {
    case 'volcano': {
      group.position.set(x, 0, z);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, r * 1.6, 9, 1, true),
        solid('#2a1a14', '#ff4a10', 0.12),
      );
      cone.position.y = r * 0.8;
      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.35, 16).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: glow(FIRE, 2.4) }),
      );
      crater.position.y = r * 1.45;
      group.add(cone, crater);
      group.userData.grows = cone;
      return group;
    }
    case 'solarOrb': {
      group.position.set(x, 0.9, z);
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 2),
        new THREE.MeshBasicMaterial({ color: glow(GOLD, 2.6) }),
      );
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r * 1.6, 1),
        additive(glow(FIRE, 1.4), 0.25),
      );
      group.add(core, shell);
      group.userData.shell = shell;
      return group;
    }
    case 'iceTrack':
    case 'zipline': {
      const a = field.points[0] ?? field.pos;
      const b = field.points[1] ?? field.pos;
      if (field.mode === 'iceTrack') {
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(r * 2, len).rotateX(-Math.PI / 2),
          additive(glow(ICE, 1.2), 0.35),
        );
        strip.position.set((a.x + b.x) / 2, 0.04, (a.z + b.z) / 2);
        strip.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        group.add(strip);
        group.userData.strip = strip;
      } else {
        const post = new THREE.CylinderGeometry(0.08, 0.12, 2.4, 6).translate(0, 1.2, 0);
        const wood = solid('#4a3524');
        for (const end of [a, b]) {
          const p = new THREE.Mesh(post, wood);
          p.position.set(end.x, 0, end.z);
          group.add(p);
        }
        const cable = new THREE.Mesh(beamGeometry, additive(glow(LIGHTNING, 1.8), 0.9));
        beamBetween(cable, a, b, 2.3);
        group.add(cable);
        group.userData.cable = cable;
      }
      return group;
    }
    case 'lilyPads': {
      const leaf = new THREE.CircleGeometry(r, 18, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2);
      const green = solid('#2f6a3a', '#3aff9a', 0.08);
      const flower = new THREE.SphereGeometry(0.16, 8, 6);
      for (const p of field.points) {
        const pad = new THREE.Mesh(leaf, green);
        pad.position.set(p.x, 0.05, p.z);
        pad.rotation.y = p.x * 3 + p.z;
        const bloom = new THREE.Mesh(
          flower,
          new THREE.MeshBasicMaterial({ color: glow(WATER, 1.6) }),
        );
        bloom.position.set(p.x, 0.18, p.z);
        group.add(pad, bloom);
      }
      return group;
    }
    case 'totems': {
      const pole = new THREE.CylinderGeometry(0.14, 0.2, 1.8, 6).translate(0, 0.9, 0);
      const wood = solid('#3a2a20', '#9fd8ff', 0.15);
      const beams: THREE.Mesh[] = [];
      field.points.forEach((p, i) => {
        const t = new THREE.Mesh(pole, wood);
        t.position.set(p.x, 0, p.z);
        group.add(t);
        const next = field.points[(i + 1) % field.points.length] ?? p;
        const beam = new THREE.Mesh(beamGeometry, additive(glow(LIGHTNING, 2), 0.9));
        beamBetween(beam, p, next, 1.1);
        beams.push(beam);
        group.add(beam);
      });
      group.userData.beams = beams;
      return group;
    }
    case 'shadowMark': {
      group.position.set(x, 0, z);
      const blot = new THREE.Mesh(
        discGeometry,
        new THREE.MeshBasicMaterial({ color: '#0d0814', transparent: true, opacity: 0.8 }),
      );
      blot.scale.setScalar(0.8);
      blot.position.y = 0.03;
      const ring = new THREE.Mesh(ringGeometry, additive(glow(SHADOW, 2), 0.8));
      ring.scale.setScalar(0.9);
      ring.position.y = 0.05;
      group.add(blot, ring);
      group.userData.ring = ring;
      return group;
    }
    case 'mandrake': {
      group.position.set(x, 0, z);
      const leaves = new THREE.ConeGeometry(0.25, 0.5, 5).translate(0, 0.25, 0);
      const green = solid('#3f5a2a');
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(leaves, green);
        leaf.rotation.set(0.6, (i * Math.PI) / 2, 0);
        group.add(leaf);
      }
      return group;
    }
    case 'bonfire': {
      group.position.set(x, 0.04, z);
      groundDisc(group, r, FIRE, 0.08);
      const log = new THREE.CylinderGeometry(0.09, 0.09, 1, 5).rotateZ(Math.PI / 2);
      const wood = solid('#3a2416', '#ff6a20', 0.2);
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(log, wood);
        l.rotation.y = (i * Math.PI) / 3;
        l.position.y = 0.1;
        group.add(l);
      }
      return group;
    }
    default: {
      group.position.set(x, 0.05, z);
      groundDisc(group, r, FIELD_COLOR[field.mode] ?? SMOKE, FIELD_OPACITY[field.mode] ?? 0.14);
      return group;
    }
  }
}

const FIELD_COLOR: Record<Field['mode'], THREE.Color> = {
  volcano: FIRE,
  monsoon: new THREE.Color('#5a7aa8'),
  smoke: SMOKE,
  bonfire: FIRE,
  wither: new THREE.Color('#6b4a2a'),
  deluge: WATER,
  growth: ROOT,
  pollen: POLLEN,
  solarOrb: GOLD,
  iceTrack: ICE,
  zipline: LIGHTNING,
  lilyPads: WATER,
  shadowMark: SHADOW,
  totems: LIGHTNING,
  mandrake: ROOT,
};

const FIELD_OPACITY: Partial<Record<Field['mode'], number>> = {
  smoke: 0.25,
  wither: 0.2,
  deluge: 0.16,
  growth: 0.16,
  pollen: 0.12,
  monsoon: 0.18,
};

/** Un punto al azar dentro del círculo de una zona. */
function inside(field: Field, height: number): { x: number; y: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * field.radius;
  return {
    x: field.pos.x + Math.cos(angle) * d,
    y: height,
    z: field.pos.z + Math.sin(angle) * d,
  };
}

export function updateField(
  view: THREE.Object3D,
  field: Field,
  time: number,
  particles: Particles,
  /** El equipo de quien mira: la Mandrágora rival no se ve. */
  viewerTeam: number | undefined,
): void {
  const strength = fade(field);
  const ring = view.userData.ring as THREE.Mesh | undefined;
  if (ring) ring.rotation.y = time * 0.8;
  const disc = view.userData.disc as THREE.Mesh | undefined;
  if (disc)
    (disc.material as THREE.MeshBasicMaterial).opacity =
      (FIELD_OPACITY[field.mode] ?? 0.14) * strength;
  switch (field.mode) {
    case 'volcano': {
      const cone = view.userData.grows as THREE.Mesh;
      view.scale.setScalar(
        Math.min(1, (field.durationTicks - field.ticksLeft + 1) / 10) *
          Math.min(1, field.ticksLeft / 10 + 0.2),
      );
      cone.rotation.y = time * 0.1;
      if (Math.random() < 0.5) {
        particles.emit({
          x: field.pos.x + (Math.random() - 0.5) * 0.4,
          y: field.radius * 1.5,
          z: field.pos.z + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 3 + Math.random() * 2,
          vz: (Math.random() - 0.5) * 1.5,
          color: glow(Math.random() < 0.3 ? SMOKE : FIRE, 1.6),
          life: 0.9,
          size: 0.45,
          gravity: -6,
        });
      }
      return;
    }
    case 'monsoon': {
      const p = inside(field, 4.5);
      particles.emit({
        ...p,
        vy: -0.2,
        color: new THREE.Color('#2a3448').multiplyScalar(strength),
        life: 1.4,
        size: 2,
      });
      if (Math.random() < 0.15) {
        const drop = inside(field, 4);
        particles.emit({ ...drop, vy: -12, color: glow(WATER, 1.2), life: 0.35, size: 0.2 });
      }
      return;
    }
    case 'smoke':
      for (let i = 0; i < 3; i++) {
        const p = inside(field, 0.3 + Math.random() * 3.5);
        particles.emit({
          ...p,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 0.6,
          vz: (Math.random() - 0.5) * 0.4,
          color: SMOKE.clone().multiplyScalar(0.55 * strength),
          life: 2,
          size: 2.2,
        });
      }
      return;
    case 'bonfire':
      if (Math.random() < 0.7) {
        particles.emit({
          x: field.pos.x + (Math.random() - 0.5) * 0.4,
          y: 0.25,
          z: field.pos.z + (Math.random() - 0.5) * 0.4,
          vy: 1.6 + Math.random(),
          color: glow(FIRE, 1.8),
          life: 0.7,
          size: 0.5,
        });
      }
      return;
    case 'wither':
      if (Math.random() < 0.4) {
        const p = inside(field, 2.2);
        particles.emit({
          ...p,
          vx: 0.3,
          vy: -0.7,
          color: new THREE.Color('#6b4a2a').multiplyScalar(strength),
          life: 2,
          size: 0.3,
        });
      }
      return;
    case 'deluge':
      for (let i = 0; i < 4; i++) {
        const p = inside(field, 5);
        particles.emit({
          ...p,
          vy: -14,
          color: glow(WATER, 1.1 * strength),
          life: 0.35,
          size: 0.18,
        });
      }
      return;
    case 'growth':
      if (Math.random() < 0.6) {
        const p = inside(field, 0.1);
        particles.emit({ ...p, vy: 1.6, color: glow(ROOT, 1.5 * strength), life: 1, size: 0.3 });
      }
      return;
    case 'pollen':
      for (let i = 0; i < 2; i++) {
        const p = inside(field, 0.4 + Math.random() * 2);
        particles.emit({
          ...p,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.1,
          vz: (Math.random() - 0.5) * 0.3,
          color: glow(POLLEN, 1.2 * strength),
          life: 1.6,
          size: 0.35,
        });
      }
      return;
    case 'solarOrb': {
      const shell = view.userData.shell as THREE.Mesh;
      shell.rotation.y = time * 1.5;
      view.position.y = 0.9 + Math.sin(time * 3 + field.id) * 0.12;
      shell.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
      return;
    }
    case 'iceTrack': {
      const strip = view.userData.strip as THREE.Mesh;
      (strip.material as THREE.MeshBasicMaterial).opacity = 0.35 * strength;
      return;
    }
    case 'zipline': {
      const cable = view.userData.cable as THREE.Mesh;
      (cable.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(time * 12);
      return;
    }
    case 'totems': {
      const beams = view.userData.beams as THREE.Mesh[];
      for (const beam of beams) {
        (beam.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.5 * Math.random();
      }
      return;
    }
    case 'shadowMark':
      if (Math.random() < 0.3) {
        particles.emit({
          x: field.pos.x,
          y: 0.2,
          z: field.pos.z,
          vy: 1.2,
          color: glow(SHADOW, 1.5),
          life: 0.8,
          size: 0.6,
        });
      }
      return;
    case 'mandrake':
      // Escondida para el equipo rival; los tuyos la ven apenas.
      view.visible = viewerTeam === undefined || viewerTeam === field.team;
      return;
    case 'lilyPads':
      return;
  }
}

/** Relámpago guiado: una bola de rayo con estela, que se tuerce con el pulgar. */
export function createGuidedBolt(): THREE.Object3D {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 1),
    new THREE.MeshBasicMaterial({ color: glow(LIGHTNING, 3) }),
  );
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    additive(glow(STORM, 1.6), 0.4),
  );
  group.add(core, shell);
  group.userData.shell = shell;
  return group;
}

export function updateGuidedBolt(
  view: THREE.Object3D,
  bolt: GuidedBolt,
  pos: Position,
  time: number,
  particles: Particles,
): void {
  view.position.set(pos.x, 1.3, pos.z);
  const shell = view.userData.shell as THREE.Mesh;
  shell.rotation.set(time * 9, time * 7, 0);
  particles.emit({
    x: pos.x + (Math.random() - 0.5) * 0.3,
    y: 1.3 + (Math.random() - 0.5) * 0.3,
    z: pos.z + (Math.random() - 0.5) * 0.3,
    vx: -bolt.dir.x,
    vz: -bolt.dir.z,
    color: glow(Math.random() < 0.5 ? LIGHTNING : STORM, 2),
    life: 0.3,
    size: 0.4,
  });
}
