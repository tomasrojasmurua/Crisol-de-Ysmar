import type { Current, GameRules, Ignite, Shackle, Wall, Wizard, Zone } from '@crisol/core';
import * as THREE from 'three';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const FIRE = elementColor('brasa');
const WATER = elementColor('marea');
const ROOT = elementColor('raiz');
const SHADOW = elementColor('umbra');
const SNOW = new THREE.Color('#e6f4ff');
const ICE = new THREE.Color('#bfe6ff');

type Position = { x: number; z: number };

const discGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2);
const iceBlockGeometry = new THREE.BoxGeometry(0.9, 1, 0.8);
const shellGeometry = new THREE.IcosahedronGeometry(1, 1);
const chainGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1, 5, 1, true)
  .translate(0, 0.5, 0)
  .rotateX(Math.PI / 2);
const stakeGeometry = new THREE.ConeGeometry(0.18, 0.9, 5).rotateX(Math.PI);

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

const fade = (ticksLeft: number, durationTicks: number): number =>
  Math.min(1, ticksLeft / 15, (durationTicks - ticksLeft + 1) / 6);

// ---------- Zonas: Ventisca, Manantial, Esporas, Fuente termal, Lluvia de vida y Vaho ----------

const ZONE_LOOK = {
  blizzard: { color: new THREE.Color('#7fa8c8'), opacity: 0.14 },
  spring: { color: new THREE.Color('#5fe0c8'), opacity: 0.3 },
  spores: { color: new THREE.Color('#8fbf5a'), opacity: 0.16 },
  hotSpring: { color: new THREE.Color('#ff9a4a'), opacity: 0.22 },
  healingRain: { color: new THREE.Color('#6fe8a0'), opacity: 0.2 },
  mist: { color: new THREE.Color('#9aa0b8'), opacity: 0.12 },
  crimsonMist: { color: new THREE.Color('#a01830'), opacity: 0.2 },
  grove: { color: new THREE.Color('#3a2a55'), opacity: 0.3 },
  moss: { color: new THREE.Color('#4f7a3a'), opacity: 0.18 },
} as const;

/** Una zona encantada: un disco tenue con un borde que gira. */
export function createAreaZone(zone: Zone & { effect: keyof typeof ZONE_LOOK }): THREE.Object3D {
  const look = ZONE_LOOK[zone.effect];
  const group = new THREE.Group();
  group.position.set(zone.pos.x, 0.05, zone.pos.z);
  const disc = new THREE.Mesh(discGeometry, additive(glow(look.color, 1.2), look.opacity));
  disc.scale.setScalar(zone.radius);
  const ring = new THREE.Mesh(ringGeometry, additive(glow(look.color, 1.2), 0.6));
  ring.scale.setScalar(zone.radius);
  group.add(disc, ring);
  group.userData.disc = disc;
  group.userData.ring = ring;
  if (zone.effect === 'grove') group.add(createGrove(zone.radius, zone.id));
  return group;
}

/** Bosque maldito: troncos negros y retorcidos con copas violetas, que tapan la vista. */
function createGrove(radius: number, seed: number): THREE.Object3D {
  const grove = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: '#1c1520',
    roughness: 1,
    flatShading: true,
  });
  const leaves = new THREE.MeshStandardMaterial({
    color: '#1e1828',
    emissive: SHADOW,
    emissiveIntensity: 0.04,
    roughness: 1,
    flatShading: true,
  });
  const trunk = new THREE.CylinderGeometry(0.1, 0.2, 2.2, 5).translate(0, 1.1, 0);
  const crown = new THREE.ConeGeometry(0.9, 1.8, 6).translate(0, 2.6, 0);
  const count = 9;
  for (let i = 0; i < count; i++) {
    // Un reparto fijo a partir del id, para que se vea igual en todas las pantallas.
    const angle = i * 2.4 + seed;
    const d = radius * (0.25 + ((i * 37 + seed) % 10) / 14);
    const tree = new THREE.Group();
    tree.add(new THREE.Mesh(trunk, bark), new THREE.Mesh(crown, leaves));
    tree.position.set(Math.cos(angle) * d, 0, Math.sin(angle) * d);
    tree.rotation.set(0.12 * Math.sin(i), angle, 0.1 * Math.cos(i));
    grove.add(tree);
  }
  grove.userData.grows = true;
  return grove;
}

