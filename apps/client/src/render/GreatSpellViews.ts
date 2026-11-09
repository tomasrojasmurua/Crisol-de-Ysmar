import type {
  Drown,
  FireRain,
  Portal,
  Pyre,
  SpellId,
  Strike,
  Sweeper,
  ThornRing,
  Trap,
  Wall,
} from '@crisol/core';
import * as THREE from 'three';
import { createGlowTexture } from './arena/textures';
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
const BLOSSOM = new THREE.Color('#ff9ad0');

type Position = { x: number; z: number };

const discGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2);
const planeGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
const spikeGeometry = new THREE.ConeGeometry(0.16, 1, 5).translate(0, 0.5, 0);
const glowTexture = createGlowTexture();

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

const fade = (ticksLeft: number, durationTicks: number): number =>
  Math.min(1, ticksLeft / 15, (durationTicks - ticksLeft + 1) / 6);

// ---------- Golpes con aviso: Géiser, Meteoro, Hervidero, Era de hielo, Abismo, Lanza ----------

/** El color del aviso de cada golpe. */
function strikeColor(spell: SpellId): THREE.Color {
  switch (spell) {
    case 'meteor':
      return FIRE;
    case 'cauldron':
      return MAGMA;
    case 'iceAge':
      return ICE;
    case 'abyss':
      return SHADOW;
    case 'skySpear':
      return LIGHTNING;
    default:
      return WATER;
  }
}

/** El aviso en el suelo: un círculo (o una franja) que se llena hasta que cae el golpe. */
export function createStrike(strike: Strike): THREE.Object3D {
  const color = strikeColor(strike.payload.spell);
  const group = new THREE.Group();
  group.position.set(strike.pos.x, 0.05, strike.pos.z);
  if (strike.line) {
    // Una franja que sale de los pies de quien la lanzó.
    group.rotation.y = Math.atan2(strike.line.dir.x, strike.line.dir.z);
    const edge = new THREE.Mesh(planeGeometry, additive(glow(color, 0.8), 0.18));
    edge.scale.set(strike.radius * 2, 1, strike.line.length);
    const fill = new THREE.Mesh(planeGeometry, additive(glow(STORM, 1.2), 0.2));
    fill.scale.set(strike.radius * 2, 1, 0.01);
    group.add(edge, fill);
    group.userData.fill = fill;
    group.userData.length = strike.line.length;
    return group;
  }
  const ring = new THREE.Mesh(ringGeometry, additive(glow(color, 1.8), 0.8));
  ring.scale.setScalar(strike.radius);
  const fill = new THREE.Mesh(discGeometry, additive(glow(color, 1.2), 0.15));
  fill.scale.setScalar(strike.radius);
  group.add(ring, fill);
  group.userData.fill = fill;
  if (strike.payload.spell === 'meteor') {
    // La roca que cae, cada vez más cerca y más brillante.
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshStandardMaterial({
        color: '#2b1a12',
        emissive: FIRE,
        emissiveIntensity: 0.8,
        flatShading: true,
      }),
    );
    rock.add(halo(glow(FIRE, 1.8), 4));
    group.add(rock);
    group.userData.rock = rock;
  }
  return group;
}

export function updateStrike(
  view: THREE.Object3D,
  strike: Strike,
  time: number,
  particles: Particles,
): void {
  const progress = 1 - strike.ticksLeft / strike.delayTicks;
  const fill = view.userData.fill as THREE.Mesh;
  const material = fill.material as THREE.MeshBasicMaterial;
  material.opacity = strike.line ? 0.12 + 0.25 * progress : 0.15 + 0.35 * progress;
  const spell = strike.payload.spell;
  if (strike.line) {
    const length = view.userData.length as number;
    fill.scale.z = Math.max(0.01, length * progress);
    if (Math.random() < 0.5) {
      const t = Math.random() * length;
      const dir = strike.line.dir;
      particles.emit({
        x: strike.pos.x + dir.x * t,
        y: 0.2,
        z: strike.pos.z + dir.z * t,
        vy: 2 + progress * 4,
        color: glow(LIGHTNING, 1.8),
        life: 0.25,
        size: 0.3,
      });
    }
    return;
  }
  fill.scale.setScalar(strike.radius * Math.max(0.05, progress));
  view.rotation.y = time * (spell === 'abyss' ? -3 : 2);
  const rock = view.userData.rock as THREE.Object3D | undefined;
  if (rock) {
    rock.position.set(-6 * (1 - progress), 0.6 + 22 * (1 - progress), 0);
    rock.rotation.set(time * 3, time * 2, 0);
  }
  const color = spell === 'cauldron' && Math.random() < 0.5 ? WATER : strikeColor(spell);
  if (Math.random() < 0.4 + progress) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * strike.radius;
    const inward = spell === 'abyss' ? -1.5 : 0;
    particles.emit({
      x: strike.pos.x + Math.cos(angle) * r,
      y: 0.1,
      z: strike.pos.z + Math.sin(angle) * r,
      vx: Math.cos(angle) * inward,
      vy: spell === 'iceAge' ? 0.3 : 0.8 + progress * 2,
      vz: Math.sin(angle) * inward,
      color: glow(color, 1.6),
      life: 0.4,
      size: spell === 'cauldron' ? 0.45 : 0.35,
    });
  }
}

