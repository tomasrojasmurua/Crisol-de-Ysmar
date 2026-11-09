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

type Burst = Extract<GameEvent, { type: 'burst' }>;

/** El gesto de cada hechizo al salir: lo que ve todo el mundo en quien lo lanza. */
export function spellReleased(
  fx: EffectsView,
  particles: Particles,
  spell: SpellId,
  caster: Wizard,
): void {
  const { x, z } = caster.pos;
  switch (spell) {
    case 'comet':
      fx.ring(x, z, FIRE, 2.5, 0.4);
      particles.burst(x, 0.8, z, glow(FIRE, 1.8), 30, 4, 0.5);
      break;
    case 'step':
      fx.ring(x, z, STORM, 1.6, 0.3);
      break;
    case 'iceCoffin':
      particles.burst(x, 1.2, z, glow(ICE, 1.6), 36, 3, 0.6);
      fx.ring(x, z, WATER, 2.2, 0.5);
      break;
    case 'sap':
      particles.burst(x, 1, z, glow(ROOT, 1.5), 20, 2, 0.6);
      break;
    case 'veil':
      particles.burst(x, 1, z, SHADOW.clone().multiplyScalar(0.7), 40, 2.5, 0.8);
      break;
    case 'rootWall':
      fx.ring(x, z, ROOT, 2, 0.35);
      break;
    case 'drain':
    case 'claw':
    case 'chainLightning':
    case 'spark':
    case 'fireball':
    case 'splash':
    case 'geyser':
    case 'thornRush':
    case 'blink':
      break;
  }
}

/** Explosiones y brotes en área, cada uno con su aspecto. */
export function spellBurst(fx: EffectsView, particles: Particles, event: Burst): void {
  const { x, z } = event.pos;
  const r = event.radius;
  switch (event.spell) {
    case 'fireball':
      fx.ring(x, z, FIRE, r * 1.1, 0.5);
      particles.burst(x, 1, z, glow(FIRE, 2), 70, 7, 0.6);
      particles.burst(x, 0.4, z, new THREE.Color('#3a2a22'), 20, 2, 1);
      break;
    case 'geyser':
      fx.column(x, z, WATER, 0.9, r / 0.7);
      fx.ring(x, z, WATER, r * 1.2, 0.6);
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        particles.emit({
          x: x + Math.cos(angle) * d,
          y: 0.2,
          z: z + Math.sin(angle) * d,
          vx: Math.cos(angle) * 1.5,
          vy: 7 + Math.random() * 5,
          vz: Math.sin(angle) * 1.5,
          color: glow(i % 3 === 0 ? ICE : WATER, 1.7),
          life: 0.9,
          size: 0.5,
          gravity: -14,
        });
      }
      break;
    case 'thornRush':
      fx.ring(x, z, ROOT, r, 0.35);
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.emit({
          x: x + Math.cos(angle) * r * 0.5,
          y: 0.1,
          z: z + Math.sin(angle) * r * 0.5,
          vx: Math.cos(angle) * 0.8,
          vy: 4 + Math.random() * 3,
          vz: Math.sin(angle) * 0.8,
          color: glow(i % 2 === 0 ? ROOT : new THREE.Color('#6b4a2a'), 1.4),
          life: 0.45,
          size: 0.4,
          gravity: -12,
        });
      }
      break;
    case 'splash':
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        particles.emit({
          x: x + Math.cos(angle) * d,
          y: 0.9,
          z: z + Math.sin(angle) * d,
          vx: Math.cos(angle) * 2,
          vy: 1.5,
          vz: Math.sin(angle) * 2,
          color: glow(WATER, 1.6),
          life: 0.45,
          size: 0.35,
          gravity: -8,
        });
      }
      break;
    default:
      fx.ring(x, z, glow(LIGHTNING, 1), r, 0.4);
  }
}

/** El rayo en cadena: un trazo que salta de punto en punto. */
export function chainLightning(
  fx: EffectsView,
  particles: Particles,
  points: readonly Vec2[],
): void {
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    fx.beam(from, to, LIGHTNING, 0.3);
    fx.beam(from, to, STORM, 0.45);
    particles.burst(to.x, 1.2, to.z, glow(LIGHTNING, 2), 16, 4, 0.3);
  }
}

/** Destello: desaparece en una chispa y aparece con un trueno. */
export function blinked(fx: EffectsView, particles: Particles, from: Vec2, to: Vec2): void {
  particles.burst(from.x, 1, from.z, glow(STORM, 1.8), 30, 3, 0.4);
  particles.burst(to.x, 1, to.z, glow(LIGHTNING, 2), 30, 5, 0.35);
  fx.ring(to.x, to.z, STORM, 2.5, 0.4);
}
