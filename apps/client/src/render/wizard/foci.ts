import * as THREE from 'three';
import type { ModelKit } from './kit';

const HALF_PI = Math.PI / 2;

/** Los focos que flotan junto a la mano en vez de sostenerse. */
export const FLOATING_FOCI: ReadonlySet<string> = new Set(['orbe', 'grimorio', 'cuenco']);

/**
 * El foco: báculo, cetro, orbe, grimorio, linterna, hoz, cuenco o varita. Todos llevan un cristal
 * que toma el color del elemento que estás tejiendo.
 */
export function buildFocus(kit: ModelKit, focus: string): void {
  const { staff, crystal, trim, wood } = kit;
  switch (focus) {
    case 'cetro': {
      kit.held(new THREE.CylinderGeometry(0.025, 0.03, 0.75, 6), trim, [0, 1.0, 0], [0.35, 0, 0]);
      kit.held(new THREE.TorusGeometry(0.075, 0.018, 6, 14), trim, [0, 1.4, 0.13], [0.35, 0, 0]);
      kit.held(
        new THREE.OctahedronGeometry(0.075),
        crystal,
        [0, 1.42, 0.14],
        [0, 0, 0],
        [0.8, 1.3, 0.8],
      );
      staff.position.set(0.42, 0, 0.18);
      break;
    }
    case 'orbe': {
      kit.held(new THREE.SphereGeometry(0.1, 16, 12), crystal, [0, 1.22, 0]);
      const cage = new THREE.TorusGeometry(0.14, 0.012, 6, 24);
      kit.held(cage, trim, [0, 1.22, 0], [Math.PI / 2.4, 0, 0]);
      kit.held(cage, trim, [0, 1.22, 0], [0, HALF_PI, Math.PI / 3]);
      staff.position.set(0.46, 0, 0.3);
      break;
    }
    case 'grimorio': {
      // Un libro abierto que flota, con una runa encendida sobre las páginas.
      const page = new THREE.BoxGeometry(0.16, 0.012, 0.22);
      kit.held(page, kit.bone, [-0.08, 1.15, 0], [0, 0, 0.22]);
      kit.held(page, kit.bone, [0.08, 1.15, 0], [0, 0, -0.22]);
      kit.held(new THREE.BoxGeometry(0.36, 0.02, 0.24), kit.robe, [0, 1.13, 0]);
      kit.held(new THREE.OctahedronGeometry(0.05), crystal, [0, 1.3, 0], [0, 0, 0], [1, 1.4, 1]);
      staff.position.set(0.5, 0, 0.32);
      break;
    }
    case 'linterna': {
      kit.held(new THREE.CylinderGeometry(0.028, 0.035, 1.8, 6), wood, [0, 0.9, 0]);
      kit.held(new THREE.TorusGeometry(0.1, 0.018, 6, 12, Math.PI), trim, [0.1, 1.82, 0]);
      kit.held(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 3), trim, [0.2, 1.75, 0]);
      kit.held(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 6, 1, true), trim, [0.2, 1.6, 0]);
      kit.held(new THREE.ConeGeometry(0.09, 0.07, 6), trim, [0.2, 1.72, 0]);
      kit.held(new THREE.SphereGeometry(0.06, 10, 8), crystal, [0.2, 1.6, 0]);
      staff.position.set(0.46, 0, 0.12);
      break;
    }
    case 'hoz': {
      kit.held(new THREE.CylinderGeometry(0.028, 0.035, 2, 6), wood, [0, 1, 0]);
      kit.held(
        new THREE.TorusGeometry(0.32, 0.028, 4, 16, Math.PI * 0.7),
        trim,
        [-0.04, 1.72, 0],
        [0, 0, 0.35],
        [1, 1, 0.35],
      );
      kit.held(
        new THREE.OctahedronGeometry(0.06),
        crystal,
        [0, 2.02, 0],
        [0, 0, 0],
        [0.8, 1.3, 0.8],
      );
      staff.position.set(0.5, 0, 0.1);
      break;
    }
    case 'cuenco': {
      // Un cuenco de metal que flota y humea con la luz del elemento.
      kit.held(
        new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, HALF_PI, HALF_PI),
        trim,
        [0, 1.15, 0],
        [0, 0, 0],
        [1, 0.7, 1],
      );
      kit.held(new THREE.CircleGeometry(0.1, 14), crystal, [0, 1.14, 0], [-HALF_PI, 0, 0]);
      kit.held(new THREE.SphereGeometry(0.035, 8, 6), crystal, [0, 1.24, 0]);
      staff.position.set(0.46, 0, 0.32);
      break;
    }
    case 'varita': {
      kit.held(new THREE.CylinderGeometry(0.012, 0.02, 0.42, 6), wood, [0, 1.02, 0.1], [0.9, 0, 0]);
      kit.held(
        new THREE.TorusGeometry(0.024, 0.008, 4, 10),
        trim,
        [0, 0.98, 0.07],
        [0.9 + HALF_PI, 0, 0],
      );
      kit.held(new THREE.SphereGeometry(0.035, 10, 8), crystal, [0, 1.15, 0.27]);
      staff.position.set(0.42, 0, 0.2);
      break;
    }
    default: {
      kit.held(new THREE.CylinderGeometry(0.03, 0.04, 2, 6), wood, [0, 1, 0]);
      kit.held(new THREE.TorusGeometry(0.11, 0.025, 6, 12, Math.PI * 1.5), trim, [0, 2.02, 0]);
      kit.held(
        new THREE.OctahedronGeometry(0.1),
        crystal,
        [0, 2.06, 0],
        [0, 0, 0],
        [0.8, 1.4, 0.8],
      );
      staff.position.set(0.48, 0, 0.12);
      break;
    }
  }
}
