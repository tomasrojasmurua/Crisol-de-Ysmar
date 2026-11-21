import type * as THREE from 'three';

let renderer: THREE.WebGLRenderer | null = null;
/** Imágenes que bajaron antes de que hubiera con qué subirlas. */
const waiting: THREE.Texture[] = [];

/**
 * Sube a la tarjeta gráfica una textura recién bajada, sin esperar a que se dibuje. three.js la
 * sube la primera vez que algo la usa, y con las imágenes de los efectos eso era en plena pelea
 * (el sello al primer tejido, la quemadura a la primera explosión): decodificarla y armar sus
 * mipmaps traba un cuadro en un celular. Así se hace en el menú, apenas llega.
 */
export function uploadEarly(texture: THREE.Texture): void {
  if (renderer) renderer.initTexture(texture);
  else waiting.push(texture);
}

/** Desde ahora las texturas se suben apenas bajan (y las que esperaban, ya). */
export function setEarlyUploader(next: THREE.WebGLRenderer): void {
  renderer = next;
  for (const texture of waiting.splice(0)) next.initTexture(texture);
}
