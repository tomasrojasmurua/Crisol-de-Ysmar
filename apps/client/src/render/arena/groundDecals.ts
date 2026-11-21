import { MAP_DECOR } from '@crisol/content';
import * as THREE from 'three';
import { shared } from '../dispose';
import { DECALS, type DecalName, decalAtlas } from '../vfxTextures';
import { matte } from './matte';

/** Dónde va cada tipo de marca: entre qué radios, cuántas y de qué tamaño (metros). */
interface Scatter {
  readonly decal: DecalName;
  readonly from: number;
  readonly to: number;
  readonly count: number;
  readonly size: readonly [number, number];
}

/** El borde de las losas de la plaza (ver `ArenaView`). */
const PLAZA_EDGE = MAP_DECOR.plazaRadius + 1.2;
/** El círculo rúnico del centro queda limpio. */
const RUNE_CLEAR = 4.8;

function scatters(arenaRadius: number): readonly Scatter[] {
  const outer = arenaRadius + 6;
  const plaza = MAP_DECOR.plazaRadius;
  // En la plaza del duelo (arena chica) la jungla casi no se ve: menos marcas fuera.
  const jungle = Math.max(0, Math.min(1, (arenaRadius - plaza) / 20));
  return [
    { decal: 'grieta', from: RUNE_CLEAR, to: plaza - 1, count: 6, size: [1.8, 2.8] },
    { decal: 'escombros', from: plaza - 3, to: plaza, count: 5, size: [1.4, 2.2] },
    { decal: 'musgo', from: plaza - 1.5, to: PLAZA_EDGE + 1, count: 8, size: [2, 3.2] },
    {
      decal: 'hojas',
      from: PLAZA_EDGE + 1,
      to: outer,
      count: Math.round(8 + 26 * jungle),
      size: [2, 3.2],
    },
    {
      decal: 'musgo',
      from: PLAZA_EDGE + 2,
      to: outer,
      count: Math.round(4 + 10 * jungle),
      size: [2.2, 3.4],
    },
    {
      decal: 'escombros',
      from: PLAZA_EDGE + 1,
      to: outer,
      count: Math.round(2 + 5 * jungle),
      size: [1.4, 2.4],
    },
  ];
}

/** Ruido fijo y repetible (sin azar): la arena se ve igual en todos los celulares. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Las marcas pintadas del suelo: grietas y escombros en las losas, musgo en el borde de la
 * plaza y hojas secas y musgo en la jungla. Todas en una sola malla con un atlas de imágenes,
 * así cuestan una llamada de dibujo. No tapan nada: van pegadas al suelo y debajo de los
 * hechizos.
 */
export function createGroundDecals(arenaRadius: number): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  let seed = 1;
  for (const scatter of scatters(arenaRadius)) {
    const cell = DECALS.indexOf(scatter.decal);
    const u0 = (cell % 3) / 3;
    const u1 = u0 + 1 / 3;
    const v1 = 1 - Math.floor(cell / 3) / 2;
    const v0 = v1 - 1 / 2;
    for (let i = 0; i < scatter.count; i++) {
      // Repartidas por área, no por radio: si no se amontonan hacia adentro.
      const r = Math.sqrt(
        scatter.from ** 2 + noise(seed++) * (scatter.to ** 2 - scatter.from ** 2),
      );
      const angle = noise(seed++) * Math.PI * 2;
      const size = scatter.size[0] + noise(seed++) * (scatter.size[1] - scatter.size[0]);
      const turn = noise(seed++) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      // Sobre las losas (0,02) o sobre la tierra y los senderos (0,005).
      const y = r < PLAZA_EDGE - size / 2 ? 0.027 : 0.012;
      const half = size / 2;
      const c = Math.cos(turn) * half;
      const s = Math.sin(turn) * half;
      const corners = [
        [-c + s, -s - c, u0, v0],
        [c + s, s - c, u1, v0],
        [c - s, s + c, u1, v1],
        [-c - s, -s + c, u0, v1],
      ] as const;
      for (const k of [0, 2, 1, 0, 3, 2]) {
        const corner = corners[k];
        if (!corner) continue;
        positions.push(x + corner[0], y, z + corner[1]);
        uvs.push(corner[2], corner[3]);
        normals.push(0, 1, 0);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const mesh = new THREE.Mesh(
    geometry,
    matte({
      map: shared(decalAtlas()),
      // Las imágenes vienen con luz de día: se apagan hacia el azul de la noche del Crisol.
      color: '#6f7488',
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}
