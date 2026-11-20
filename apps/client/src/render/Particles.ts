import * as THREE from 'three';
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  createParticleAtlas,
  ORIENTED_SHAPES,
  PARTICLE_SHAPES,
  type ParticleShape,
} from './particleAtlas';

export type { ParticleShape } from './particleAtlas';

/** Lo que necesita una chispa al nacer. Tiempos en segundos y distancias en metros. */
export interface ParticleSpec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx?: number;
  readonly vy?: number;
  readonly vz?: number;
  readonly color: THREE.Color;
  readonly life: number;
  readonly size: number;
  /** Aceleración vertical: negativa cae, positiva sube como el humo. */
  readonly gravity?: number;
  /** La forma de la chispa (ver `particleAtlas.ts`); sin ella, un punto de luz. */
  readonly shape?: ParticleShape | undefined;
}

const SMOKE = PARTICLE_SHAPES.smoke;

/**
 * Cuánto más grande se dibuja cada forma: una raya o una hoja llena menos su casilla que un
 * punto de luz, y a la misma medida se veía más chica y apagada.
 */
const SHAPE_SCALE: Readonly<Record<number, number>> = {
  [PARTICLE_SHAPES.dot]: 1,
  [PARTICLE_SHAPES.spark]: 2.2,
  [PARTICLE_SHAPES.ember]: 1.7,
  [PARTICLE_SHAPES.smoke]: 1.6,
  [PARTICLE_SHAPES.leaf]: 1.6,
  [PARTICLE_SHAPES.drop]: 1.7,
  [PARTICLE_SHAPES.star]: 2,
  [PARTICLE_SHAPES.shard]: 1.7,
};

/**
 * La forma de una chispa que no pidió ninguna: lo oscuro es humo y lo que sale disparado es
 * una raya (así los estallidos de todos los hechizos ganan estelas sin tocar cada uno).
 */
function autoShape(spec: ParticleSpec): ParticleShape {
  const { r, g, b } = spec.color;
  if (0.2126 * r + 0.7152 * g + 0.0722 * b < 0.06) return 'smoke';
  const speed = Math.hypot(spec.vx ?? 0, spec.vy ?? 0, spec.vz ?? 0);
  return speed > 3 ? 'spark' : 'dot';
}

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aShape;
  attribute float aAngle;
  attribute vec3 aVelocity;
  varying float vAlpha;
  varying vec3 vColor;
  varying vec2 vCell;
  varying vec2 vTurn;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vCell = vec2(mod(aShape, ${ATLAS_COLUMNS}.0), floor(aShape / ${ATLAS_COLUMNS}.0));
    // Las rayas y las gotas miran hacia donde vuelan, medido en la pantalla; el resto gira.
    float angle = aAngle;
    if (aAngle < -100.0) {
      vec4 ahead = projectionMatrix * modelViewMatrix * vec4(position + aVelocity * 0.05, 1.0);
      vec2 dir = ahead.xy / ahead.w - gl_Position.xy / gl_Position.w;
      angle = length(dir) > 1e-5 ? atan(dir.y, dir.x) : 1.5708;
    }
    vTurn = vec2(cos(angle), sin(angle));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  varying float vAlpha;
  varying vec3 vColor;
  varying vec2 vCell;
  varying vec2 vTurn;
  void main() {
    // gl_PointCoord va hacia abajo en y: se da vuelta para que el ángulo calce con la pantalla.
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y);
    vec2 local = vec2(p.x * vTurn.x + p.y * vTurn.y, -p.x * vTurn.y + p.y * vTurn.x) + 0.5;
    if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) discard;
    vec2 uv = (vCell + vec2(local.x, 1.0 - local.y)) / vec2(${ATLAS_COLUMNS}.0, ${ATLAS_ROWS}.0);
    float mask = texture2D(uAtlas, uv).a;
    gl_FragColor = vec4(vColor * mask, mask * vAlpha);
  }
