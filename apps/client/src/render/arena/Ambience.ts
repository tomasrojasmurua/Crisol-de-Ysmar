import * as THREE from 'three';
import { createGlowTexture } from './textures';

/**
 * Ambiente del borde de la arena: velas, cristales de la Trama y estandartes. Todo pensado
 * para el celular: cada tipo de objeto es una sola malla instanciada (una llamada de dibujo),
 * y nada agrega luces reales. Lo que "ilumina" son materiales que brillan solos más el
 * resplandor (bloom) y charcos de luz pintados en el suelo.
 */

const PILLAR_COUNT = 10;
const WALL_SEGMENTS = 36;
const CANDLE_COLOR = new THREE.Color('#ffb35c');
const CRYSTAL_COLOR = new THREE.Color('#b49cff');

interface Candle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly height: number;
}

export class Ambience {
  readonly group = new THREE.Group();
  private readonly flameMaterial: THREE.ShaderMaterial;
  private readonly time = { value: 0 };
  private readonly glow: THREE.Texture;
  private readonly banners: THREE.InstancedMesh;
  private readonly bannerBase: THREE.Matrix4[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly sway = new THREE.Matrix4();

  constructor(arenaRadius: number) {
    const glow = createGlowTexture();
    this.glow = glow;
    const candles = candlePositions(arenaRadius);
    this.group.add(createWax(candles));
    this.flameMaterial = flameMaterial(glow, this.time);
    this.group.add(createFlames(candles, this.flameMaterial));
    this.group.add(createLightPools(candles, arenaRadius, glow));
    this.group.add(createCrystals(arenaRadius));
    this.banners = createBanners(arenaRadius, this.bannerBase);
    this.group.add(this.banners);
  }

  update(timeSeconds: number): void {
    this.time.value = timeSeconds;
    // Los estandartes se mecen apenas, cada uno a su ritmo.
    this.bannerBase.forEach((base, i) => {
      this.sway.makeRotationX(0.05 * Math.sin(timeSeconds * 0.9 + i * 1.3));
      this.matrix.multiplyMatrices(base, this.sway);
      this.banners.setMatrixAt(i, this.matrix);
    });
    this.banners.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.group.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Points) {
        node.geometry.dispose();
        const material = node.material as THREE.Material & { map?: THREE.Texture | null };
        material.map?.dispose();
        material.dispose();
      }
    });
    this.glow.dispose();
  }
}

/** Velas en grupos: al pie de cada columna y sobre algunos bloques del murete. */
function candlePositions(arenaRadius: number): Candle[] {
  const candles: Candle[] = [];
  const cluster = (cx: number, cz: number, baseY: number, seed: number): void => {
    for (let k = 0; k < 3; k++) {
      const a = seed * 2.1 + k * 2.3;
      const d = k === 0 ? 0 : 0.16 + 0.05 * k;
      candles.push({
        x: cx + Math.cos(a) * d,
        y: baseY,
        z: cz + Math.sin(a) * d,
        height: 0.16 + ((seed * 7 + k * 3) % 5) * 0.04,
      });
    }
  };
  // Al pie de las columnas, del lado que mira a la arena.
  const pillarR = arenaRadius + 3.2 - 1.15;
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const angle = -Math.PI / 2 + (i / PILLAR_COUNT) * Math.PI * 2;
    cluster(Math.cos(angle) * pillarR, Math.sin(angle) * pillarR, 0, i);
  }
  // Sobre el murete (misma altura de cada bloque que dibuja ArenaView).
  const wallR = arenaRadius + 0.9;
  for (let i = 2; i < WALL_SEGMENTS; i += 5) {
    const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
    const height = 0.5 + ((i * 37) % 7) * 0.06;
    cluster(Math.cos(angle) * wallR, Math.sin(angle) * wallR, height, i + 20);
  }
  return candles;
}

