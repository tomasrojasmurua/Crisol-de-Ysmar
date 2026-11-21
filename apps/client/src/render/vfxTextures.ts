import type { ElementId } from '@crisol/core';
import * as THREE from 'three';
import trailsUrl from '../assets/vfx/estelas.webp';
import greatsUrl from '../assets/vfx/grandes.webp';
import decalsUrl from '../assets/vfx/marcas.webp';
import marksUrl from '../assets/vfx/marcas-elementos.webp';
import headsUrl from '../assets/vfx/proyectiles.webp';
import sealsUrl from '../assets/vfx/sellos.webp';
import { shared } from './dispose';
import { uploadEarly } from './earlyUpload';
import { atlasCell, type ParticleShape, particleAtlas } from './particleAtlas';

/** Las marcas del suelo, a color con transparencia, en un atlas de 3 × 2 casillas. */
export const DECALS = ['ceniza', 'hojas', 'escombros', 'musgo', 'grieta'] as const;
export type DecalName = (typeof DECALS)[number];

/** Los sellos de los elementos, en gris sobre negro, en un atlas de 3 × 2 casillas. */
const SEAL_ORDER: readonly ElementId[] = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'];

/**
 * Las marcas que deja un golpe fuerte de cada elemento, a color con transparencia. La ceniza
 * (la de siempre, para el fuego) vive en el atlas de las marcas del suelo; las demás en otro
 * atlas de 3 × 2 casillas.
 */
export const ELEMENT_MARKS = ['escarcha', 'charco', 'rayo', 'raices', 'sombra'] as const;
export type MarkName = (typeof ELEMENT_MARKS)[number] | 'ceniza';

/** La imagen propia de cada Gran hechizo, en gris sobre negro, en un atlas de 4 × 3 casillas. */
export const GREAT_ART = [
  'meteoro',
  'huracan',
  'ola',
  'hielo',
  'portal',
  'volcan',
  'lanza',
  'abismo',
  'sol',
  'diluvio',
  'espinas',
  'pesadilla',
] as const;
export type GreatArt = (typeof GREAT_ART)[number];

/** Las estelas, una por fila (de arriba abajo) y con la cabeza a la derecha. */
export const TRAIL_ORDER: readonly ElementId[] = SEAL_ORDER;

const loaded = new Map<string, THREE.Texture>();
/**
 * Vistas de una imagen que la tarjeta gráfica guarda aparte (se repiten distinto que el atlas):
 * se suben junto con la imagen, apenas baja.
 */
const companions = new Map<string, THREE.Texture[]>();
/** Cada casilla pedida, armada una sola vez y compartida por todas las vistas. */
const cells = new Map<string, THREE.Texture>();

function load(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  let texture = loaded.get(url);
  if (!texture) {
    const created = new THREE.TextureLoader().load(url, () => {
      uploadEarly(created);
      for (const view of companions.get(url) ?? []) uploadEarly(view);
    });
    created.colorSpace = colorSpace;
    created.anisotropy = 2;
    texture = created;
    loaded.set(url, texture);
  }
  return texture;
}

/**
 * Otra vista de la misma imagen (con su propio `offset` y `repeat`) que no la vuelve a subir.
 *
 * `Texture.clone()` de three.js marca la imagen compartida como cambiada: la próxima vez que se
 * dibuja, la tarjeta gráfica la recibe entera otra vez (decodificar 1152 × 768 y armar sus
 * mipmaps, un tirón de 15 a 30 ms en un celular). Pasaba con cada mago que tejía un elemento por
 * primera vez. Aquí se clona y se deja la marca como estaba: todas las copias usan la imagen que
 * ya está en la tarjeta.
 */
export function textureView(base: THREE.Texture): THREE.Texture {
  const version = base.source.version;
  const view = base.clone();
  base.source.version = version;
  return view;
}

/**
 * Una casilla de un atlas de `columns` × `rows`, contada desde arriba a la izquierda. La copia
 * comparte la imagen con el atlas: la tarjeta gráfica la recibe una sola vez.
 */
function cell(
  url: string,
  colorSpace: THREE.ColorSpace,
  index: number,
  columns: number,
  rows = 2,
): THREE.Texture {
  const key = `${url}#${index}`;
  let texture = cells.get(key);
  if (!texture) {
    // Compartida: liberarla al quitar un mago borraría la imagen de la tarjeta para todos.
    texture = shared(textureView(load(url, colorSpace)));
    texture.repeat.set(1 / columns, 1 / rows);
    texture.offset.set((index % columns) / columns, 1 - (Math.floor(index / columns) + 1) / rows);
    cells.set(key, texture);
  }
  return texture;
}

