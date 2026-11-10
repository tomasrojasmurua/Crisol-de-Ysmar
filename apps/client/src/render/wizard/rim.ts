import type * as THREE from 'three';

/** Altura de los hombros, donde se sujeta la capa. */
const SHOULDER_Y = 1.45;

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

/**
 * La capa ondea: sus vértices de la espalda se van hacia atrás y se agitan según cuánto corre
 * el mago. Todo en la tarjeta gráfica, sin tocar la geometría en cada cuadro. Solo afecta lo
 * que cuelga bajo los hombros y por detrás: capuchas y velos (mismo material) quedan quietos.
 */
export function addCapeWave(
  material: THREE.MeshStandardMaterial,
  motion: { readonly time: { value: number }; readonly move: { value: number } },
): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.capeTime = motion.time;
    shader.uniforms.capeMove = motion.move;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float capeTime;\nuniform float capeMove;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (transformed.z < 0.0) {
          float hang = max(0.0, ${SHOULDER_Y.toFixed(2)} - transformed.y);
          float wave = sin(capeTime * 9.0 + transformed.y * 6.0 + transformed.x * 3.0);
          transformed.z -= hang * (0.42 * capeMove + wave * 0.05 * (0.25 + capeMove));
          transformed.y += hang * hang * 0.12 * capeMove;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'wizard-rim-cape';
}
