import * as THREE from 'three';
import { glow } from './palette';

/** Lo que marca la marca este cuadro. */
export interface MarkedTarget {
  readonly id: number;
  readonly pos: { readonly x: number; readonly z: number };
  readonly kind: 'wizard' | 'beast';
  readonly guardian?: boolean;
}

const GUARDIAN_SCALE = 2.2;
/** Al entrar en duelo el anillo se cierra sobre el blanco en este tiempo. */
const SNAP_SECONDS = 0.22;

/**
 * Marca del blanco, en el suelo.
 * - Sin duelo: cuatro puntas que giran, bajo a quien irá el disparo automático.
 * - En duelo: un anillo de tres tramos, más brillante, que se cierra sobre el blanco al fijarlo:
 *   se ve en el acto que la cámara quedó en ese personaje.
 */
export class TargetMarker {
  readonly group = new THREE.Group();
  private readonly tips = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private duelId: number | null = null;
  private duelSince = 0;

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
    const ringMaterial = material.clone();
    ringMaterial.color = glow(new THREE.Color(color), 2.2);
    const arcs = [0, 1, 2].map(
      (i) =>
        new THREE.RingGeometry(1.05, 1.2, 24, 1, (i * 2 * Math.PI) / 3, (2 * Math.PI) / 3 - 0.35),
    );
    this.ring = new THREE.Mesh(mergeRings(arcs), ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;

    this.group.add(this.tips, this.ring);
    this.group.visible = false;
  }

  update(target: MarkedTarget | null, timeSeconds: number, duel = false): void {
    this.group.visible = target !== null;
    const dueling = duel && target !== null;
    if (!dueling) this.duelId = null;
    if (!target) return;
    this.group.position.set(target.pos.x, 0.06, target.pos.z);
    this.tips.visible = !dueling;
    this.ring.visible = dueling;
    if (!dueling) {
      this.tips.rotation.z = timeSeconds * 1.5;
      this.tips.scale.setScalar(1 + Math.sin(timeSeconds * 5) * 0.06);
      return;
    }
    if (this.duelId !== target.id) {
      this.duelId = target.id;
      this.duelSince = timeSeconds;
    }
    const size = target.guardian ? GUARDIAN_SCALE : target.kind === 'beast' ? 1.1 : 1;
    // Se cierra desde más grande al fijar.
    const t = Math.min(1, (timeSeconds - this.duelSince) / SNAP_SECONDS);
    const snap = 1 + (1 - t) * (1 - t) * 0.6;
    this.ring.rotation.z = -timeSeconds * 0.8;
    this.ring.scale.setScalar(size * snap);
  }
}

/** Junta los tramos del anillo en una sola geometría (un solo dibujo). */
function mergeRings(parts: THREE.RingGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...(part.getAttribute('position').array as Float32Array));
    const index = part.getIndex();
    if (index) for (const i of index.array) indices.push(i + offset);
    part.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  return merged;
}
