import type { GameEvent, SpellId, Vec2, Wizard } from '@crisol/core';
import * as THREE from 'three';
import type { EffectsView } from './EffectsView';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const WATER = elementColor('marea');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');
const ICE = new THREE.Color('#bfe6ff');
const LIGHTNING = new THREE.Color('#e9f6ff');
const MAGMA = new THREE.Color('#ff5a1f');
const STEAM = new THREE.Color('#d9e4ea');

type Burst = Extract<GameEvent, { type: 'burst' }>;
type Line = Extract<GameEvent, { type: 'line' }>;

/** Un abanico de chispas que salen del suelo en un círculo. */
function fountain(
  particles: Particles,
  x: number,
  z: number,
  r: number,
  color: THREE.Color,
  count: number,
  up: number,
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const d = Math.random() * r;
    particles.emit({
      x: x + Math.cos(angle) * d,
      y: 0.2,
      z: z + Math.sin(angle) * d,
      vx: Math.cos(angle) * 1.5,
      vy: up * (0.6 + Math.random() * 0.6),
      vz: Math.sin(angle) * 1.5,
      color,
      life: 0.8,
      size: 0.45,
      gravity: -12,
    });
  }
}

/** El gesto de un Gran hechizo al salir. Devuelve false si no es uno de ellos. */
export function greatReleased(
  fx: EffectsView,
  particles: Particles,
  spell: SpellId,
  caster: Wizard,
): boolean {
  const { x, z } = caster.pos;
  switch (spell) {
    case 'meteor':
    case 'fireRain':
      fx.column(x, z, FIRE, 0.5, 0.6);
      particles.burst(x, 2.5, z, glow(FIRE, 2), 30, 3, 0.5);
      return true;
    case 'iceAge':
      fx.ring(x, z, ICE, 3, 0.6);
      particles.burst(x, 1, z, glow(ICE, 1.8), 40, 3, 0.7);
      return true;
    case 'steamJet':
      particles.burst(x, 1, z, glow(STEAM, 1.4), 40, 4, 0.6);
      return true;
    case 'mangrove':
    case 'thornRing':
    case 'sowing':
      fx.ring(x, z, ROOT, 2, 0.4);
      return true;
    case 'rootCatapult':
      fx.ring(x, z, ROOT, 2.5, 0.4);
      particles.burst(x, 0.3, z, new THREE.Color('#6b4a2a'), 30, 4, 0.5);
      return true;
    case 'phantom':
      particles.burst(x, 1, z, SHADOW.clone().multiplyScalar(0.8), 40, 2.5, 0.8);
      particles.burst(x, 1, z, glow(STORM, 1.2), 14, 2, 0.4);
      return true;
    case 'portal':
      fx.ring(x, z, SHADOW, 2, 0.5);
      return true;
    case 'soulPyre':
    case 'nightmare':
    case 'abyss':
      particles.burst(x, 1.6, z, glow(SHADOW, 1.8), 20, 2, 0.5);
      return true;
    case 'skySpear':
    case 'hurricane':
    case 'erraticOrb':
    case 'tidalWave':
      fx.ring(x, z, STORM, 1.8, 0.35);
      return true;
    default:
      return false;
  }
}

