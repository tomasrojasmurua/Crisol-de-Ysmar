import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/**
 * Cámara sobre el hombro: detrás del mago y mirando hacia su rival, con movimiento suave.
 * En el Hito 1 se comparó con una vista 3/4 y se eligió esta.
 */
export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Vista del menú: la cámara gira despacio alrededor del Crisol. */
  orbit(timeSeconds: number, deltaSeconds: number): void {
    const angle = timeSeconds * 0.06;
    this.desiredPosition.set(Math.cos(angle) * 21, 7.5, Math.sin(angle) * 21);
    this.desiredLook.set(0, 1.5, 0);
    this.blendTowards(deltaSeconds, 2);
  }

  /** `shake` de 0 a 1 sacude la cámara al recibir un golpe fuerte. */
  update(player: Vec2, target: Vec2 | null, deltaSeconds: number, shake = 0): void {
    // El duelo queda encuadrado cara a cara.
    const dir = new THREE.Vector2(
      (target?.x ?? player.x) - player.x,
      (target?.z ?? player.z + 1) - player.z,
    );
    if (dir.lengthSq() < 1e-4) dir.set(0, 1);
    dir.normalize();
    this.desiredPosition.set(player.x - dir.x * 6.5, 4.6, player.z - dir.y * 6.5);
    this.desiredLook.set(player.x + dir.x * 4, 1.2, player.z + dir.y * 4);

    this.blendTowards(deltaSeconds, 6);
    if (shake > 0) {
      const amount = shake * shake * 0.18;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }
  }

  /** Salta sin transición a la próxima posición, por ejemplo al empezar una ronda. */
  snap(): void {
    this.initialized = false;
  }

  private blendTowards(deltaSeconds: number, rate: number): void {
    const blend = this.initialized ? 1 - Math.exp(-deltaSeconds * rate) : 1;
    this.initialized = true;
    this.camera.position.lerp(this.desiredPosition, blend);
    this.look.lerp(this.desiredLook, blend);
    this.camera.lookAt(this.look);
  }

  /**
   * Convierte una dirección de pantalla (derecha, arriba) a una dirección en el suelo,
   * según hacia dónde mira la cámara. Así "arriba" en el joystick siempre es "hacia adelante".
   */
  screenToGround(right: number, up: number): Vec2 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const fx = forward.x;
    const fz = forward.z;
    const len = Math.hypot(fx, fz) || 1;
    const f = { x: fx / len, z: fz / len };
    // A la derecha de la cámara, mirando hacia adelante.
    const r = { x: -f.z, z: f.x };
    return { x: r.x * right + f.x * up, z: r.z * right + f.z * up };
  }
}
