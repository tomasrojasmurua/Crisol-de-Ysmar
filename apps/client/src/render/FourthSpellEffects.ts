import { type GameEvent, SPELL_WEAVES, type SpellId, type Vec2, type Wizard } from '@crisol/core';
import * as THREE from 'three';
import type { EffectsView } from './EffectsView';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const STORM = elementColor('tormenta');
const WATER = elementColor('marea');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');
const LIGHTNING = new THREE.Color('#e9f6ff');
const LIFE = new THREE.Color('#9effc8');
const GOLD = new THREE.Color('#ffd27a');
const POLLEN = new THREE.Color('#ffe066');
const TIME = new THREE.Color('#f2f6ff');

type Burst = Extract<GameEvent, { type: 'burst' }>;

/** Los hechizos de la cuarta tanda: los demás los dibujan los otros archivos. */
const FOURTH: ReadonlySet<SpellId> = new Set<SpellId>([
  'eruption',
  'solarGrenade',
  'propulsion',
  'monsoon',
  'forge',
  'scald',
  'emberSeed',
  'bonfireSmoke',
  'bonfire',
  'ashHunger',
  'burningEcho',
  'overload',
  'humanRod',
  'shortCircuit',
  'thunderclap',
  'totemCircle',
  'thousandSteps',
  'iceTrack',
  'gale',
  'guidedBolt',
  'zipline',
  'acceleratedGrowth',
  'powerGrid',
  'rewind',
  'instant',
  'linkBolt',
  'siphon',
  'deluge',
  'reflection',
  'waterMirror',
  'lilyPads',
  'rebirth',
  'depth',
  'oblivionMist',
  'pollen',
  'giantMushroom',
  'nettle',
  'fertilize',
  'dew',
  'drought',
  'graft',
  'rot',
  'wither',
  'pickpocket',
  'fatalShadow',
  'evilEye',
  'oath',
  'thrownShadow',
  'lament',
  'abyssWail',
  'transfusion',
  'voodooDoll',
  'soulHarvest',
  'mandrake',
  'vengeance',
]);

/** El color de un hechizo: el de su primer elemento, con el segundo de acento. */
function colorsOf(spell: SpellId): [THREE.Color, THREE.Color] {
  const [first = 'brasa', second = first] = SPELL_WEAVES[spell];
  return [elementColor(first), elementColor(second)];
}

/** El gesto de un hechizo de la cuarta tanda al salir. Devuelve false si no es uno de ellos. */
export function fourthReleased(
  fx: EffectsView,
  particles: Particles,
  spell: SpellId,
  caster: Wizard,
): boolean {
  if (!FOURTH.has(spell)) return false;
  const { x, z } = caster.pos;
  const [main, accent] = colorsOf(spell);
  fx.ring(x, z, main, 1.6, 0.35);
  particles.burst(x, 1.3, z, glow(accent, 1.8), 18, 2.5, 0.35);
  return true;
}