/** Explosiones y golpes de los Grandes hechizos. Devuelve false si no es uno de ellos. */
export function greatBurst(fx: EffectsView, particles: Particles, event: Burst): boolean {
  const { x, z } = event.pos;
  const r = event.radius;
  switch (event.spell) {
    case 'meteor':
      fx.ring(x, z, FIRE, r * 1.4, 0.7);
      fx.column(x, z, FIRE, 0.4, r / 0.7);
      particles.burst(x, 1, z, glow(FIRE, 2.2), 110, 9, 0.8);
      particles.burst(x, 0.5, z, new THREE.Color('#3a2a22'), 40, 4, 1.2);
      return true;
    case 'cauldron':
      fx.ring(x, z, MAGMA, r * 1.2, 0.6);
      fountain(particles, x, z, r, glow(MAGMA, 1.8), 60, 9);
      fountain(particles, x, z, r, glow(STEAM, 1.2), 30, 6);
      return true;
    case 'iceAge':
      fx.ring(x, z, ICE, r, 0.8);
      fountain(particles, x, z, r, glow(ICE, 1.8), 90, 4);
      return true;
    case 'abyss':
      fx.ring(x, z, SHADOW, r * 1.1, 0.6);
      for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = r * (0.6 + Math.random() * 0.4);
        particles.emit({
          x: x + Math.cos(angle) * d,
          y: 0.4 + Math.random(),
          z: z + Math.sin(angle) * d,
          vx: -Math.cos(angle) * d * 2.5,
          vz: -Math.sin(angle) * d * 2.5,
          color: glow(SHADOW, 2),
          life: 0.4,
          size: 0.4,
        });
      }
      return true;
    case 'fireRain':
      fx.ring(x, z, FIRE, r, 0.35);
      particles.burst(x, 0.5, z, glow(FIRE, 2), 24, 3, 0.4);
      return true;
    case 'tempest':
      fx.ring(x, z, STORM, r * 1.2, 0.4);
      particles.burst(x, 1, z, glow(LIGHTNING, 2), 30, 5, 0.3);
      return true;
    case 'hurricane':
      particles.burst(x, 1.5, z, glow(STORM, 1.6), 30, 4, 0.5);
      return true;
    case 'tidalWave':
      particles.burst(x, 1, z, glow(WATER, 1.6), 30, 3, 0.5);
      return true;
    case 'soulPyre':
      fx.column(x, z, SHADOW, 0.5, 0.5);
      particles.burst(x, 1.4, z, glow(SHADOW, 2.2), 50, 5, 0.5);
      particles.burst(x, 1.4, z, glow(FIRE, 1.8), 20, 4, 0.4);
      return true;
    case 'drown':
      fx.column(x, z, WATER, 0.5, 0.5);
      particles.burst(x, 1.4, z, glow(WATER, 1.8), 40, 4, 0.5);
      return true;
    case 'sowing':
      fx.ring(x, z, ROOT, 1.4, 0.4);
      fountain(particles, x, z, 0.6, glow(ROOT, 1.6), 24, 5);
      return true;
    case 'rootCatapult':
      fx.ring(x, z, ROOT, r, 0.5);
      fountain(particles, x, z, r, glow(ROOT, 1.4), 40, 4);
      particles.burst(x, 0.4, z, new THREE.Color('#6b4a2a'), 30, 4, 0.6);
      return true;
    case 'steamJet':
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        particles.emit({
          x: x + Math.cos(angle) * d,
          y: 1,
          z: z + Math.sin(angle) * d,
          vx: Math.cos(angle) * 2,
          vy: 1.5,
          vz: Math.sin(angle) * 2,
          color: glow(i % 3 === 0 ? FIRE : STEAM, 1.4),
          life: 0.6,
          size: 0.55,
          gravity: 1,
        });
      }
      return true;
    case 'nightmare':
      particles.burst(x, 1.8, z, glow(SHADOW, 1.6), 30, 1.5, 0.8);
      return true;
    default:
      return false;
  }
}

/** Lanza del cielo: un rayo enorme a lo largo de la franja. */
export function lineStrike(fx: EffectsView, particles: Particles, event: Line): void {
  const { from, to } = event;
  fx.beam(from, to, LIGHTNING, 0.35, 1.2);
  fx.beam(from, to, STORM, 0.5, 1.2);
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = from.x + (to.x - from.x) * t;
    const pz = from.z + (to.z - from.z) * t;
    fx.column(px, pz, LIGHTNING, 0.25, 0.25);
    particles.burst(px, 0.5, pz, glow(LIGHTNING, 2), 6, 4, 0.3);
  }
}

/** Los saltos de los Grandes hechizos. Devuelve false si no es uno de ellos. */
export function greatBlink(
  fx: EffectsView,
  particles: Particles,
  spell: SpellId,
  from: Vec2,
  to: Vec2,
): boolean {
  switch (spell) {
    case 'emberStride':
      particles.burst(from.x, 0.6, from.z, glow(FIRE, 1.8), 30, 3, 0.4);
      particles.burst(to.x, 0.6, to.z, glow(FIRE, 2), 40, 4, 0.5);
      fx.ring(to.x, to.z, FIRE, 2, 0.4);
      return true;
    case 'darkComet':
      fx.beam(from, to, SHADOW, 0.3, 1.2);
      particles.burst(to.x, 1, to.z, glow(SHADOW, 2), 30, 4, 0.4);
      return true;
    case 'swap':
      fx.beam(from, to, SHADOW, 0.35, 1.2);
      fx.beam(from, to, STORM, 0.25, 1.2);
      particles.burst(to.x, 1, to.z, glow(STORM, 1.8), 20, 3, 0.35);
      return true;
    case 'portal':
      particles.burst(from.x, 1.2, from.z, glow(SHADOW, 2), 24, 2.5, 0.4);
      particles.burst(to.x, 1.2, to.z, glow(FIRE, 1.6), 24, 3, 0.4);
      return true;
    case 'treeStride':
      particles.burst(from.x, 1.2, from.z, glow(ROOT, 1.6), 24, 2.5, 0.5);
      particles.burst(to.x, 1.2, to.z, glow(ROOT, 1.8), 30, 3, 0.5);
      particles.burst(to.x, 1, to.z, SHADOW.clone().multiplyScalar(0.7), 20, 2, 0.6);
      return true;
    case 'tempest':
      fx.beam(from, to, LIGHTNING, 0.2, 1.2);
      particles.burst(from.x, 1, from.z, glow(STORM, 1.6), 16, 3, 0.3);
      return true;
    default:
      return false;
  }
}
