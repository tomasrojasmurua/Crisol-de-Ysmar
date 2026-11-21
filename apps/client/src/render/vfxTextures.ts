import type { ElementId } from '@crisol/core';
import * as THREE from 'three';
import decalsUrl from '../assets/vfx/marcas.webp';
import sealsUrl from '../assets/vfx/sellos.webp';
import { shared } from './dispose';
import { uploadEarly } from './earlyUpload';
import { atlasCell, type ParticleShape, particleAtlas } from './particleAtlas';

/** Las marcas del suelo, a color con transparencia, en un atlas de 3 × 2 casillas. */
export const DECALS = ['ceniza', 'hojas', 'escombros', 'musgo', 'grieta'] as const;
export type DecalName = (typeof DECALS)[number];

/** Los sellos de los elementos, en gris sobre negro, en un atlas de 3 × 2 casillas. */
const SEAL_ORDER: readonly ElementId[] = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'];

const loaded = new Map<string, THREE.Texture>();
/** Cada casilla pedida, armada una sola vez y compartida por todas las vistas. */
const cells = new Map<string, THREE.Texture>();

function load(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  let texture = loaded.get(url);
  if (!texture) {
    const created = new THREE.TextureLoader().load(url, () => uploadEarly(created));
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
): THREE.Texture {
  const key = `${url}#${index}`;
  let texture = cells.get(key);
  if (!texture) {
    const rows = 2;
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
}