// ---------- Lo que avanza solo: Huracán, Orbe errático y Maremoto ----------

export function createSweeper(sweeper: Sweeper): THREE.Object3D {
  const group = new THREE.Group();
  if (sweeper.mode === 'tornado') {
    // Un embudo de viento que gira: anillos que se ensanchan hacia arriba, abiertos y tenues.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(
          0.3 + t * sweeper.radius * 1.3,
          0.05 + t * 0.06,
          6,
          24,
          Math.PI * 1.4,
        ),
        additive(glow(i % 2 === 0 ? STORM : ICE, 1.2), 0.45 - t * 0.2),
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.2 + t * 3.6;
      band.userData.twist = 6 - t * 3;
      group.add(band);
    }
  } else if (sweeper.mode === 'orb') {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sweeper.radius * 0.7, 2),
      new THREE.MeshBasicMaterial({ color: glow(LIGHTNING, 1.2) }),
    );
    core.position.y = 1.4;
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sweeper.radius * 1.6, 1),
      additive(glow(STORM, 1), 0.25),
    );
    shell.position.y = 1.4;
    shell.userData.spin = 4;
    const glowSprite = halo(glow(STORM, 0.5), 1.8);
    glowSprite.position.y = 1.4;
    group.add(core, shell, glowSprite);
  } else if (sweeper.mode === 'bird') {
    // Un ave de fuego: cuerpo encendido y dos alas que aletean.
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1.1, 6).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: glow(FIRE, 2.2) }),
    );
    body.position.y = 1.6;
    group.add(body);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.6).translate(side * 0.65, 0, 0).rotateX(-Math.PI / 2),
        additive(glow(side < 0 ? FIRE : MAGMA, 1.6), 0.75),
      );
      wing.position.y = 1.6;
      wing.userData.flap = side;
      group.add(wing);
    }
    const light = halo(glow(FIRE, 0.7), 2.4);
    light.position.y = 1.6;
    group.add(light);
  } else if (sweeper.mode === 'stampede') {
    // Una fila de bestias de raíz y piedra que cargan juntas.
    const hide = new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 0.9 });
    const moss = new THREE.MeshStandardMaterial({
      color: '#3f6a2a',
      emissive: ROOT,
      emissiveIntensity: 0.25,
    });
    const count = 4;
    for (let i = 0; i < count; i++) {
      const beast = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), hide);
      torso.scale.set(0.9, 0.7, 1.3);
      torso.position.y = 0.55;
      const back = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 5), moss);
      back.position.set(0, 0.95, -0.1);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 5).rotateX(Math.PI / 2), hide);
      horn.position.set(0, 0.7, 0.7);
      beast.add(torso, back, horn);
      beast.position.x = ((i / (count - 1)) * 2 - 1) * sweeper.halfWidth;
      beast.scale.setScalar(1.4);
      beast.userData.gallop = i;
      group.add(beast);
    }
  } else if (sweeper.mode === 'wildfire') {
    // Un frente de llamas: lenguas de fuego a lo ancho, de distinta altura.
    const flames = 9;
    for (let i = 0; i < flames; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.6, 6).translate(0, 0.8, 0),
        additive(glow(i % 3 === 0 ? MAGMA : FIRE, 1.4), 0.7),
      );
      flame.position.x = ((i / (flames - 1)) * 2 - 1) * sweeper.halfWidth;
      flame.userData.flicker = i;
      group.add(flame);
    }
    const light = halo(glow(FIRE, 0.5), sweeper.halfWidth * 2.5);
    light.position.y = 0.9;
    group.add(light);
  } else if (sweeper.mode === 'soulTide') {
    // Una ola de almas: un velo violeta con caras pálidas que se arrastran.
    const veil = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, sweeper.radius * 2, 16, 1, true, 0, Math.PI),
      additive(glow(SHADOW, 1.1), 0.35),
    );
    veil.rotation.z = Math.PI / 2;
    veil.position.y = 0.2;
    group.add(veil);
  } else {
    // Una ola ancha, curvada hacia adelante.
    const wave = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, sweeper.halfWidth * 2, 16, 1, true, 0, Math.PI),
      new THREE.MeshStandardMaterial({
        color: '#1f5f8a',
        emissive: WATER,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        roughness: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    wave.rotation.z = Math.PI / 2;
    wave.position.y = 0.2;
    group.add(wave);
  }
  group.rotation.y = Math.atan2(sweeper.velocity.x, sweeper.velocity.z);
  return group;
}