export function updateAreaZone(
  view: THREE.Object3D,
  zone: Zone,
  time: number,
  particles: Particles,
): void {
  const strength = fade(zone.ticksLeft, zone.durationTicks);
  const ring = view.userData.ring as THREE.Mesh;
  const disc = view.userData.disc as THREE.Mesh;
  const r = zone.radius;
  ring.rotation.y = time * (zone.effect === 'blizzard' ? 3 : 0.6);
  (ring.material as THREE.MeshBasicMaterial).opacity = 0.45 * strength;
  const look = ZONE_LOOK[zone.effect as keyof typeof ZONE_LOOK];
  (disc.material as THREE.MeshBasicMaterial).opacity =
    look.opacity * strength * (0.85 + 0.15 * Math.sin(time * 4));
  const { x, z } = zone.pos;
  if (zone.effect === 'blizzard') {
    // Copos que giran en espiral alrededor del centro.
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = (0.3 + Math.random() * 0.7) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.2 + Math.random() * 2.2,
        z: z + Math.sin(angle) * d,
        vx: -Math.sin(angle) * 5 - Math.cos(angle) * 0.6,
        vy: -0.3,
        vz: Math.cos(angle) * 5 - Math.sin(angle) * 0.6,
        color: glow(i === 0 ? ICE : SNOW, 0.8 * strength),
        life: 0.5,
        size: 0.25,
      });
    }
  } else if (zone.effect === 'spring') {
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.1,
        z: z + Math.sin(angle) * d,
        vy: 1.2 + Math.random(),
        color: glow(Math.random() < 0.5 ? WATER : ROOT, 1.5 * strength),
        life: 0.9,
        size: 0.3,
        gravity: 0.5,
      });
    }
  } else if (zone.effect === 'hotSpring') {
    // Vapor naranja que sube del agua caliente.
    if (Math.random() < 0.7) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.1,
        z: z + Math.sin(angle) * d,
        vy: 1.4 + Math.random(),
        color: glow(Math.random() < 0.6 ? FIRE : WATER, 1.1 * strength),
        life: 1,
        size: 0.5,
      });
    }
  } else if (zone.effect === 'healingRain') {
    // Gotas verdes que caen desde arriba.
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 4,
        z: z + Math.sin(angle) * d,
        vy: -7,
        color: glow(i === 0 ? ROOT : WATER, 1.5 * strength),
        life: 0.55,
        size: 0.18,
      });
    }
  } else if (zone.effect === 'mist') {
    // Bocanadas grises y lentas.
    const angle = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    particles.emit({
      x: x + Math.cos(angle) * d,
      y: 0.4 + Math.random() * 1.6,
      z: z + Math.sin(angle) * d,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.05,
      vz: (Math.random() - 0.5) * 0.3,
      color: new THREE.Color('#aab0c4').multiplyScalar(0.5 * strength),
      life: 1.6,
      size: 1.3,
    });
  } else if (zone.effect === 'crimsonMist') {
    // Niebla roja y espesa que se arrastra.
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.3 + Math.random() * 2,
        z: z + Math.sin(angle) * d,
        vx: -Math.sin(angle) * 0.6,
        vy: 0.05,
        vz: Math.cos(angle) * 0.6,
        color: new THREE.Color(i === 0 ? '#c0203a' : '#5a1020').multiplyScalar(0.7 * strength),
        life: 1.6,
        size: 1.6,
      });
    }
  } else if (zone.effect === 'grove') {
    // Hojas oscuras que caen y humo violeta entre los troncos.
    const angle = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    particles.emit({
      x: x + Math.cos(angle) * d,
      y: 2.5 + Math.random(),
      z: z + Math.sin(angle) * d,
      vx: 0.3,
      vy: -0.8,
      color: glow(Math.random() < 0.5 ? ROOT : SHADOW, 0.8 * strength),
      life: 1.4,
      size: 0.35,
    });
  } else if (zone.effect === 'moss') {
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.1,
        z: z + Math.sin(angle) * d,
        vy: 0.3,
        color: glow(ROOT, 0.7 * strength),
        life: 1.2,
        size: 0.3,
      });
    }
  } else if (zone.effect === 'spores') {
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      particles.emit({
        x: x + Math.cos(angle) * d,
        y: 0.3 + Math.random() * 1.6,
        z: z + Math.sin(angle) * d,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.15,
        vz: (Math.random() - 0.5) * 0.4,
        color: glow(i === 0 ? ROOT : SHADOW, 0.9 * strength),
        life: 1.4,
        size: 0.9,
      });
    }
  }
}

// ---------- Corriente ----------