/** Explosiones y destellos de la cuarta tanda. Devuelve false si no es uno de ellos. */
export function fourthBurst(fx: EffectsView, particles: Particles, event: Burst): boolean {
  if (!FOURTH.has(event.spell)) return false;
  const { x, z } = event.pos;
  const r = event.radius;
  switch (event.spell) {
    case 'eruption':
    case 'solarGrenade':
    case 'pollen':
    case 'emberSeed': {
      const color =
        event.spell === 'pollen' ? POLLEN : event.spell === 'solarGrenade' ? GOLD : FIRE;
      fx.ring(x, z, color, r * 1.1, 0.5);
      particles.burst(x, 1, z, glow(color, 2), 60, 6, 0.6);
      particles.burst(x, 0.4, z, new THREE.Color('#3a2a22'), 16, 2, 0.9);
      return true;
    }
    case 'instant':
      // El tiempo se detiene: una columna blanca y quieta.
      fx.column(x, z, TIME, 0.8, 0.9);
      fx.ring(x, z, TIME, r * 1.4, 0.6);
      return true;
    case 'fatalShadow':
      fx.column(x, z, SHADOW, 0.7, 0.8);
      particles.burst(x, 1.2, z, SHADOW.clone().multiplyScalar(0.6), 60, 5, 0.8);
      return true;
    case 'rebirth':
      fx.column(x, z, LIFE, 0.9, 1);
      particles.burst(x, 1, z, glow(LIFE, 2), 50, 4, 0.8);
      return true;
    case 'shortCircuit':
    case 'totemCircle':
    case 'linkBolt':
    case 'powerGrid':
    case 'thunderclap':
      fx.ring(x, z, LIGHTNING, r, 0.35);
      particles.burst(x, 1.2, z, glow(LIGHTNING, 2.2), 24, 5, 0.3);
      return true;
    case 'scald':
    case 'gale':
    case 'lament':
    case 'oblivionMist':
    case 'drought': {
      const [main] = colorsOf(event.spell);
      fx.ring(x, z, main, r, 0.45);
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        particles.emit({
          x: x + Math.cos(angle) * d,
          y: 0.5 + Math.random() * 1.2,
          z: z + Math.sin(angle) * d,
          vx: Math.cos(angle) * 2,
          vy: 0.6,
          vz: Math.sin(angle) * 2,
          color: glow(event.spell === 'scald' ? new THREE.Color('#ffd0b0') : main, 1.2),
          life: 0.7,
          size: 0.8,
        });
      }
      return true;
    }
    case 'giantMushroom':
      fx.ring(x, z, ROOT, r, 0.5);
      particles.burst(x, 1.5, z, glow(ROOT, 1.3), 30, 2.5, 1);
      return true;
    case 'dew':
      particles.burst(x, 1.4, z, glow(LIFE, 1.6), 14, 2, 0.5);
      return true;
    case 'nettle':
      particles.burst(x, 1.2, z, glow(ROOT, 1.8), 10, 3, 0.3);
      return true;
    case 'humanRod':
      fx.ring(x, z, LIGHTNING, 1.4, 0.3);
      particles.burst(x, 1.2, z, glow(STORM, 2), 16, 3, 0.3);
      return true;
    default: {
      const [main, accent] = colorsOf(event.spell);
      fx.ring(x, z, main, r, 0.4);
      particles.burst(x, 1.1, z, glow(accent, 1.8), 20 + Math.round(r * 6), 3, 0.45);
      return true;
    }
  }
}

/** Los saltos de la cuarta tanda. Devuelve false si no es uno de ellos. */
export function fourthBlink(
  fx: EffectsView,
  particles: Particles,
  spell: SpellId,
  from: Vec2,
  to: Vec2,
): boolean {
  switch (spell) {
    case 'thousandSteps':
      fx.beam(from, to, SHADOW, 0.2, 1.1);
      fx.beam(from, to, LIGHTNING, 0.15, 1.1);
      particles.burst(to.x, 1, to.z, glow(STORM, 2), 16, 3, 0.3);
      return true;
    case 'rewind':
      // Una estela que vuelve atrás.
      fx.beam(from, to, TIME, 0.5, 1);
      particles.burst(from.x, 1, from.z, glow(TIME, 1.5), 24, 2, 0.5);
      particles.burst(to.x, 1, to.z, glow(SHADOW, 1.8), 30, 3, 0.5);
      return true;
    case 'lilyPads':
      particles.burst(from.x, 0.3, from.z, glow(WATER, 1.6), 20, 3, 0.4);
      particles.burst(to.x, 0.3, to.z, glow(WATER, 1.8), 24, 3, 0.4);
      fx.ring(to.x, to.z, WATER, 1.2, 0.3);
      return true;
    case 'thrownShadow':
      particles.burst(from.x, 1, from.z, SHADOW.clone().multiplyScalar(0.7), 30, 2.5, 0.5);
      particles.burst(to.x, 1, to.z, glow(FIRE, 1.5), 20, 3, 0.4);
      return true;
    default:
      return false;
  }
}
