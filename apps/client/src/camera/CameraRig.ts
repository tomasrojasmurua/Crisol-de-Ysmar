import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/** Distancia detrás del mago, altura y cuánto mira por delante, en metros. */
const BACK = 7.2;
const HEIGHT = 7.2;
const AHEAD = 4;
/** Más lejos que esto, el objetivo fijado no gira la cámara: está detrás de la jungla. */
const FACE_TARGET_RANGE = 18;
const MANUAL_HOLD_SECONDS = 4;
/** Lo más rápido que la cámara gira sola hacia lo fijado (radianes por segundo, ~115°). */
const TURN_SPEED = 2;
/** Mientras lo fijado quede dentro de este ángulo (~20°) respecto del centro, la cámara no se mueve. */
const DEADBAND = 0.35;
/** Al girar, se detiene cuando lo fijado queda casi al centro. */
const SETTLED = 0.05;
const ORIGIN = new THREE.Vector2(0, 0);

/** Lleva un ángulo a (-π, π]. */
function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Cámara sobre el hombro, detrás del mago y con movimiento suave. En el Hito 1 se comparó con
 * una vista 3/4 y se eligió esta.
 *
 * No gira sola por el rival más cercano: antes giraba hacia él cada cuadro y, en plena pelea
 * con otro, la vista y el joystick cambiaban de sentido. Ahora solo se centra, con suavidad,
 * en lo que el jugador fijó tocándolo; el resto del tiempo se queda donde está (o donde la
 * dejó el dedo).
 */
export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;
  private heading: THREE.Vector2 | null = null;
  /** Segundos que la cámara respeta el giro que hizo el jugador antes de volver a centrar lo fijado. */
  private manualHold = 0;
  /** Lo que se está centrando, para notar cuando se fija algo nuevo. */
  private focusId: number | null = null;
  private turning = false;
  /**
   * El "adelante" del joystick mientras el dedo no lo suelta: si la cámara gira en ese rato,
   * el mago sigue yendo hacia donde iba.
   */
  private moveBasis: THREE.Vector2 | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Vista del menú: la cámara gira despacio alrededor del Crisol. */
  orbit(timeSeconds: number, deltaSeconds: number): void {
    const angle = timeSeconds * 0.06;
    this.desiredPosition.set(Math.cos(angle) * 26, 9, Math.sin(angle) * 26);
    this.desiredLook.set(0, 1.5, 0);
    this.blendTowards(deltaSeconds, 2);
  }

  /**
   * `focus` es lo que el jugador fijó (o, si cayó, a quien sigue el mago que mira). Si está
   * cerca y se sale del centro, la cámara gira hacia él a velocidad limitada. `shake` de 0 a 1
   * sacude la cámara al recibir un golpe fuerte.
   */
  update(
    player: Vec2,
    focus: { readonly id: number; readonly pos: Vec2 } | null,
    deltaSeconds: number,
    shake = 0,
  ): void {
    if (!this.heading) {
      // Al empezar la ronda se mira hacia la plaza.
      this.heading = new THREE.Vector2(-player.x, -player.z);
      if (this.heading.lengthSq() < 1e-4) this.heading.set(0, 1);
      this.heading.normalize();
    }
    this.manualHold = Math.max(0, this.manualHold - deltaSeconds);
    // Fijar algo nuevo lo centra de una vez (con giro suave), aunque ya estuviera cerca del centro.
    const focusId = focus?.id ?? null;
    if (focusId !== this.focusId) {
      this.focusId = focusId;
      this.turning = focusId !== null;
    }
    if (focus && this.manualHold === 0) {
      const dx = focus.pos.x - player.x;
      const dz = focus.pos.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-2 && distance < FACE_TARGET_RANGE) {
        const current = Math.atan2(this.heading.y, this.heading.x);
        const offset = wrapAngle(Math.atan2(dz, dx) - current);
        if (Math.abs(offset) > DEADBAND) this.turning = true;
        if (this.turning) {
          const step = Math.sign(offset) * Math.min(Math.abs(offset), TURN_SPEED * deltaSeconds);
          this.heading.rotateAround(ORIGIN, step);
          if (Math.abs(offset - step) < SETTLED) this.turning = false;
        }
      }
    } else {
      this.turning = false;
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
    this.heading.rotateAround(ORIGIN, radians);
    // Girar con el dedo sí cambia el "adelante" del joystick: es lo que el jugador quiere.
    this.moveBasis?.rotateAround(ORIGIN, radians);
    this.manualHold = MANUAL_HOLD_SECONDS;
    this.turning = false;
  }

  /** Salta sin transición a la próxima posición, por ejemplo al empezar una ronda. */
  snap(): void {
    this.initialized = false;
    this.heading = null;
    this.manualHold = 0;
    this.focusId = null;
    this.turning = false;
    this.moveBasis = null;
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
  /**
   * Como `screenToGround`, pero para el joystick de movimiento: mientras no se suelte, "arriba"
   * sigue siendo el adelante que había al tocarlo, aunque la cámara gire sola.
   */
  moveToGround(right: number, up: number): Vec2 {
    if (right === 0 && up === 0) {
      this.moveBasis = null;
      return { x: 0, z: 0 };
    }
    if (!this.moveBasis) {
      const f = this.forward();
      this.moveBasis = new THREE.Vector2(f.x, f.z);
    }
    const f = { x: this.moveBasis.x, z: this.moveBasis.y };
    const r = { x: -f.z, z: f.x };
    return { x: r.x * right + f.x * up, z: r.z * right + f.z * up };
  }

  screenToGround(right: number, up: number): Vec2 {
    const f = this.forward();
    // A la derecha de la cámara, mirando hacia adelante.
    const r = { x: -f.z, z: f.x };
    return { x: r.x * right + f.x * up, z: r.z * right + f.z * up };
  }
}
