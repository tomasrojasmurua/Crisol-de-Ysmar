import type * as THREE from 'three';

/**
 * Borde de luz (rim light): los contornos del mago que dan la espalda a la cámara se encienden
 * con el color de su bando. Así la silueta se lee sobre la piedra oscura y se sabe de un
 * vistazo quién es aliado y quién rival. Es un cálculo más en el sombreado del material, sin
 * luces nuevas.
 */
export function addRimLight(
  material: THREE.MeshStandardMaterial,
  color: THREE.Color,
  strength: number,
): void {
  const uniforms = {
    rimColor: { value: color },
    rimStrength: { value: strength },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += rimColor * pow(1.0 - rimFacing, 3.0) * rimStrength;`,
      );
  };
  // Todos los magos comparten el mismo programa: solo cambian los valores.
  material.customProgramCacheKey = () => 'wizard-rim';
}