function createWax(candles: readonly Candle[]): THREE.InstancedMesh {
  const geometry = new THREE.CylinderGeometry(0.045, 0.05, 1, 6);
  geometry.translate(0, 0.5, 0);
  const material = new THREE.MeshStandardMaterial({
    color: '#d9c9a8',
    emissive: '#5a3a1a',
    emissiveIntensity: 0.6,
    roughness: 0.7,
  });
  const wax = new THREE.InstancedMesh(geometry, material, candles.length);
  const matrix = new THREE.Matrix4();
  candles.forEach((c, i) => {
    matrix.compose(
      new THREE.Vector3(c.x, c.y, c.z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, c.height, 1),
    );
    wax.setMatrixAt(i, matrix);
  });
  return wax;
}

/** Llamas como puntos con un parpadeo propio cada una, todo en la tarjeta gráfica. */
function flameMaterial(glow: THREE.Texture, time: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: glow },
      time,
      color: { value: CANDLE_COLOR.clone().multiplyScalar(2.4) },
      scale: { value: 520 },
    },
    vertexShader: /* glsl */ `
      attribute float phase;
      uniform float time;
      uniform float scale;
      varying float vFlicker;
      void main() {
        vFlicker = 0.82 + 0.12 * sin(time * 9.0 + phase) + 0.06 * sin(time * 21.0 + phase * 2.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 0.34 * vFlicker * scale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      varying float vFlicker;
      void main() {
        vec2 uv = gl_PointCoord;
        // Más alta que ancha, como una llama.
        uv.x = (uv.x - 0.5) * 1.6 + 0.5;
        float a = texture2D(map, uv).a;
        gl_FragColor = vec4(color * vFlicker, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createFlames(candles: readonly Candle[], material: THREE.ShaderMaterial): THREE.Points {
  const positions = new Float32Array(candles.length * 3);
  const phases = new Float32Array(candles.length);
  candles.forEach((c, i) => {
    positions.set([c.x, c.y + c.height + 0.06, c.z], i * 3);
    phases[i] = i * 1.618;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const flames = new THREE.Points(geometry, material);
  flames.frustumCulled = false;
  return flames;
}

/**
 * Charcos de luz cálida pintados en el suelo bajo cada grupo de velas, y uno violeta bajo
 * cada grupo de cristales: parecen luz y cuestan lo mismo que un dibujo plano.
 */
function createLightPools(
  candles: readonly Candle[],
  arenaRadius: number,
  glow: THREE.Texture,
): THREE.InstancedMesh {
  const centers: { x: number; z: number; size: number; color: THREE.Color }[] = [];
  for (let i = 0; i < candles.length; i += 3) {
    const c = candles[i];
    if (c) centers.push({ x: c.x, z: c.z, size: 3.2, color: CANDLE_COLOR });
  }
  for (const spot of crystalSpots(arenaRadius)) {
    centers.push({ x: spot.x, z: spot.z, size: 3, color: CRYSTAL_COLOR });
  }
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: glow,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const pools = new THREE.InstancedMesh(geometry, material, centers.length);
  const matrix = new THREE.Matrix4();
  centers.forEach((p, i) => {
    matrix.compose(
      new THREE.Vector3(p.x, 0.04, p.z),
      new THREE.Quaternion(),
      new THREE.Vector3(p.size, 1, p.size),
    );
    pools.setMatrixAt(i, matrix);
    pools.setColorAt(i, p.color);
  });
  return pools;
}

/** Grupos de cristales al pie de las columnas rotas, del lado de afuera. */
function crystalSpots(arenaRadius: number): { x: number; z: number; seed: number }[] {
  const spots: { x: number; z: number; seed: number }[] = [];
  const r = arenaRadius + 3.2 + 0.9;
  for (let i = 1; i < PILLAR_COUNT; i += 2) {
    const angle = -Math.PI / 2 + (i / PILLAR_COUNT) * Math.PI * 2 + 0.12;
    spots.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r, seed: i });
  }
  return spots;
}

function createCrystals(arenaRadius: number): THREE.InstancedMesh {
  const spots = crystalSpots(arenaRadius);
  const perSpot = 5;
  const geometry = new THREE.OctahedronGeometry(1, 0);
  geometry.scale(0.22, 1, 0.22);
  geometry.translate(0, 0.6, 0);
  // Brillan por sí solos por encima del umbral del resplandor: la escena no paga luces.
  const material = new THREE.MeshStandardMaterial({
    color: '#2a1d4a',
    emissive: CRYSTAL_COLOR,
    emissiveIntensity: 1.05,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true,
  });
  const crystals = new THREE.InstancedMesh(geometry, material, spots.length * perSpot);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  spots.forEach((spot, s) => {
    for (let k = 0; k < perSpot; k++) {
      const a = spot.seed * 1.9 + k * 1.37;
      const d = k === 0 ? 0 : 0.25 + 0.12 * (k % 3);
      const height = k === 0 ? 1.5 : 0.55 + ((spot.seed + k * 5) % 4) * 0.22;
      euler.set(Math.sin(a) * 0.35, a, Math.cos(a) * 0.35);
      quaternion.setFromEuler(euler);
      matrix.compose(
        new THREE.Vector3(spot.x + Math.cos(a) * d, 0, spot.z + Math.sin(a) * d),
        quaternion,
        new THREE.Vector3(1, height, 1),
      );
      crystals.setMatrixAt(s * perSpot + k, matrix);
    }
  });
  crystals.castShadow = true;
  return crystals;
}

/** Estandartes violeta con la estrella del Crisol, colgados de las columnas enteras. */
function createBanners(arenaRadius: number, bases: THREE.Matrix4[]): THREE.InstancedMesh {
  const width = 0.95;
  const height = 1.9;
  const geometry = new THREE.PlaneGeometry(width, height);
  // El pivote arriba: se mece desde el travesaño.
  geometry.translate(0, -height / 2, 0);
  const material = new THREE.MeshStandardMaterial({
    map: createBannerTexture(),
    side: THREE.DoubleSide,
    forceSinglePass: true,
    alphaTest: 0.5,
    roughness: 0.95,
    emissive: '#ffffff',
    emissiveIntensity: 0.12,
  });
  material.emissiveMap = material.map;
  const count = PILLAR_COUNT / 2;
  const banners = new THREE.InstancedMesh(geometry, material, count);
  const r = arenaRadius + 3.2 - 0.68;
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + ((i * 2) / PILLAR_COUNT) * Math.PI * 2;
    // Mira hacia el centro de la arena.
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle - Math.PI / 2);
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(angle) * r, 3.55, Math.sin(angle) * r),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    bases.push(base);
    banners.setMatrixAt(i, base);
  }
  return banners;
}

function createBannerTexture(): THREE.Texture {
  const w = 128;
  const h = 256;
  const element = document.createElement('canvas');
  element.width = w;
  element.height = h;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Sin contexto 2D para el estandarte');
  // Tela con cola de golondrina abajo.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w / 2, h * 0.82);
  ctx.lineTo(0, h);
  ctx.closePath();
  const cloth = ctx.createLinearGradient(0, 0, w, 0);
  cloth.addColorStop(0, '#1e1236');
  cloth.addColorStop(0.5, '#3a2366');
  cloth.addColorStop(1, '#1e1236');
  ctx.fillStyle = cloth;
  ctx.fill();
  // Ribete de bronce.
  ctx.strokeStyle = '#a88a52';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#a88a52';
  ctx.fillRect(0, 0, w, 10);
  // La estrella del Crisol.
  const cx = w / 2;
  const cy = h * 0.4;
  const big = 34;
  const small = 9;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k / 8) * Math.PI * 2;
    const r = k % 2 === 0 ? big : small;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#d8bf8a';
  ctx.fill();
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
