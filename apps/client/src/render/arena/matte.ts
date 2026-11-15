import * as THREE from 'three';

/**
 * Material para lo quieto y áspero del escenario (piedra, tierra, madera, hojas): solo luz
 * difusa, sin el brillo calculado del material "realista" (`MeshStandardMaterial`).
 *
 * Con aspereza 0,85 a 1 y nada de metal ese brillo casi no se ve, pero se pagaba en cada píxel
 * del suelo y de los árboles, que llenan casi toda la pantalla: medido en la jungla, era la
 * mayor parte del trabajo de la tarjeta gráfica. Lo que brilla de verdad (cuencos de bronce,
 * cristales, velas) sigue con el material realista.
 */
export function matte(parameters: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial(parameters);
}
