import * as THREE from 'three';
import { HEAD_Y, type ModelKit } from './kit';

/** Dónde quedó cada parte del rostro, para que el sombrero y la máscara calcen. */
export interface FaceInfo {
  /** Coronilla: donde se apoya lo que va en la cabeza. */
  readonly top: number;
  readonly eyeY: number;
  /** Frente del rostro (z), donde van máscaras y barbas. */
  readonly front: number;
  readonly mouthY: number;
  /** Radio de la cabeza, para coronas y turbantes. */
  readonly width: number;
}

/**
 * Arma el rostro. Con capucha honda solo asoma el hocico (o el pico, o los cuernos): la cara
 * queda en sombra con los ojos brillando, como siempre.
 */
export function buildFace(kit: ModelKit, face: string, deepHood: boolean): FaceInfo {
  const builder = FACE_BUILDERS[face] ?? FACE_BUILDERS.humano;
  if (!builder) throw new Error('Falta el rostro humano');
  if (!deepHood) return builder(kit, false);
  // En la sombra de la capucha: un hueco oscuro, los ojos y lo que sobresalga del linaje.
  const r = kit.radius;
  kit.glow(
    new THREE.SphereGeometry(r * 0.42, 12, 10),
    kit.dark,
    [0, HEAD_Y, r * 0.22],
    [0, 0, 0],
    [1, 1.1, 0.6],
  );
  builder(kit, true);
  if (face !== 'automata') kit.eyes(0.07, 1.77, r * 0.45);
  return { top: 2.3, eyeY: 1.77, front: r * 0.45, mouthY: 1.68, width: 0.2 };
}

type FaceBuilder = (kit: ModelKit, hooded: boolean) => FaceInfo;

const sphere = (r: number, w = 16, h = 12): THREE.SphereGeometry =>
  new THREE.SphereGeometry(r, w, h);
const HALF_PI = Math.PI / 2;

function roundHead(kit: ModelKit): void {
  kit.solid(sphere(0.17), kit.skin, [0, HEAD_Y, 0.03], [0, 0, 0], [0.95, 1.1, 1]);
}

const humano: FaceBuilder = (kit, hooded) => {
  if (!hooded) {
    roundHead(kit);
    kit.eyes(0.07, HEAD_Y + 0.02, 0.18);
  }
  return { top: 1.93, eyeY: HEAD_Y + 0.02, front: 0.2, mouthY: 1.68, width: 0.17 };
};

const elfo: FaceBuilder = (kit, hooded) => {
  const info = humano(kit, hooded);
  if (!hooded) {
    const ear = new THREE.ConeGeometry(0.035, 0.22, 6);
    for (const side of [-1, 1]) {
      kit.solid(ear, kit.skin, [side * 0.2, 1.78, -0.01], [0.2, 0, -side * 1.15]);
    }
  }
  return info;
};

const lagarto: FaceBuilder = (kit, hooded) => {
  const snout: [number, number, number] = hooded ? [0, 1.68, 0.24] : [0, 1.7, 0.17];
  kit.solid(sphere(0.11, 12, 10), kit.skin, snout, [0.1, 0, 0], [0.8, 0.6, 1.6]);
  if (!hooded) {
    kit.solid(sphere(0.16), kit.skin, [0, 1.75, 0.02], [0, 0, 0], [0.9, 0.85, 1.15]);
    const spike = new THREE.ConeGeometry(0.03, 0.12, 5);
    for (let i = 0; i < 4; i++) {
      kit.solid(spike, kit.horn, [0, 1.89 - i * 0.03, -0.02 - i * 0.06], [-0.5 - i * 0.15, 0, 0]);
    }
    kit.eyes(0.11, 1.79, 0.1, 0.032);
  }
  return { top: 1.9, eyeY: 1.79, front: 0.3, mouthY: 1.67, width: 0.16 };
};

function canine(kit: ModelKit, hooded: boolean, slim: boolean): FaceInfo {
  const z = hooded ? 0.08 : 0;
  const snout = slim
    ? new THREE.CylinderGeometry(0.03, 0.07, 0.26, 8)
    : new THREE.CylinderGeometry(0.05, 0.085, 0.22, 8);
  const length = slim ? 0.26 : 0.22;
  kit.solid(snout, kit.skin, [0, 1.7, 0.1 + length / 2 + z], [HALF_PI, 0, 0]);
  kit.solid(sphere(0.03, 8, 6), kit.dark, [0, 1.71, 0.1 + length + z]);
  if (!hooded) {
    kit.solid(sphere(0.16), kit.skin, [0, 1.75, 0], [0, 0, 0], [1, 1, 1.05]);
    const ear = slim
      ? new THREE.ConeGeometry(0.065, 0.2, 4)
      : new THREE.ConeGeometry(0.05, 0.15, 4);
    for (const side of [-1, 1]) {
      kit.solid(ear, kit.skin, [side * 0.1, 1.92, -0.02], [-0.15, HALF_PI / 2, side * 0.25]);
    }
    kit.eyes(0.07, 1.78, 0.14, 0.03);
  }
  return { top: 1.9, eyeY: 1.78, front: 0.12 + length, mouthY: 1.66, width: 0.16 };
}

