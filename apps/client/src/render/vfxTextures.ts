import type { ElementId } from '@crisol/core';
import * as THREE from 'three';
import decalsUrl from '../assets/vfx/marcas.webp';
import sealsUrl from '../assets/vfx/sellos.webp';
import { atlasCell, type ParticleShape, particleAtlas } from './particleAtlas';

/** Las marcas del suelo, a color con transparencia, en un atlas de 3 × 2 casillas. */
export const DECALS = ['ceniza', 'hojas', 'escombros', 'musgo', 'grieta'] as const;
export type DecalName = (typeof DECALS)[number];

/** Los sellos de los elementos, en gris sobre negro, en un atlas de 3 × 2 casillas. */
const SEAL_ORDER: readonly ElementId[] = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'];

const loaded = new Map<string, THREE.Texture>();

function load(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  let texture = loaded.get(url);
  if (!texture) {
    texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = colorSpace;
    texture.anisotropy = 2;
    loaded.set(url, texture);
  }
  return texture;
}

/**
 * Una casilla de un atlas de `columns` × `rows`, contada desde arriba a la izquierda. La copia
 * comparte la imagen con el atlas: la tarjeta gráfica la recibe una sola vez.
 */
function cell(atlas: THREE.Texture, index: number, columns: number, rows: number): THREE.Texture {
  const texture = atlas.clone();
  texture.repeat.set(1 / columns, 1 / rows);
  texture.offset.set((index % columns) / columns, 1 - (Math.floor(index / columns) + 1) / rows);
  return texture;
}

/** La marca del suelo `name` (quemadura, hojas, escombros, musgo o grieta). */
export function decalTexture(name: DecalName): THREE.Texture {
  return cell(load(decalsUrl, THREE.SRGBColorSpace), DECALS.indexOf(name), 3, 2);
}

/** El atlas entero de las marcas, para dibujarlas todas juntas en una malla instanciada. */
export function decalAtlas(): THREE.Texture {
  return load(decalsUrl, THREE.SRGBColorSpace);
}

/** El sello de un elemento: se pinta del color del elemento con mezcla aditiva. */
export function sealTexture(element: ElementId): THREE.Texture {
  return cell(load(sealsUrl, THREE.NoColorSpace), SEAL_ORDER.indexOf(element), 3, 2);
}

/** Una forma del atlas de chispas, como textura suelta para un sprite (destellos, orbes). */
export function shapeTexture(shape: ParticleShape): THREE.Texture {
  const texture = particleAtlas().clone();
  const { offset, repeat } = atlasCell(shape);
  texture.offset.copy(offset);
  texture.repeat.copy(repeat);
  return texture;
}
