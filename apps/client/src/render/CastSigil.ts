import { SPELL_FAMILIES, type SpellFamily } from '@crisol/content';
import { type ElementId, spellOf, type Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, glow } from './palette';

/** Cuánto tarda en apagarse la silueta después de que el hechizo sale. */
const FADE_SECONDS = 0.5;
const PEAK_OPACITY = 0.85;

/**
 * La silueta de la familia del hechizo que se está lanzando, dibujada en el suelo bajo el mago
 * con el color de su primer elemento: cuña (ataque), anillos (zona), flechas (movimiento),
 * pentágono (invocación) o columna (aura). Se ve desde que empieza a canalizar y se apaga
 * medio segundo después de que sale, así hasta los hechizos rápidos se alcanzan a leer.
 */
export class CastSigil {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private readonly shapes: Record<SpellFamily, THREE.Object3D>;
  private family: SpellFamily | null = null;
  private fade = 0;

  constructor() {
    this.shapes = {
      attack: mesh(GEOMETRIES.attack, this.material, true),
      zone: mesh(GEOMETRIES.zone, this.material, true),
      movement: mesh(GEOMETRIES.movement, this.material, true),
      summon: mesh(GEOMETRIES.summon, this.material, true),
      aura: auraShape(this.material),
    };
    for (const shape of Object.values(this.shapes)) {
      shape.visible = false;
      this.group.add(shape);
    }
    this.group.position.y = 0.06;
  }

  /**
   * `weave` es lo que se canaliza (null si no); `aim` hacia dónde apunta (o hacia donde mira).
   */
  update(
    weave: readonly ElementId[] | null,
    progress: number,
    aim: Vec2,
    timeSeconds: number,
    deltaSeconds: number,
  ): void {
    const spell = weave ? spellOf(weave) : null;
    const first = weave?.[0];
    if (spell && first) {
      const family = SPELL_FAMILIES[spell];
      if (family !== this.family) this.show(family);
      this.fade = 1;
      this.material.color.copy(glow(elementColor(first), 2));
      if (aim.x !== 0 || aim.z !== 0) this.group.rotation.y = Math.atan2(aim.x, aim.z);
      this.material.opacity = PEAK_OPACITY * (0.45 + 0.55 * Math.min(1, progress * 1.5));
    } else if (this.family) {
      this.fade = Math.max(0, this.fade - deltaSeconds / FADE_SECONDS);
      this.material.opacity = PEAK_OPACITY * this.fade;
      if (this.fade <= 0) this.show(null);
    }
    if (this.family === 'zone' || this.family === 'summon') {
      this.shapes[this.family].rotation.z = timeSeconds * 0.8;
    }
    if (this.family === 'aura') {
      this.shapes.aura.rotation.y = timeSeconds * 1.4;
    }
  }

  private show(family: SpellFamily | null): void {
    if (this.family) this.shapes[this.family].visible = false;
    this.family = family;
    if (family) this.shapes[family].visible = true;
  }
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, flat: boolean): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  if (flat) result.rotation.x = -Math.PI / 2;
  return result;
}

/** Columna tenue alrededor del mago y un anillo en el suelo. */
function auraShape(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(GEOMETRIES.auraColumn, material));
  group.add(mesh(GEOMETRIES.auraRing, material, true));
  return group;
}

/** Cuña que sale hacia adelante, con la base abrazando al mago. */
function attackGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, 0.55);
  shape.lineTo(0, 2.3);
  shape.lineTo(0.55, 0.55);
  shape.lineTo(0.3, 0.75);
  shape.lineTo(0, 1.75);
  shape.lineTo(-0.3, 0.75);
  shape.closePath();
  const wedge = new THREE.ShapeGeometry(shape);
  // El plano se acuesta con rotation.x = -π/2: el +Y del dibujo queda hacia +Z (adelante),
  // pero invertido; se voltea para que la punta mire hacia donde apunta el mago.
  wedge.scale(1, -1, 1);
  return merge([wedge, new THREE.RingGeometry(0.62, 0.7, 36)]);
}

function zoneGeometry(): THREE.BufferGeometry {
  return merge([new THREE.RingGeometry(1.0, 1.1, 48), new THREE.RingGeometry(1.5, 1.56, 48)]);
}

/** Tres flechas en fila hacia adelante. */
function movementGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const y = 0.7 + i * 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-0.45, y);
    shape.lineTo(0, y + 0.35);
    shape.lineTo(0.45, y);
    shape.lineTo(0.45, y + 0.14);
    shape.lineTo(0, y + 0.49);
    shape.lineTo(-0.45, y + 0.14);
    shape.closePath();
    const chevron = new THREE.ShapeGeometry(shape);
    chevron.scale(1, -1, 1);
    parts.push(chevron);
  }
  return merge(parts);
}

/** Pentágono con un punto en cada vértice. */
function summonGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.RingGeometry(1.15, 1.25, 5, 1)];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const dot = new THREE.CircleGeometry(0.14, 12);
    dot.translate(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0);
    parts.push(dot);
  }
  return merge(parts);
}

/** Junta geometrías sin índice en una sola (una llamada de dibujo por silueta). */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const part of parts) {
    const geometry = part.index ? part.toNonIndexed() : part;
    const array = geometry.getAttribute('position').array;
    for (const value of array) positions.push(value);
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return merged;
}

const GEOMETRIES = {
  attack: attackGeometry(),
  zone: zoneGeometry(),
  movement: movementGeometry(),
  summon: summonGeometry(),
  auraColumn: new THREE.CylinderGeometry(0.75, 0.75, 2.2, 24, 1, true).translate(0, 1.1, 0),
  auraRing: new THREE.RingGeometry(0.75, 0.85, 36),
};