/** La Corriente: una franja de agua con espuma que corre hacia donde apunta. */
export function createCurrent(current: Current): THREE.Object3D {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: glow(WATER, 1.1) },
      uFoam: { value: glow(SNOW, 1.1) },
      uFade: { value: 1 },
      uLength: { value: current.length },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uFoam;
      uniform float uFade;
      uniform float uLength;
      varying vec2 vUv;
      void main() {
        float along = vUv.y * uLength;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float ends = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        float flow = sin(along * 2.2 - uTime * 9.0 + sin(vUv.x * 9.0) * 1.5);
        float foam = smoothstep(0.75, 1.0, flow) * (0.6 + 0.4 * sin(vUv.x * 30.0 + uTime));
        vec3 color = uColor * (0.5 + 0.25 * flow) + uFoam * foam;
        gl_FragColor = vec4(color, (0.32 + foam * 0.5) * edge * ends * uFade);
      }
    `,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(current.halfWidth * 2, current.length).rotateX(-Math.PI / 2),
    material,
  );
  const mid = {
    x: current.origin.x + (current.dir.x * current.length) / 2,
    z: current.origin.z + (current.dir.z * current.length) / 2,
  };
  plane.position.set(mid.x, 0.06, mid.z);
  // La franja corre hacia -z antes de girarla; se apunta hacia la dirección del río.
  plane.rotation.y = Math.atan2(-current.dir.x, -current.dir.z);
  return plane;
}

export function updateCurrent(
  view: THREE.Object3D,
  current: Current,
  time: number,
  particles: Particles,
): void {
  const material = (view as THREE.Mesh).material as THREE.ShaderMaterial;
  const strength = fade(current.ticksLeft, current.durationTicks);
  if (material.uniforms.uTime) material.uniforms.uTime.value = time;
  if (material.uniforms.uFade) material.uniforms.uFade.value = strength;
  if (Math.random() < 0.7) {
    const t = Math.random() * current.length;
    const side = (Math.random() * 2 - 1) * current.halfWidth;
    particles.emit({
      x: current.origin.x + current.dir.x * t - current.dir.z * side,
      y: 0.15,
      z: current.origin.z + current.dir.z * t + current.dir.x * side,
      vx: current.dir.x * 6,
      vy: 0.3,
      vz: current.dir.z * 6,
      color: glow(Math.random() < 0.3 ? SNOW : WATER, 1.4 * strength),
      life: 0.4,
      size: 0.28,
    });
  }
}

// ---------- Muro de hielo ----------

/** Muro de hielo: bloques que brotan del suelo en fila y se astillan al terminar. */
export function createIceWall(wall: Wall): THREE.Object3D {
  const group = new THREE.Group();
  group.position.set(wall.center.x, 0, wall.center.z);
  group.rotation.y = -Math.atan2(wall.along.z, wall.along.x);
  const material = new THREE.MeshStandardMaterial({
    color: ICE,
    emissive: new THREE.Color('#2f7dff'),
    emissiveIntensity: 0.35,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.75,
    flatShading: true,
  });
  const count = Math.max(3, Math.round(wall.halfLength * 2.2));
  for (let i = 0; i < count; i++) {
    const block = new THREE.Mesh(iceBlockGeometry, material);
    const x = ((i + 0.5) / count - 0.5) * wall.halfLength * 2;
    const height = 1.7 + Math.sin(i * 2.7) * 0.35;
    block.position.set(x, 0, Math.sin(i * 1.9) * 0.08);
    block.rotation.set(Math.sin(i * 3.3) * 0.08, Math.sin(i * 1.3) * 0.25, Math.cos(i * 2.1) * 0.1);
    block.userData.height = height;
    block.scale.set((wall.halfLength * 2) / count / 0.85, 0.01, 1);
    block.castShadow = true;
    group.add(block);
  }
  return group;
}

export function updateIceWall(view: THREE.Object3D, wall: Wall, particles: Particles): void {
  const rise = Math.min(1, (wall.durationTicks - wall.ticksLeft) / 5);
  for (const block of view.children) {
    const height = (block.userData.height as number) * rise;
    block.scale.y = Math.max(0.01, height);
    block.position.y = height / 2;
  }
  // Al final se astilla.
  if (wall.ticksLeft === 2 && !view.userData.shattered) {
    view.userData.shattered = true;
    const along = { x: wall.along.x, z: wall.along.z };
    for (let i = 0; i < 40; i++) {
      const t = (Math.random() * 2 - 1) * wall.halfLength;
      particles.emit({
        x: wall.center.x + along.x * t,
        y: 0.3 + Math.random() * 1.6,
        z: wall.center.z + along.z * t,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 4,
        color: glow(ICE, 1.6),
        life: 0.6,
        size: 0.3,
        gravity: -12,
      });
    }
  }
}

// ---------- Obsidiana, Ignición y Grillete ----------

/** Obsidiana: placas negras alrededor del mago, con grietas que brillan más cuanto más daño atajan. */
export function createObsidian(): THREE.Object3D {
  const shell = new THREE.Mesh(
    shellGeometry,
    new THREE.MeshStandardMaterial({
      color: '#15110f',
      emissive: FIRE,
      emissiveIntensity: 0.04,
      roughness: 0.25,
      metalness: 0.6,
      flatShading: true,
      transparent: true,
      opacity: 0.6,
    }),
  );
  shell.scale.set(0.85, 1.25, 0.85);
  return shell;
}

export function updateObsidian(
  view: THREE.Object3D,
  wearer: Wizard | undefined,
  pos: Position | undefined,
  rules: GameRules,
  time: number,
  particles: Particles,
): void {
  view.visible = Boolean(wearer && pos && wearer.hp > 0);
  if (!wearer || !pos) return;
  view.position.set(pos.x, 1.1, pos.z);
  view.rotation.y = time * 0.4;
  const cracked = 1 - wearer.shield / rules.spells.obsidian.shield;
  const material = (view as THREE.Mesh).material as THREE.MeshStandardMaterial;
  material.emissiveIntensity = 0.04 + cracked * 0.28 + 0.03 * Math.sin(time * 8);
  if (Math.random() < 0.1 + cracked * 0.5) {
    const angle = Math.random() * Math.PI * 2;
    particles.emit({
      x: pos.x + Math.cos(angle) * 0.85,
      y: 0.4 + Math.random() * 1.6,
      z: pos.z + Math.sin(angle) * 0.85,
      vy: 0.8,
      color: glow(FIRE, 1.6),
      life: 0.35,
      size: 0.22,
    });
  }
}

/** Ignición: una brasa negra que late sobre el pecho del rival y crece hasta estallar. */
export function createIgnite(): THREE.Object3D {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: '#1a0d08' }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 12),
    additive(glow(FIRE, 1.4), 0.35),
  );
  group.add(core, halo);
  group.userData.core = core;
  group.userData.halo = halo;
  return group;
}

export function updateIgnite(
  view: THREE.Object3D,
  ignite: Ignite,
  pos: Position | undefined,
  time: number,
  particles: Particles,
): void {
  view.visible = pos !== undefined;
  if (!pos) return;
  const progress = 1 - ignite.ticksLeft / ignite.durationTicks;
  view.position.set(pos.x, 1.35, pos.z);
  const beat = 1 + 0.25 * Math.sin(time * (6 + progress * 18));
  (view.userData.core as THREE.Mesh).rotation.y = time * 3;
  (view.userData.core as THREE.Mesh).scale.setScalar((0.8 + progress * 1.2) * beat);
  const halo = view.userData.halo as THREE.Mesh;
  halo.scale.setScalar((0.8 + progress * 1.6) * beat);
  (halo.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.5;
  if (Math.random() < 0.3 + progress) {
    particles.emit({
      x: pos.x + (Math.random() - 0.5) * 0.5,
      y: 1.35 + (Math.random() - 0.5) * 0.5,
      z: pos.z + (Math.random() - 0.5) * 0.5,
      vy: 1,
      color: glow(FIRE, 1.2 + progress),
      life: 0.4,
      size: 0.25,
    });
  }
}

/** Grillete: una estaca clavada donde quedó atado y una cadena violeta que se tensa. */
export function createShackle(shackle: Shackle): THREE.Object3D {
  const group = new THREE.Group();
  const stake = new THREE.Mesh(
    stakeGeometry,
    new THREE.MeshStandardMaterial({
      color: '#2a1f35',
      emissive: SHADOW,
      emissiveIntensity: 0.6,
      flatShading: true,
    }),
  );
  stake.position.set(shackle.anchor.x, 0.35, shackle.anchor.z);
  const ring = new THREE.Mesh(ringGeometry, additive(glow(SHADOW, 1.5), 0.45));
  ring.position.set(shackle.anchor.x, 0.05, shackle.anchor.z);
  const chain = new THREE.Mesh(chainGeometry, additive(glow(SHADOW, 2.2), 0.85));
  group.add(stake, ring, chain);
  group.userData.ring = ring;
  group.userData.chain = chain;
  return group;
}

export function updateShackle(
  view: THREE.Object3D,
  shackle: Shackle,
  pos: Position | undefined,
  rules: GameRules,
  time: number,
): void {
  const chain = view.userData.chain as THREE.Mesh;
  const ring = view.userData.ring as THREE.Mesh;
  const leash = rules.spells.shackle.leash;
  ring.scale.setScalar(leash);
  ring.rotation.y = time * 0.5;
  chain.visible = pos !== undefined;
  if (!pos) return;
  const start = new THREE.Vector3(shackle.anchor.x, 0.5, shackle.anchor.z);
  const end = new THREE.Vector3(pos.x, 1, pos.z);
  chain.position.copy(start);
  chain.lookAt(end);
  const tension = Math.min(1, start.distanceTo(end) / leash);
  const width = 1 + tension * 1.5 + 0.3 * Math.sin(time * 10);
  chain.scale.set(width, width, Math.max(0.01, start.distanceTo(end)));
  (chain.material as THREE.MeshBasicMaterial).opacity = 0.4 + tension * 0.6;
  (ring.material as THREE.MeshBasicMaterial).opacity = 0.2 + tension * 0.5;
}