/** La marca del suelo `name` (quemadura, hojas, escombros, musgo o grieta). Compartida. */
export function decalTexture(name: DecalName): THREE.Texture {
  return cell(decalsUrl, THREE.SRGBColorSpace, DECALS.indexOf(name), 3);
}

/** El atlas entero de las marcas, para dibujarlas todas juntas en una malla instanciada. */
export function decalAtlas(): THREE.Texture {
  return load(decalsUrl, THREE.SRGBColorSpace);
}

/** El sello de un elemento: se pinta del color del elemento con mezcla aditiva. Compartido. */
export function sealTexture(element: ElementId): THREE.Texture {
  return cell(sealsUrl, THREE.NoColorSpace, SEAL_ORDER.indexOf(element), 3);
}

/** La cabeza del proyectil de un elemento: se pinta de su color con mezcla aditiva. */
export function projectileHead(element: ElementId): THREE.Texture {
  return cell(headsUrl, THREE.NoColorSpace, SEAL_ORDER.indexOf(element), 3);
}

/** La marca que deja un golpe fuerte: ceniza, escarcha, charco, rayo, raíces o sombra. */
export function markTexture(mark: MarkName): THREE.Texture {
  if (mark === 'ceniza') return decalTexture('ceniza');
  return cell(marksUrl, THREE.SRGBColorSpace, ELEMENT_MARKS.indexOf(mark), 3);
}

/** La imagen de un Gran hechizo, para un sprite o un plano aditivo. Compartida. */
export function greatTexture(art: GreatArt): THREE.Texture {
  return cell(greatsUrl, THREE.NoColorSpace, GREAT_ART.indexOf(art), 4, 3);
}

/** El atlas de las estelas: la malla de las cintas elige su fila con las coordenadas. */
export function trailAtlas(): THREE.Texture {
  return load(trailsUrl, THREE.NoColorSpace);
}

/**
 * La fila de estela de un elemento como textura propia que se repite a lo largo, para que
 * corra sobre una superficie (el agua de la ola). Es otra vista del atlas de estelas: la
 * tarjeta gráfica la guarda aparte porque se repite distinto, pero mide lo mismo (640 kB).
 */
export function flowTexture(element: ElementId): THREE.Texture {
  primeFlow();
  const row = TRAIL_ORDER.indexOf(element);
  const texture = textureView(trailAtlas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(1, 1 / TRAIL_ORDER.length);
  texture.offset.set(0, 1 - (row + 1) / TRAIL_ORDER.length);
  return texture;
}

/**
 * Una vista de las estelas repetidas que vive siempre y se sube en el menú. three.js guarda una
 * copia en la tarjeta por cada forma de repetir la imagen y la borra cuando se libera la última
 * vista que la usa: sin esta, cada Huracán, Ola, Volcán o Granada solar volvía a subir las
 * estelas enteras (512 × 640 y sus mipmaps) al aparecer, un tirón en plena pelea.
 */
let flowPrimer: THREE.Texture | null = null;
function primeFlow(): void {
  if (flowPrimer) return;
  const primer = textureView(trailAtlas());
  primer.wrapS = THREE.RepeatWrapping;
  flowPrimer = shared(primer);
  const atlas = trailAtlas();
  if (atlas.image) uploadEarly(primer);
  else companions.set(trailsUrl, [...(companions.get(trailsUrl) ?? []), primer]);
}

/** Una forma del atlas de chispas, como textura suelta para un sprite (destellos, orbes). */
export function shapeTexture(shape: ParticleShape): THREE.Texture {
  const texture = textureView(particleAtlas());
  const { offset, repeat } = atlasCell(shape);
  texture.offset.copy(offset);
  texture.repeat.copy(repeat);
  return texture;
}

/** Empieza a bajar las imágenes de los efectos, para que estén subidas antes de la partida. */
export function preloadVfxTextures(): void {
  particleAtlas();
  decalAtlas();
  load(sealsUrl, THREE.NoColorSpace);
  load(headsUrl, THREE.NoColorSpace);
  load(greatsUrl, THREE.NoColorSpace);
  load(marksUrl, THREE.SRGBColorSpace);
  trailAtlas();
  primeFlow();
}
