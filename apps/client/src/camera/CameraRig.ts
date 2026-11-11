import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/** Distancia detrás del mago, altura y cuánto mira por delante, en metros. */
const BACK = 7.2;
const HEIGHT = 7.2;
const AHEAD = 4;
/** Al mirar a otro mago (si caíste), más lejos que esto su blanco no gira la cámara. */
const FACE_TARGET_RANGE = 18;
const MANUAL_HOLD_SECONDS = 4;
/** Al mirar a otro mago: lo más rápido que gira sola (radianes por segundo, ~115°). */
const TURN_SPEED = 2;
/** Al mirar a otro mago: mientras su blanco quede dentro de este ángulo (~20°), no se mueve. */
const DEADBAND = 0.35;
/** Al mirar a otro mago: al girar, se detiene cuando el blanco queda casi al centro. */
const SETTLED = 0.05;
/**
 * En duelo, qué tan firme sigue la cámara al rival: cada segundo recorre casi todo lo que le
 * falta (ritmo de una curva exponencial). Alto para que no se escape; no infinito para que no
 * dé tirones cuando el rival salta o se teletransporta.
 */
const DUEL_RATE = 10;
/** En duelo, lo más rápido que gira (radianes por segundo, ~400°): un rival a la espalda tarda medio segundo. */
const DUEL_MAX_SPEED = 7;
/** En duelo, pegado al rival el ángulo salta de lado a lado: más cerca que esto no se gira. */
const DUEL_MIN_DISTANCE = 1.2;
/** Qué tan rápido la cámara alcanza su lugar: en duelo más firme, para que el rival no se corra. */
const FOLLOW_RATE = 6;
const DUEL_FOLLOW_RATE = 10;
const ORIGIN = new THREE.Vector2(0, 0);

/** Lo que sigue la cámara este cuadro. */
export interface CameraFocus {
  readonly id: number;
  readonly pos: Vec2;
  /**
   * `duel`: lo fijaste tú y la cámara lo mantiene siempre al frente, sin margen.
   * `watch`: caíste y miras a otro mago; la cámara solo se acomoda cuando su blanco se aleja
   * del centro.
   */
  readonly kind: 'duel' | 'watch';
}

/** Lleva un ángulo a (-π, π]. */
function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Cámara sobre el hombro, detrás del mago y con movimiento suave. En el Hito 1 se comparó con
 * una vista 3/4 y se eligió esta.
 *
 * Sin nada fijado no gira sola: se queda donde está o donde la deja el dedo. Al tocar un rival
 * o una bestia entra en duelo: lo mantiene siempre al frente y el joystick pasa a moverte
 * alrededor de él. Arrastrar el dedo para mirar suelta el duelo (eso lo decide quien llama).
 */
