import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

export type CameraMode = 'thirdPerson' | 'isometric';

export const CAMERA_LABELS: Record<CameraMode, string> = {
  thirdPerson: '3ª persona',
  isometric: 'Vista 3/4',
};

/**
 * Cámaras intercambiables. Ninguna cambia el juego: solo deciden desde dónde se mira.
 * El cambio entre ellas es suave para poder compararlas en plena pelea.
 */
export class CameraRig {
  mode: CameraMode = 'thirdPerson';
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  toggle(): CameraMode {
    this.mode = this.mode === 'thirdPerson' ? 'isometric' : 'thirdPerson';
    return this.mode;
  }

  update(player: Vec2, target: Vec2 | null, deltaSeconds: number): void {
    if (this.mode === 'thirdPerson') {
      // Detrás del mago, mirando hacia su rival: el duelo queda encuadrado cara a cara.
      const dir = new THREE.Vector2(
        (target?.x ?? player.x) - player.x,
        (target?.z ?? player.z + 1) - player.z,
      );
      if (dir.lengthSq() < 1e-4) dir.set(0, 1);
      dir.normalize();
      this.desiredPosition.set(player.x - dir.x * 6.5, 4.6, player.z - dir.y * 6.5);
      this.desiredLook.set(player.x + dir.x * 4, 1.2, player.z + dir.y * 4);
    } else {
      this.desiredPosition.set(player.x, 11, player.z - 7.5);
      this.desiredLook.set(player.x, 0.5, player.z + 1);
    }

    const blend = this.initialized ? 1 - Math.exp(-deltaSeconds * 6) : 1;
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
