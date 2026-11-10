import * as THREE from 'three';
import type { FaceInfo } from './faces';
import type { ModelKit } from './kit';

const HALF_PI = Math.PI / 2;

/**
 * Lo que va en el rostro. En la sombra de la capucha honda solo se ven la máscara de hueso y la
 * barba, que asoma por debajo.
 */
export function buildMask(kit: ModelKit, id: string, face: FaceInfo, deepHood: boolean): void {
  const front = face.front;
  switch (id) {
    case 'barba': {
      kit.solid(
        new THREE.ConeGeometry(0.11, 0.36, 8),
        kit.beard,
        [0, face.mouthY - 0.15, front - 0.07],
        [Math.PI - 0.15, 0, 0],
      );
      break;
    }
    case 'bigote': {
      if (deepHood) break;
      const half = new THREE.ConeGeometry(0.022, 0.13, 6);
      for (const side of [-1, 1]) {
        kit.solid(
          half,
          kit.hair,
          [side * 0.06, face.mouthY + 0.01, front - 0.01],
          [0, 0, side * 1.9],
        );
      }
      break;
    }
    case 'hueso': {
      // Media cáscara de hueso sobre la parte de arriba de la cara, con los ojos por encima.
      const shell = new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI, 0, Math.PI * 0.62);
      // En la capucha honda, la máscara sale de la sombra y los ojos brillan a través de ella.
      const z = deepHood ? front + 0.04 : front;
      kit.solid(shell, kit.bone, [0, face.eyeY + 0.04, z - 0.12], [0.15, 0, 0], [1, 1, 0.7]);
      if (deepHood) kit.eyes(0.06, face.eyeY, z - 0.005, 0.028);
      const horn = new THREE.ConeGeometry(0.018, 0.1, 5);
      kit.solid(horn, kit.bone, [0, face.eyeY + 0.15, z - 0.07], [0.4, 0, 0]);
      break;
    }
    case 'velo': {
      if (deepHood) break;
      const veil = new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI, Math.PI * 0.45, Math.PI * 0.4);
      kit.solid(veil, kit.cape, [0, face.eyeY - 0.02, front - 0.13], [0, 0, 0], [1.05, 1.3, 0.75]);
      break;
    }
    case 'pintura': {
      if (deepHood) break;
      // Tres trazos en cada mejilla que brillan con el color del bando.
      const stroke = new THREE.BoxGeometry(0.008, 0.06, 0.006);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          kit.glow(
            stroke,
            kit.crystal,
            [side * (0.045 + i * 0.022), face.eyeY - 0.07, front - 0.015],
            [0, 0, side * 0.2],
          );
        }
      }
      kit.glow(new THREE.BoxGeometry(0.01, 0.07, 0.006), kit.paint, [
        0,
        face.eyeY + 0.07,
        front - 0.02,
      ]);
      break;
    }
    case 'vendas': {
      if (deepHood) break;
      const band = new THREE.TorusGeometry(face.width + 0.005, 0.018, 4, 20);
      kit.solid(band, kit.cloth, [0, face.eyeY + 0.07, 0.02], [HALF_PI + 0.1, 0, 0]);
      kit.solid(band, kit.cloth, [0, face.eyeY - 0.06, 0.02], [HALF_PI - 0.15, 0, 0.1]);
      break;
    }
    default:
      break;
  }
}