export function updateSweeper(
  view: THREE.Object3D,
  sweeper: Sweeper,
  pos: Position,
  time: number,
  delta: number,
  particles: Particles,
): void {
  view.position.set(pos.x, 0, pos.z);
  // El Ave de ceniza da la vuelta: mira siempre hacia donde va.
  view.rotation.y = Math.atan2(sweeper.velocity.x, sweeper.velocity.z);
  for (const child of view.children) {
    const spin = child.userData.spin as number | undefined;
    if (spin) child.rotation.y += spin * delta;
    const twist = child.userData.twist as number | undefined;
    if (twist) child.rotation.z += twist * delta;
    const flap = child.userData.flap as number | undefined;
    if (flap) child.rotation.z = flap * Math.sin(time * 14) * 0.6;
    const flicker = child.userData.flicker as number | undefined;
    if (flicker !== undefined)
      child.scale.y = 0.8 + 0.5 * Math.abs(Math.sin(time * 9 + flicker * 1.3));
    const gallop = child.userData.gallop as number | undefined;
    if (gallop !== undefined)
      child.position.y = Math.abs(Math.sin(time * 12 + gallop * 1.7)) * 0.25;
  }
  if (sweeper.mode === 'bird') {
    particles.emit({
      x: pos.x + (Math.random() - 0.5) * 0.6,
      y: 1.6 + (Math.random() - 0.5) * 0.3,
      z: pos.z + (Math.random() - 0.5) * 0.6,
      vy: -0.6,
      color: glow(Math.random() < 0.6 ? FIRE : MAGMA, 1.6),
      life: 0.6,
      size: 0.35,
      gravity: 1.5,
    });
    return;
  }
  if (sweeper.mode === 'wildfire') {
    const dir = { x: Math.sin(view.rotation.y), z: Math.cos(view.rotation.y) };
    for (let i = 0; i < 3; i++) {
      const t = (Math.random() * 2 - 1) * sweeper.halfWidth;
      particles.emit({
        x: pos.x - dir.z * t,
        y: 0.3 + Math.random() * 1.2,
        z: pos.z + dir.x * t,
        vy: 2 + Math.random() * 2,
        color: glow(i === 0 ? MAGMA : FIRE, 1.6),
        life: 0.6,
        size: 0.45,
        gravity: 1,
      });
    }
    // Humo detrás del fuego.
    particles.emit({
      x: pos.x - dir.x * 1.2,
      y: 1.5,
      z: pos.z - dir.z * 1.2,
      vy: 1.2,
      color: new THREE.Color('#2a2420').multiplyScalar(0.8),
      life: 1.5,
      size: 1.2,
    });
    return;
  }
  if (sweeper.mode === 'stampede') {
    const dir = { x: Math.sin(view.rotation.y), z: Math.cos(view.rotation.y) };
    const t = (Math.random() * 2 - 1) * sweeper.halfWidth;
    particles.emit({
      x: pos.x - dir.z * t - dir.x * 0.6,
      y: 0.15,
      z: pos.z + dir.x * t - dir.z * 0.6,
      vy: 0.8,
      color: new THREE.Color('#6a5a40').multiplyScalar(0.7),
      life: 0.7,
      size: 0.6,
    });
    return;
  }
  if (sweeper.mode === 'soulTide') {
    const dir = { x: Math.sin(view.rotation.y), z: Math.cos(view.rotation.y) };
    for (let i = 0; i < 2; i++) {
      const t = (Math.random() * 2 - 1) * sweeper.radius;
      particles.emit({
        x: pos.x - dir.z * t,
        y: 0.4 + Math.random() * 1.2,
        z: pos.z + dir.x * t,
        vx: dir.x * 2,
        vy: 0.6,
        vz: dir.z * 2,
        color: glow(i === 0 ? SHADOW : LIGHTNING, i === 0 ? 1.4 : 0.6),
        life: 0.6,
        size: 0.45,
      });
    }
    return;
  }
  if (sweeper.mode === 'tornado') {
    const angle = time * 9;
    particles.emit({
      x: pos.x + Math.cos(angle) * sweeper.radius,
      y: 0.2 + Math.random() * 3,
      z: pos.z + Math.sin(angle) * sweeper.radius,
      vx: -Math.sin(angle) * 3,
      vy: 1.5,
      vz: Math.cos(angle) * 3,
      color: glow(Math.random() < 0.5 ? STORM : ICE, 1.2),
      life: 0.4,
      size: 0.35,
    });
  } else if (sweeper.mode === 'orb') {
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      particles.emit({
        x: pos.x,
        y: 1.4,
        z: pos.z,
        vx: Math.cos(angle) * 4,
        vy: (Math.random() - 0.5) * 3,
        vz: Math.sin(angle) * 4,
        color: glow(LIGHTNING, 2),
        life: 0.15,
        size: 0.22,
      });
    }
  } else {
    // Espuma a lo largo de la cresta.
    const dir = { x: Math.sin(view.rotation.y), z: Math.cos(view.rotation.y) };
    for (let i = 0; i < 3; i++) {
      const t = (Math.random() * 2 - 1) * sweeper.halfWidth;
      particles.emit({
        x: pos.x - dir.z * t,
        y: 1.2 + Math.random() * 0.4,
        z: pos.z + dir.x * t,
        vx: dir.x * 3,
        vy: 1,
        vz: dir.z * 3,
        color: glow(i === 0 ? ICE : WATER, 1.5),
        life: 0.4,
        size: 0.4,
        gravity: -6,
      });
    }
  }
}

