import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/** Distancia detrás del mago, altura y cuánto mira por delante, en metros. */
const BACK = 7.2;
const HEIGHT = 7.2;
const AHEAD = 4;
/** Más lejos que esto, el rival no gira la cámara: está detrás de la jungla. */
const FACE_TARGET_RANGE = 18;
const MANUAL_HOLD_SECONDS = 4;

/**
 * Cámara sobre el hombro: detrás del mago y mirando hacia su rival, con movimiento suave.
 * En el Hito 1 se comparó con una vista 3/4 y se eligió esta.
 */
export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;
  private heading: THREE.Vector2 | null = null;
  /** Segundos que la cámara respeta el giro que hizo el jugador antes de volver a seguir al rival. */
  private manualHold = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Vista del menú: la cámara gira despacio alrededor del Crisol. */
  orbit(timeSeconds: number, deltaSeconds: number): void {
    const angle = timeSeconds * 0.06;
    this.desiredPosition.set(Math.cos(angle) * 26, 9, Math.sin(angle) * 26);
    this.desiredLook.set(0, 1.5, 0);
    this.blendTowards(deltaSeconds, 2);
  }

  /**
   * `shake` de 0 a 1 sacude la cámara al recibir un golpe fuerte. Si el rival está cerca, el
   * duelo queda encuadrado cara a cara; si está lejos, la cámara conserva su dirección para que
   * el joystick no cambie de sentido mientras uno camina por la jungla.
   */
  update(player: Vec2, target: Vec2 | null, deltaSeconds: number, shake = 0): void {
    if (!this.heading) {
      // Al empezar la ronda se mira hacia la plaza.
      this.heading = new THREE.Vector2(-player.x, -player.z);
      if (this.heading.lengthSq() < 1e-4) this.heading.set(0, 1);
      this.heading.normalize();
    }
    this.manualHold = Math.max(0, this.manualHold - deltaSeconds);
    if (target && this.manualHold === 0) {
      const toTarget = new THREE.Vector2(target.x - player.x, target.z - player.z);
      const distance = toTarget.length();
      if (distance > 1e-2 && distance < FACE_TARGET_RANGE) {
        this.heading.copy(toTarget.divideScalar(distance));
      }
    }
    const dir = this.heading;
    this.desiredPosition.set(player.x - dir.x * BACK, HEIGHT, player.z - dir.y * BACK);
    this.desiredLook.set(player.x + dir.x * AHEAD, 1.2, player.z + dir.y * AHEAD);

    this.blendTowards(deltaSeconds, 6);
    if (shake > 0) {
      const amount = shake * shake * 0.18;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }
  }

  /** Gira la cámara alrededor del mago; por un rato no se acomoda sola hacia el rival. */
  rotate(radians: number): void {
    if (!this.heading) return;
    this.heading.rotateAround(new THREE.Vector2(0, 0), radians);
    this.manualHold = MANUAL_HOLD_SECONDS;
  }

  /** Salta sin transición a la próxima posición, por ejemplo al empezar una ronda. */
  snap(): void {
    this.initialized = false;
    this.heading = null;
    this.manualHold = 0;
  }

  private blendTowards(deltaSeconds: number, rate: number): void {
    const blend = this.initialized ? 1 - Math.exp(-deltaSeconds * rate) : 1;
    this.initialized = true;
    this.camera.position.lerp(this.desiredPosition, blend);
    this.look.lerp(this.desiredLook, blend);
    this.camera.lookAt(this.look);
  }

  /** Hacia dónde mira la cámara, sobre el suelo. */
  forward(): Vec2 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const len = Math.hypot(forward.x, forward.z) || 1;
    return { x: forward.x / len, z: forward.z / len };
  }

  /**
   * Convierte una dirección de pantalla (derecha, arriba) a una dirección en el suelo,
   * según hacia dónde mira la cámara. Así "arriba" en el joystick siempre es "hacia adelante".
   */
  screenToGround(right: number, up: number): Vec2 {
    const f = this.forward();
    // A la derecha de la cámara, mirando hacia adelante.
    const r = { x: -f.z, z: f.x };
    return { x: r.x * right + f.x * up, z: r.z * right + f.z * up };
  }
}
