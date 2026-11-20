import * as THREE from 'three';
import { FLOATING_FOCI } from './foci';
import type { ModelKit } from './kit';

/** Altura del hombro: el foco gira desde aquí, como si lo levantara el brazo. */
export const SHOULDER_Y = 1.36;

/**
 * Dónde agarra la mano cada foco, en las coordenadas del foco (antes de moverlo al hombro).
 * Los focos que flotan quedan sobre la palma abierta.
 */
const GRIP: Readonly<Record<string, readonly [number, number, number]>> = {
  cetro: [0, 0.78, -0.08],
  varita: [0, 0.9, -0.05],
  orbe: [0, 1.02, -0.06],
  grimorio: [0, 0.98, -0.08],
  cuenco: [0, 0.98, -0.06],
};
const DEFAULT_GRIP: readonly [number, number, number] = [0, 1.06, 0];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Una manga de `from` a `to`: más ancha en el hombro, con un puño que se abre un poco. Devuelve
 * posición, giro y largo para colocar un cilindro de altura 1.
 */
function between(
  from: THREE.Vector3,
  to: THREE.Vector3,
): {
  readonly middle: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly length: number;
} {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
  );
  const middle = from.clone().add(to).multiplyScalar(0.5);
  return {
    middle: [middle.x, middle.y, middle.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    length,
  };
}

/**
 * Los brazos del hechicero, en código: el derecho sostiene el foco y se mueve con él; el
 * izquierdo descansa doblado delante del cuerpo. Mangas de la túnica, puño del adorno y manos de
 * la piel. El foco pasa a girar desde el hombro, para que la mano nunca se despegue de él.
 */
export function buildArms(kit: ModelKit, focus: string): void {
  const r = kit.radius;
  // Manga acampanada: angosta en el hombro, ancha en el puño (arriba del cilindro = la mano).
  const sleeve = new THREE.CylinderGeometry(0.125, 0.08, 1, 10);
  const cuff = new THREE.CylinderGeometry(0.14, 0.13, 0.06, 10);
  const hand = new THREE.SphereGeometry(0.065, 8, 6);
  const shoulderX = r * 0.74;

  // Brazo derecho: dentro del foco, del hombro a la empuñadura.
  const { staff } = kit;
  const grip = GRIP[focus] ?? DEFAULT_GRIP;
  const shoulder = new THREE.Vector3(
    shoulderX - staff.position.x,
    SHOULDER_Y,
    0.02 - staff.position.z,
  );
  const hold = new THREE.Vector3(grip[0], grip[1], grip[2]);
  // El puño queda un poco antes de la mano.
  const wrist = hold.clone().lerp(shoulder, 0.16);
  const right = between(shoulder, wrist);
  kit.held(sleeve, kit.robe, right.middle, right.rotation, [1, right.length, 1]);
  kit.held(cuff, kit.trim, [wrist.x, wrist.y, wrist.z], right.rotation);
  const floating = FLOATING_FOCI.has(focus);
  // La palma abierta bajo lo que flota; el puño cerrado alrededor del palo.
  kit.held(
    hand,
    kit.skin,
    [hold.x, hold.y, hold.z],
    [0, 0, 0],
    floating ? [1.2, 0.6, 1.3] : [1, 1.2, 1],
  );

  // El foco gira desde el hombro: se baja todo lo que cuelga de él y se sube el grupo.
  for (const child of staff.children) child.position.y -= SHOULDER_Y;
  staff.position.y = SHOULDER_Y;

  // Brazo izquierdo: doblado, con la mano delante de la cintura.
  const leftShoulder = new THREE.Vector3(-shoulderX, SHOULDER_Y, 0.02);
  const elbow = new THREE.Vector3(-shoulderX - 0.08, 1.1, 0.12);
  const leftHand = new THREE.Vector3(-r * 0.3, 1.04, r * 0.75);
  for (const [a, b] of [
    [leftShoulder, elbow],
    [elbow, leftHand.clone().lerp(elbow, 0.2)],
  ] as const) {
    const part = between(a, b);
    kit.solid(sleeve, kit.robe, part.middle, part.rotation, [1, part.length, 1]);
  }
  kit.solid(hand, kit.skin, [leftHand.x, leftHand.y, leftHand.z]);
}

/**
 * Junta las piezas del foco por material. Con la manga y la mano el foco tenía hasta 8 piezas
 * sueltas (una llamada de dibujo cada una); así quedan 2 o 3.
 */
export function mergeStaff(kit: ModelKit): void {
  kit.fuse(kit.staff);
}
