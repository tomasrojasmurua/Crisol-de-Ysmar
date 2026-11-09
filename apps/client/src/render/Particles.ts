import * as THREE from 'three';

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
}

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float falloff = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(vColor * falloff, falloff * vAlpha);
  }
`;

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
  private next = 0;
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 } },
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
    this.baseSizes[i] = spec.size;
    this.gravities[i] = spec.gravity ?? 0;
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
      });
    }
  }

  update(deltaSeconds: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const life = this.lives[i] ?? 0;
      if (life <= 0) continue;
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
      this.sizes[i] = (this.baseSizes[i] ?? 0) * (1 - t * 0.5);
    }
    const geometry = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) {
      const attribute = geometry.getAttribute(name);
      attribute.needsUpdate = true;
    }
  }
}
