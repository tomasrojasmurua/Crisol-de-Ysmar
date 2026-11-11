import * as THREE from 'three';
import { glow } from './palette';

/** Lo que marca la marca este cuadro. */
export interface MarkedTarget {
  readonly id: number;
  readonly pos: { readonly x: number; readonly z: number };
  readonly kind: 'wizard' | 'beast';
  readonly guardian?: boolean;
}

/** Ancho, alto y centro (en metros) del marco de duelo para cada cosa. */
const FRAME = {
  wizard: { width: 1.5, height: 2.3, center: 1.15 },
  beast: { width: 1.7, height: 1.5, center: 0.75 },
} as const;
const GUARDIAN_SCALE = 2.2;
/** Largo y grosor de cada brazo de las esquinas, en metros. */
const CORNER = 0.38;
const STROKE = 0.07;
/** Al entrar en duelo el marco se cierra sobre el blanco en este tiempo. */
const SNAP_SECONDS = 0.22;
/** Al terminar el duelo (lo soltaste, o el blanco cayó, se escondió o se alejó) el marco se abre y se apaga. */
const RELEASE_SECONDS = 0.35;

/**
 * Marca del blanco.
 * - Sin duelo: cuatro puntas que giran en el suelo, bajo a quien irá el disparo automático.
 * - En duelo: un anillo cerrado en el suelo y cuatro esquinas que encuadran al blanco, siempre
 *   de frente a la cámara y visibles aunque haya árboles en medio. Al fijar, las esquinas se
 *   cierran sobre él: se ve en el acto que la cámara quedó en ese personaje. Al terminar el
 *   duelo se abren y se apagan, para que se note que la cámara quedó libre.
 */
export class TargetMarker {
  readonly group = new THREE.Group();
  private readonly tips = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private readonly frame = new THREE.Group();
  private readonly corners: THREE.Group[] = [];
  private duelId: number | null = null;
  private duelSince = 0;
  private readonly frameMaterial: THREE.MeshBasicMaterial;
  /** Cuándo terminó el último duelo, para la animación de soltar. */
  private releasedAt = -Infinity;
  private released = false;