// ---------- Marcas sobre un rival: Pira de almas y Ahogo ----------

/** Pira de almas: una llama violeta que crece sobre la cabeza del marcado. */
export function createPyre(): THREE.Object3D {
  const group = new THREE.Group();
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.8, 8).translate(0, 0.4, 0),
    additive(glow(SHADOW, 2.2), 0.8),
  );
  group.add(flame, halo(glow(FIRE, 1.2), 1.4));
  group.userData.flame = flame;
  return group;
}

export function updatePyre(
  view: THREE.Object3D,
  pyre: Pyre,
  delayTicks: number,
  target: Position | undefined,
  time: number,
  particles: Particles,
): void {
  view.visible = target !== undefined;
  if (!target) return;
  const progress = 1 - pyre.ticksLeft / delayTicks;
  view.position.set(target.x, 2.4, target.z);
  const flame = view.userData.flame as THREE.Mesh;
  flame.scale.setScalar(0.6 + progress * 1.2 + 0.1 * Math.sin(time * 20));
  if (Math.random() < 0.3 + progress) {
    particles.emit({
      x: target.x + (Math.random() - 0.5) * 0.3,
      y: 2.5,
      z: target.z + (Math.random() - 0.5) * 0.3,
      vy: 1.5,
      color: glow(Math.random() < 0.6 ? SHADOW : FIRE, 2),
      life: 0.4,
      size: 0.3,
      gravity: 1,
    });
  }
}

/** Ahogo: una columna de agua que sube por el rival y un hilo hasta quien la lanzó. */
export function createDrown(): THREE.Object3D {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1, 18, 1, true).translate(0, 0.5, 0),
    additive(glow(WATER, 1.4), 0.35),
  );
  group.add(column);
  group.userData.column = column;
  return group;
}