const lobo: FaceBuilder = (kit, hooded) => canine(kit, hooded, false);
const zorro: FaceBuilder = (kit, hooded) => canine(kit, hooded, true);

const cuervo: FaceBuilder = (kit, hooded) => {
  const z = hooded ? 0.08 : 0;
  kit.solid(
    new THREE.ConeGeometry(0.055, 0.24, 6),
    kit.horn,
    [0, 1.72, 0.25 + z],
    [HALF_PI + 0.25, 0, 0],
  );
  if (!hooded) {
    kit.solid(sphere(0.15), kit.skin, [0, 1.76, 0]);
    const feather = new THREE.ConeGeometry(0.03, 0.2, 4);
    for (let i = -1; i <= 1; i++) {
      kit.solid(feather, kit.skin, [i * 0.05, 1.86, -0.14], [-2.2, 0, i * 0.3]);
    }
    kit.eyes(0.08, 1.79, 0.11, 0.03);
  }
  return { top: 1.91, eyeY: 1.79, front: 0.32, mouthY: 1.68, width: 0.15 };
};

const carnero: FaceBuilder = (kit, hooded) => {
  const horn = new THREE.TorusGeometry(0.09, 0.032, 6, 14, Math.PI * 1.5);
  for (const side of [-1, 1]) {
    kit.solid(
      horn,
      kit.horn,
      [side * (hooded ? 0.24 : 0.16), 1.82, -0.02],
      [0, side * HALF_PI, 0.6],
    );
  }
  if (!hooded) {
    kit.solid(sphere(0.16), kit.skin, [0, 1.75, 0.02], [0, 0, 0], [0.9, 1.1, 1]);
    kit.solid(sphere(0.09, 12, 10), kit.skin, [0, 1.67, 0.13], [0, 0, 0], [1, 0.8, 1.1]);
    kit.eyes(0.075, 1.78, 0.15);
  }
  return { top: 1.93, eyeY: 1.78, front: 0.22, mouthY: 1.62, width: 0.17 };
};

const sapo: FaceBuilder = (kit, hooded) => {
  if (!hooded) {
    kit.solid(sphere(0.19), kit.skin, [0, 1.71, 0.03], [0, 0, 0], [1.3, 0.7, 1.1]);
    const bulb = sphere(0.06, 10, 8);
    for (const side of [-1, 1]) kit.solid(bulb, kit.skin, [side * 0.11, 1.8, 0.08]);
    kit.eyes(0.11, 1.81, 0.13, 0.034);
    kit.solid(
      new THREE.TorusGeometry(0.14, 0.008, 4, 16, Math.PI),
      kit.dark,
      [0, 1.68, 0.06],
      [HALF_PI + 0.2, 0, Math.PI],
    );
  }
  return { top: 1.86, eyeY: 1.81, front: 0.22, mouthY: 1.66, width: 0.21 };
};

const calavera: FaceBuilder = (kit, hooded) => {
  kit.solid(new THREE.BoxGeometry(0.15, 0.06, 0.1), kit.bone, [0, 1.62, hooded ? 0.14 : 0.07]);
  if (!hooded) {
    kit.solid(sphere(0.16), kit.bone, [0, 1.77, 0.02], [0, 0, 0], [0.95, 1.05, 1]);
    const socket = sphere(0.048, 10, 8);
    for (const side of [-1, 1]) kit.glow(socket, kit.dark, [side * 0.065, 1.77, 0.14]);
    kit.eyes(0.065, 1.77, 0.17, 0.022);
  }
  return { top: 1.94, eyeY: 1.77, front: 0.19, mouthY: 1.64, width: 0.16 };
};

const automata: FaceBuilder = (kit, hooded) => {
  if (!hooded) {
    // Cabeza de metal en ocho caras con cúpula, una placa al frente y una ranura que brilla.
    kit.solid(new THREE.CylinderGeometry(0.15, 0.13, 0.24, 8), kit.trim, [0, 1.73, 0.02]);
    kit.solid(
      new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, HALF_PI),
      kit.trim,
      [0, 1.85, 0.02],
    );
    kit.solid(
      new THREE.CylinderGeometry(0.13, 0.12, 0.2, 8, 1, false, -0.7, 1.4),
      kit.skin,
      [0, 1.73, 0.035],
    );
    kit.glow(new THREE.BoxGeometry(0.16, 0.026, 0.02), kit.eye, [0, 1.78, 0.17]);
    const bolt = sphere(0.025, 6, 4);
    for (const side of [-1, 1]) kit.solid(bolt, kit.horn, [side * 0.15, 1.75, 0.02]);
  } else {
    kit.glow(new THREE.BoxGeometry(0.17, 0.028, 0.02), kit.eye, [0, 1.77, 0.24]);
  }
  return { top: 1.9, eyeY: 1.79, front: 0.18, mouthY: 1.68, width: 0.18 };
};

const FACE_BUILDERS: Readonly<Record<string, FaceBuilder>> = {
  humano,
  elfo,
  lagarto,
  lobo,
  zorro,
  cuervo,
  carnero,
  sapo,
  calavera,
  automata,
};
