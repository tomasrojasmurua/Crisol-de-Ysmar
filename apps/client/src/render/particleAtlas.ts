import * as THREE from 'three';
import atlasUrl from '../assets/vfx/particulas.png';
import { uploadEarly } from './earlyUpload';

/**
 * Las formas que puede tener una chispa. Todas viven en una sola textura de 512 × 512 (un atlas
 * de 4 × 4 casillas, en gris sobre negro), así el sistema de partículas sigue dibujándose en
 * una sola llamada. Las formas salen de ilustraciones hechas para el juego; el punto y la raya
 * se dibujaron aparte.
 */
export const PARTICLE_SHAPES = {
  /** Punto de luz con centro caliente: la chispa de siempre. */
  dot: 0,
  /** Raya fina que se estira en la dirección en que vuela. */
  spark: 1,
  /** Lengua de fuego. */
  ember: 2,
  /** Voluta de humo que crece al apagarse. */
  smoke: 3,
  /** Hoja con nervio. */
  leaf: 4,
  /** Gota con su estela, alargada en la dirección en que cae. */
  drop: 5,
  /** Destello de muchas puntas, para los impactos. */
  star: 6,
  /** Esquirlas de cristal o hielo. */
  shard: 7,
  /** Rayo quebrado. */
  bolt: 8,
  /** Corona de salpicadura. */
  splash: 9,
  /** Orbe de energía en remolino. */
  orb: 10,
  /** Enredadera con espinas. */
  thorns: 11,
  /** Jirones de sombra. */
  shadow: 12,
  /** Tajo en media luna. */
  slash: 13,
} as const;

export type ParticleShape = keyof typeof PARTICLE_SHAPES;

/** Formas que se orientan según su velocidad en pantalla (las demás giran solas). */
export const ORIENTED_SHAPES: ReadonlySet<number> = new Set([
  PARTICLE_SHAPES.spark,
  PARTICLE_SHAPES.drop,
  PARTICLE_SHAPES.ember,
  PARTICLE_SHAPES.bolt,
]);

export const ATLAS_COLUMNS = 4;
export const ATLAS_ROWS = 4;

let atlas: THREE.Texture | null = null;

/**
 * El atlas de las chispas, cargado una sola vez y compartido. Empieza a bajar al abrir el juego
 * (pesa ~70 kB), mucho antes de la primera partida. Se lee el canal rojo: blanco es opaco.
 */
export function particleAtlas(): THREE.Texture {
  if (!atlas) {
    const created = new THREE.TextureLoader().load(atlasUrl, () => uploadEarly(created));
    atlas = created;
    // Las casillas se cuentan desde arriba, como en la imagen.
    atlas.flipY = false;
  }
  return atlas;
}

/**
 * Las coordenadas de una casilla del atlas, para usarla como textura de un sprite o un plano
 * (`texture.offset` y `texture.repeat`).
 */
export function atlasCell(shape: ParticleShape): {
  readonly offset: THREE.Vector2;
  readonly repeat: THREE.Vector2;
} {
  const index = PARTICLE_SHAPES[shape];
  return {
    offset: new THREE.Vector2(
      (index % ATLAS_COLUMNS) / ATLAS_COLUMNS,
      Math.floor(index / ATLAS_COLUMNS) / ATLAS_ROWS,
    ),
    repeat: new THREE.Vector2(1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS),
  };
}