export function updateDrown(
  view: THREE.Object3D,
  drown: Drown,
  caster: Position | undefined,
  target: Position | undefined,
  particles: Particles,
): void {
  view.visible = target !== undefined;
  if (!target) return;
  const progress = 1 - drown.ticksLeft / drown.durationTicks;
  view.position.set(target.x, 0, target.z);
  const column = view.userData.column as THREE.Mesh;
  column.scale.y = 0.2 + progress * 2;
  if (caster && Math.random() < 0.6) {
    const t = Math.random();
    particles.emit({
      x: caster.x + (target.x - caster.x) * t,
      y: 1.2,
      z: caster.z + (target.z - caster.z) * t,
      vx: (target.x - caster.x) * 0.8,
      vz: (target.z - caster.z) * 0.8,
      color: glow(Math.random() < 0.5 ? WATER : SHADOW, 1.6),
      life: 0.3,
      size: 0.25,
    });
  }
}

// ---------- Lluvia de fuego ----------

/** Lluvia de fuego: un anillo tenue de su alcance alrededor de quien la lanzó. */
export function createFireRain(radius: number): THREE.Object3D {
  const ring = new THREE.Mesh(ringGeometry, additive(glow(FIRE, 1.2), 0.25));
  ring.scale.setScalar(radius);
  ring.userData.radius = radius;
  return ring;
}

export function updateFireRain(
  view: THREE.Object3D,
  rain: FireRain,
  owner: Position | undefined,
  time: number,
  particles: Particles,
): void {
  view.visible = owner !== undefined;
  if (!owner) return;
  const radius = view.userData.radius as number;
  view.position.set(owner.x, 0.06, owner.z);
  view.rotation.y = time * 0.5;
  ((view as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
    0.25 * Math.min(1, rain.ticksLeft / 15);
  // Brasas que caen del cielo en todo el alcance.
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    particles.emit({
      x: owner.x + Math.cos(angle) * r,
      y: 7,
      z: owner.z + Math.sin(angle) * r,
      vy: -10,
      color: glow(FIRE, 1.8),
      life: 0.65,
      size: 0.35,
    });
  }
}

// ---------- Portal, Anillo de zarzas, Siembra y Manglar ----------

function portalMouth(color: THREE.Color): THREE.Object3D {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.08, 8, 40),
    new THREE.MeshBasicMaterial({ color: glow(color, 2.4) }),
  );
  ring.position.y = 1.3;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), additive(glow(SHADOW, 1), 0.5));
  inside.position.y = 1.3;
  const floor = new THREE.Mesh(ringGeometry, additive(glow(color, 1.4), 0.5));
  floor.position.y = 0.06;
  group.add(ring, inside, floor);
  return group;
}

/** Portal: dos bocas de sombra con borde de brasas. */
export function createPortal(portal: Portal): THREE.Object3D {
  const group = new THREE.Group();
  const a = portalMouth(FIRE);
  const b = portalMouth(STORM);
  a.position.set(portal.a.x, 0, portal.a.z);
  b.position.set(portal.b.x, 0, portal.b.z);
  a.scale.setScalar(portal.radius);
  b.scale.setScalar(portal.radius);
  group.add(a, b);
  return group;
}

export function updatePortal(
  view: THREE.Object3D,
  portal: Portal,
  time: number,
  particles: Particles,
): void {
  const scale = portal.radius * fade(portal.ticksLeft, portal.durationTicks);
  for (const mouth of view.children) {
    mouth.scale.setScalar(Math.max(0.01, scale));
    // Las bocas giran despacio para que se lean desde cualquier ángulo.
    mouth.rotation.y = time * 0.8;
    if (Math.random() < 0.5) {
      const angle = time * 4 + Math.random();
      particles.emit({
        x: mouth.position.x + Math.cos(angle) * portal.radius,
        y: 1.3 + Math.sin(angle) * portal.radius,
        z: mouth.position.z,
        vy: 0.3,
        color: glow(SHADOW, 2),
        life: 0.5,
        size: 0.3,
      });
    }
  }
}