export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;
  private heading: THREE.Vector2 | null = null;
  /** Segundos que la cámara respeta el giro que hizo el jugador antes de volver a centrar. */
  private manualHold = 0;
  /** Lo que se está siguiendo, para notar cuando cambia. */
  private focusId: number | null = null;
  private turning = false;
  /** Si este cuadro hay duelo: cambia cómo se lee el joystick. */
  private dueling = false;
  /**
   * Sin duelo, el "adelante" del joystick mientras el dedo no lo suelta: si la cámara gira en
   * ese rato, el mago sigue yendo hacia donde iba.
   */
  private moveBasis: THREE.Vector2 | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Si la cámara está en duelo con alguien. */
  get inDuel(): boolean {
    return this.dueling;
  }

  /** Vista del menú: la cámara gira despacio alrededor del Crisol. */
  orbit(timeSeconds: number, deltaSeconds: number): void {
    const angle = timeSeconds * 0.06;
    this.desiredPosition.set(Math.cos(angle) * 26, 9, Math.sin(angle) * 26);
    this.desiredLook.set(0, 1.5, 0);
    this.blendTowards(deltaSeconds, 2);
  }

  /** `shake` de 0 a 1 sacude la cámara al recibir un golpe fuerte. */
  update(player: Vec2, focus: CameraFocus | null, deltaSeconds: number, shake = 0): void {
    if (!this.heading) {
      // Al empezar la ronda se mira hacia la plaza.
      this.heading = new THREE.Vector2(-player.x, -player.z);
      if (this.heading.lengthSq() < 1e-4) this.heading.set(0, 1);
      this.heading.normalize();
    }
    this.manualHold = Math.max(0, this.manualHold - deltaSeconds);
    const focusId = focus?.id ?? null;
    if (focusId !== this.focusId) {
      this.focusId = focusId;
      this.turning = false;
    }
    this.dueling = focus?.kind === 'duel';
    if (focus?.kind === 'duel') {
      this.faceDuel(player, focus.pos, deltaSeconds);
    } else if (focus?.kind === 'watch' && this.manualHold === 0) {
      this.faceWatched(player, focus.pos, deltaSeconds);
    } else {
      this.turning = false;
    }
    const dir = this.heading;
    this.desiredPosition.set(player.x - dir.x * BACK, HEIGHT, player.z - dir.y * BACK);
    this.desiredLook.set(player.x + dir.x * AHEAD, 1.2, player.z + dir.y * AHEAD);

    this.blendTowards(deltaSeconds, this.dueling ? DUEL_FOLLOW_RATE : FOLLOW_RATE);
    if (shake > 0) {
      const amount = shake * shake * 0.18;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }
  }

  /** Duelo: el rival siempre al frente, sin margen y sin esperar. */
  private faceDuel(player: Vec2, target: Vec2, deltaSeconds: number): void {
    const heading = this.heading;
    if (!heading) return;
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    if (Math.hypot(dx, dz) < DUEL_MIN_DISTANCE) return;
    const offset = wrapAngle(Math.atan2(dz, dx) - Math.atan2(heading.y, heading.x));
    const eased = offset * (1 - Math.exp(-DUEL_RATE * deltaSeconds));
    const limit = DUEL_MAX_SPEED * deltaSeconds;
    heading.rotateAround(ORIGIN, Math.max(-limit, Math.min(limit, eased)));
  }

  /** Mirando a otro mago: se acomoda solo cuando su blanco se aleja del centro. */
  private faceWatched(player: Vec2, target: Vec2, deltaSeconds: number): void {
    const heading = this.heading;
    if (!heading) return;
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 1e-2 || distance >= FACE_TARGET_RANGE) return;
    const offset = wrapAngle(Math.atan2(dz, dx) - Math.atan2(heading.y, heading.x));
    if (Math.abs(offset) > DEADBAND) this.turning = true;
    if (!this.turning) return;
    const step = Math.sign(offset) * Math.min(Math.abs(offset), TURN_SPEED * deltaSeconds);
    heading.rotateAround(ORIGIN, step);
    if (Math.abs(offset - step) < SETTLED) this.turning = false;
  }

  /** Gira la cámara alrededor del mago; por un rato no se acomoda sola. */
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
    this.dueling = false;
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
   * Como `screenToGround`, pero para el joystick de movimiento.
   * - Sin duelo: mientras no se suelte, "arriba" sigue siendo el adelante que había al tocarlo,
   *   aunque la cámara gire.
   * - En duelo: se lee contra la cámara de este cuadro, que siempre mira al rival. Así arriba
   *   te acerca, abajo te aleja y los lados te hacen rodearlo sin que se escape del centro.
   */
  moveToGround(right: number, up: number): Vec2 {
    if (right === 0 && up === 0) {
      this.moveBasis = null;
      return { x: 0, z: 0 };
    }
    if (this.dueling) {
      this.moveBasis = null;
      return this.screenToGround(right, up);
    }
    if (!this.moveBasis) {
      const f = this.forward();
      this.moveBasis = new THREE.Vector2(f.x, f.z);
    }
    const f = { x: this.moveBasis.x, z: this.moveBasis.y };
    const r = { x: -f.z, z: f.x };
    return { x: r.x * right + f.x * up, z: r.z * right + f.z * up };
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