`;

/** Marca de "orientar según la velocidad" en el ángulo de una chispa. */
const ORIENT = -1000;

/**
 * Un único sistema de partículas para toda la escena: un búfer fijo que se recicla,
 * así no se crean objetos por cada chispa y se dibuja en una sola llamada.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lives: Float32Array;
  private readonly baseSizes: Float32Array;
  private readonly gravities: Float32Array;
  private readonly shapes: Float32Array;
  private readonly angles: Float32Array;
  /** Giro por segundo de las formas que no se orientan (hojas, humo, destellos). */
  private readonly spins: Float32Array;
  private next = 0;
  /** Las formas solo cambian al nacer una chispa: se suben a la tarjeta solo entonces. */
  private shapesDirty = false;
  /** Partículas vivas en el último cuadro (para el informe de rendimiento). */
  alive = 0;
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly capacity = 1500) {
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.ages = new Float32Array(capacity);
    this.lives = new Float32Array(capacity);
    this.baseSizes = new Float32Array(capacity);
    this.gravities = new Float32Array(capacity);
    this.shapes = new Float32Array(capacity);
    this.angles = new Float32Array(capacity);
    this.spins = new Float32Array(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geometry.setAttribute('aShape', new THREE.BufferAttribute(this.shapes, 1));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(this.angles, 1));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 }, uAtlas: { value: createParticleAtlas() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** Ajusta el tamaño en pantalla según la altura del lienzo. */
  setViewportHeight(pixels: number): void {
    const uniform = this.material.uniforms.uScale;
    if (uniform) uniform.value = pixels * 0.6;
  }

  emit(spec: ParticleSpec): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.positions.set([spec.x, spec.y, spec.z], i * 3);
    this.velocities.set([spec.vx ?? 0, spec.vy ?? 0, spec.vz ?? 0], i * 3);
    this.colors.set([spec.color.r, spec.color.g, spec.color.b], i * 3);
    this.ages[i] = 0;
    this.lives[i] = spec.life;
    const shape = PARTICLE_SHAPES[spec.shape ?? autoShape(spec)];
    this.baseSizes[i] = spec.size * (SHAPE_SCALE[shape] ?? 1);
    this.gravities[i] = spec.gravity ?? 0;
    if (this.shapes[i] !== shape) {
      this.shapes[i] = shape;
      this.shapesDirty = true;
    }
    const oriented = ORIENTED_SHAPES.has(shape);
    this.angles[i] = oriented ? ORIENT : Math.random() * Math.PI * 2;
    this.spins[i] = oriented ? 0 : (Math.random() - 0.5) * 6;
  }

  /** Un estallido esférico de chispas, para impactos y aterrizajes. */
  burst(
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    count: number,
    speed: number,
    size = 0.35,
    shape?: ParticleShape,
  ): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit({
        x,
        y,
        z,
        vx: Math.sin(phi) * Math.cos(theta) * s,
        vy: Math.abs(Math.cos(phi)) * s,
        vz: Math.sin(phi) * Math.sin(theta) * s,
        color,
        life: 0.35 + Math.random() * 0.4,
        size: size * (0.6 + Math.random() * 0.8),
        gravity: -6,
        shape,
      });
    }
  }

  update(deltaSeconds: number): void {
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.lives[i] ?? 0;
      if (life <= 0) continue;
      alive += 1;
      const age = (this.ages[i] ?? 0) + deltaSeconds;
      this.ages[i] = age;
      const t = age / life;
      if (t >= 1) {
        this.lives[i] = 0;
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }
      const v = i * 3;
      this.velocities[v + 1] =
        (this.velocities[v + 1] ?? 0) + (this.gravities[i] ?? 0) * deltaSeconds;
      for (let k = 0; k < 3; k++) {
        this.positions[v + k] =
          (this.positions[v + k] ?? 0) + (this.velocities[v + k] ?? 0) * deltaSeconds;
      }
      this.alphas[i] = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      // El humo se abre al apagarse; lo demás se achica.
      const grow = this.shapes[i] === SMOKE ? 1 + t * 1.2 : 1 - t * 0.5;
      this.sizes[i] = (this.baseSizes[i] ?? 0) * grow;
      const spin = this.spins[i] ?? 0;
      if (spin !== 0) this.angles[i] = (this.angles[i] ?? 0) + spin * deltaSeconds;
    }
    this.alive = alive;
    const geometry = this.points.geometry;
    if (this.shapesDirty) {
      geometry.getAttribute('aShape').needsUpdate = true;
      this.shapesDirty = false;
    }
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aAngle', 'aVelocity']) {
      const attribute = geometry.getAttribute(name);
      attribute.needsUpdate = true;
    }
  }
}