/** Anillo de zarzas: espinas ardientes en círculo. */
export function createThornRing(ring: ThornRing): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(ring.pos.x, 0, ring.pos.z);
  const material = new THREE.MeshStandardMaterial({
    color: '#3b2a1c',
    emissive: FIRE,
    emissiveIntensity: 0.45,
    roughness: 0.9,
    flatShading: true,
  });
  const count = Math.round(ring.radius * 2 * Math.PI * 2.2);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeometry, material);
    spike.position.set(Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius);
    spike.rotation.set(Math.sin(i * 2.1) * 0.35, 0, Math.cos(i * 1.7) * 0.35);
    spike.userData.height = 0.9 + Math.abs(Math.sin(i * 1.3)) * 0.8;
    spike.scale.set(1, 0.01, 1);
    group.add(spike);
  }
  const glowRing = new THREE.Mesh(ringGeometry, additive(glow(FIRE, 1.4), 0.4));
  glowRing.scale.setScalar(ring.radius);
  glowRing.position.y = 0.05;
  group.add(glowRing);
  return group;
}

export function updateThornRing(view: THREE.Object3D, ring: ThornRing, particles: Particles): void {
  const grow = fade(ring.ticksLeft, ring.durationTicks);
  for (const spike of view.children) {
    const height = spike.userData.height as number | undefined;
    if (height) spike.scale.y = Math.max(0.01, height * grow);
  }
  if (Math.random() < 0.6) {
    const angle = Math.random() * Math.PI * 2;
    particles.emit({
      x: ring.pos.x + Math.cos(angle) * ring.radius,
      y: 0.6 + Math.random() * 0.6,
      z: ring.pos.z + Math.sin(angle) * ring.radius,
      vy: 1.4,
      color: glow(FIRE, 1.7),
      life: 0.45,
      size: 0.3,
      gravity: 1,
    });
  }
}

/** Una trampa de la Siembra: una semilla con pétalos que se abren al armarse. */
export function createTrap(trap: Trap): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(trap.pos.x, 0.04, trap.pos.z);
  // Las flores del Jardín son claras, para que tus aliados sepan que pueden pisarlas.
  const petals = new THREE.Mesh(
    new THREE.CircleGeometry(trap.radius, trap.friendly ? 5 : 6).rotateX(-Math.PI / 2),
    additive(glow(trap.friendly ? BLOSSOM : ROOT, 1.2), 0.45),
  );
  const seed = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#4a3424', emissive: WATER, emissiveIntensity: 0.4 }),
  );
  seed.position.y = 0.08;
  group.add(petals, seed);
  group.userData.petals = petals;
  return group;
}

export function updateTrap(view: THREE.Object3D, trap: Trap, time: number): void {
  const petals = view.userData.petals as THREE.Mesh;
  const armed = trap.armTicks === 0;
  petals.scale.setScalar(armed ? 1 : 0.4);
  petals.rotation.y = time * (armed ? 0.6 : 3);
  (petals.material as THREE.MeshBasicMaterial).opacity = armed
    ? 0.3 + 0.12 * Math.sin(time * 4 + trap.id)
    : 0.6;
}

/** Manglar: troncos de agua y raíz que dejan pasar a los magos. */
export function createMangrove(wall: Wall): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(wall.center.x, 0, wall.center.z);
  group.rotation.y = -Math.atan2(wall.along.z, wall.along.x);
  const material = new THREE.MeshStandardMaterial({
    color: '#2f4a3a',
    emissive: WATER,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.7,
    roughness: 0.6,
    flatShading: true,
  });
  const count = Math.round(wall.halfLength * 2.4);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 1, 5).translate(0, 0.5, 0),
      material,
    );
    trunk.position.set((t * 2 - 1) * wall.halfLength, 0, Math.sin(i * 2.7) * 0.25);
    trunk.rotation.z = Math.sin(i * 1.9) * 0.3;
    trunk.userData.height = 1.8 + Math.sin(i * 3.3) * 0.4;
    trunk.scale.set(1, 0.01, 1);
    group.add(trunk);
  }
  const water = new THREE.Mesh(planeGeometry, additive(glow(WATER, 1), 0.25));
  water.scale.set(wall.halfLength * 2, 1, wall.thickness * 2);
  water.position.set(0, 0.05, -wall.thickness);
  group.add(water);
  return group;
}

export function updateMangrove(view: THREE.Object3D, wall: Wall): void {
  const grow = fade(wall.ticksLeft, wall.durationTicks);
  for (const trunk of view.children) {
    const height = trunk.userData.height as number | undefined;
    if (height) trunk.scale.y = Math.max(0.01, height * grow);
  }
}
