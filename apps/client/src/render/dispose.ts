import * as THREE from 'three';

/**
 * Lo que varias vistas usan a la vez (una geometría de módulo, una textura de brillo) no se
 * libera al quitar una vista: se marca aquí al crearlo.
 */
const SHARED = new WeakSet<object>();

/** Marca una geometría o textura como compartida, para que `disposeTree` no la libere. */
export function shared<T extends THREE.BufferGeometry | THREE.Texture>(resource: T): T {
  SHARED.add(resource);
  return resource;
}

const TEXTURE_SLOTS = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap'] as const;

/**
 * Libera en la tarjeta gráfica las geometrías y texturas propias de una vista que ya no se usa.
 * Sin esto, cada conjuro, señuelo, bestia o revancha deja memoria ocupada y el celular se va
 * poniendo más lento durante la partida. Los materiales no se liberan: sus programas se comparten
 * y volver a compilarlos traba un cuadro.
 */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    // Los sprites comparten una geometría interna de three.js.
    if ((object as THREE.Sprite).isSprite)
      return disposeTextures((object as THREE.Sprite).material);
    const mesh = object as THREE.Mesh;
    if (mesh.geometry && !SHARED.has(mesh.geometry)) mesh.geometry.dispose();
    if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        disposeTextures(material);
      }
    }
  });
}

function disposeTextures(material: THREE.Material): void {
  const slots = material as unknown as Record<string, unknown>;
  for (const slot of TEXTURE_SLOTS) {
    const texture = slots[slot];
    if (texture instanceof THREE.Texture && !SHARED.has(texture)) texture.dispose();
  }
}