  constructor(color: string) {
    const material = new THREE.MeshBasicMaterial({
      color: glow(new THREE.Color(color), 1.6),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.95);
    shape.lineTo(0.16, 1.25);
    shape.lineTo(-0.16, 1.25);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    for (let i = 0; i < 4; i++) {
      const tip = new THREE.Mesh(geometry, material);
      tip.rotation.z = (i * Math.PI) / 2;
      this.tips.add(tip);
    }
    this.tips.rotation.x = -Math.PI / 2;

    // Anillo del duelo: tres tramos con huecos, para que se note que gira.
    const duelColor = glow(new THREE.Color(color), 2.2);
    const ringMaterial = material.clone();
    ringMaterial.color = duelColor;
    const ringGeometry = new THREE.BufferGeometry();
    const arcs = [0, 1, 2].map(
      (i) =>
        new THREE.RingGeometry(1.05, 1.2, 24, 1, (i * 2 * Math.PI) / 3, (2 * Math.PI) / 3 - 0.35),
    );
    this.ring = new THREE.Mesh(mergeRings(arcs, ringGeometry), ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;

    // Esquinas del marco: se dibujan encima de todo (sin prueba de profundidad).
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: duelColor,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    this.frameMaterial = frameMaterial;
    const arm = new THREE.PlaneGeometry(CORNER, STROKE);
    for (let i = 0; i < 4; i++) {
      const corner = new THREE.Group();
      const horizontal = new THREE.Mesh(arm, frameMaterial);
      const vertical = new THREE.Mesh(arm, frameMaterial);
      vertical.rotation.z = Math.PI / 2;
      // Cada esquina apunta hacia afuera: los brazos van hacia el centro del marco.
      const sx = i % 2 === 0 ? 1 : -1;
      const sy = i < 2 ? 1 : -1;
      horizontal.position.set((-sx * (CORNER - STROKE)) / 2, 0, 0);
      vertical.position.set(0, (-sy * (CORNER - STROKE)) / 2, 0);
      corner.add(horizontal, vertical);
      corner.userData = { sx, sy };
      corner.renderOrder = 10;
      horizontal.renderOrder = 10;
      vertical.renderOrder = 10;
      this.corners.push(corner);
      this.frame.add(corner);
    }

    this.group.add(this.tips, this.ring);
    this.group.visible = false;
    this.frame.visible = false;
  }

  /** El marco de duelo va aparte: se pone de frente a la cámara, no acostado en el suelo. */
  get duelFrame(): THREE.Object3D {
    return this.frame;
  }

  update(
    target: MarkedTarget | null,
    timeSeconds: number,
    duel = false,
    camera: THREE.Camera | null = null,
  ): void {
    this.group.visible = target !== null;
    const dueling = duel && target !== null && camera !== null;
    if (!dueling && this.duelId !== null) {
      // Terminó el duelo: el marco se queda donde estaba y se abre.
      this.duelId = null;
      this.releasedAt = timeSeconds;
      this.released = true;
    }
    if (!dueling) this.animateRelease(timeSeconds, camera);
    if (!target) return;
    this.group.position.set(target.pos.x, 0.06, target.pos.z);
    this.tips.visible = !dueling;
    this.ring.visible = dueling;
    if (!dueling || !camera) {
      this.tips.rotation.z = timeSeconds * 1.5;
      this.tips.scale.setScalar(1 + Math.sin(timeSeconds * 5) * 0.06);
      return;
    }
    if (this.duelId !== target.id) {
      this.duelId = target.id;
      this.duelSince = timeSeconds;
    }
    this.released = false;
    this.frame.visible = true;
    this.frameMaterial.opacity = 0.95;
    const size = target.guardian ? GUARDIAN_SCALE : 1;
    this.ring.rotation.z = -timeSeconds * 0.8;
    this.ring.scale.setScalar(target.kind === 'beast' ? size * 1.1 : 1);

    const box = FRAME[target.kind];
    // Se cierra desde más grande al fijar; después respira apenas.
    const t = Math.min(1, (timeSeconds - this.duelSince) / SNAP_SECONDS);
    const snap = 1 + (1 - t) * (1 - t) * 0.8;
    const breath = 1 + Math.sin(timeSeconds * 4) * 0.025;
    const halfW = (box.width / 2) * size * snap * breath;
    const halfH = (box.height / 2) * size * snap * breath;
    for (const corner of this.corners) {
      const { sx, sy } = corner.userData as { sx: number; sy: number };
      corner.position.set(sx * halfW, sy * halfH, 0);
    }
    this.frame.position.set(target.pos.x, box.center * size, target.pos.z);
    this.frame.scale.setScalar(1);
    this.frame.quaternion.copy(camera.quaternion);
  }

  private animateRelease(timeSeconds: number, camera: THREE.Camera | null): void {
    const t = (timeSeconds - this.releasedAt) / RELEASE_SECONDS;
    if (!this.released || t >= 1 || t < 0 || !camera) {
      this.released = false;
      this.frame.visible = false;
      return;
    }
    this.frame.visible = true;
    this.frame.scale.setScalar(1 + t * 0.6);
    this.frameMaterial.opacity = 0.95 * (1 - t);
    this.frame.quaternion.copy(camera.quaternion);
  }
}

/** Junta los tramos del anillo en una sola geometría (un solo dibujo). */
function mergeRings(parts: THREE.RingGeometry[], into: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...(part.getAttribute('position').array as Float32Array));
    const index = part.getIndex();
    if (index) for (const i of index.array) indices.push(i + offset);
    part.dispose();
  }
  into.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  into.setIndex(indices);
  return into;
}
