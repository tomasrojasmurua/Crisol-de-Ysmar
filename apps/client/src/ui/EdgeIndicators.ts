import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { el } from './dom';

/** Cuántas flechas como máximo (más serían ruido). */
const MAX_ARROWS = 6;
/** Cuánto dura el aviso rojo de un golpe desde fuera de pantalla. */
const HIT_SECONDS = 0.9;
/** Dónde se dibujan: casi en el borde, sin pisar la zona segura del celular. */
const EDGE_X = 0.9;
const EDGE_Y = 0.82;

export interface EdgeTarget {
  readonly pos: Vec2;
  readonly color: string;
  /** El blanco del disparo automático: flecha más grande y opaca. */
  readonly strong: boolean;
}

/**
 * Cámara asistida: flechas en el borde de la pantalla hacia los rivales cercanos que no se
 * ven, y un destello rojo en el borde del lado desde donde te golpearon.
 */
export class EdgeIndicators {
  private readonly root: HTMLElement;
  private readonly arrows: HTMLElement[] = [];
  private readonly hits: HTMLElement[] = [];
  private readonly hitLife: number[] = [];
  private readonly hitPos: Vec2[] = [];

  constructor(parent: HTMLElement) {
    this.root = el('div', 'edge-indicators');
    for (let i = 0; i < MAX_ARROWS; i++) {
      const arrow = el('div', 'edge-arrow');
      arrow.hidden = true;
      this.arrows.push(arrow);
      this.root.append(arrow);
    }
    for (let i = 0; i < 3; i++) {
      const hit = el('div', 'edge-hit');
      hit.hidden = true;
      this.hits.push(hit);
      this.hitLife.push(0);
      this.hitPos.push({ x: 0, z: 0 });
      this.root.append(hit);
    }
    parent.append(this.root);
  }

  /** Un golpe desde `from`: si no se ve en pantalla, se avisa en el borde. */
  hit(from: Vec2): void {
    let slot = this.hitLife.indexOf(0);
    if (slot < 0) slot = this.hitLife.indexOf(Math.min(...this.hitLife));
    this.hitLife[slot] = HIT_SECONDS;
    this.hitPos[slot] = from;
  }

  update(camera: THREE.Camera, targets: readonly EdgeTarget[], deltaSeconds: number): void {
    let used = 0;
    for (const target of targets) {
      if (used >= MAX_ARROWS) break;
      const spot = edgeSpot(camera, target.pos, window.innerWidth, window.innerHeight);
      if (!spot) continue;
      const arrow = this.arrows[used++];
      if (!arrow) break;
      arrow.hidden = false;
      arrow.classList.toggle('strong', target.strong);
      arrow.style.setProperty('--color', target.color);
      arrow.style.left = `${spot.x}px`;
      arrow.style.top = `${spot.y}px`;
      arrow.style.rotate = `${spot.angle}rad`;
    }
    for (let i = used; i < this.arrows.length; i++) {
      const arrow = this.arrows[i];
      if (arrow) arrow.hidden = true;
    }

    this.hits.forEach((hit, i) => {
      const life = Math.max(0, (this.hitLife[i] ?? 0) - deltaSeconds);
      this.hitLife[i] = life;
      const pos = this.hitPos[i];
      const spot =
        life > 0 && pos ? edgeSpot(camera, pos, window.innerWidth, window.innerHeight) : null;
      hit.hidden = !spot;
      if (!spot) return;
      hit.style.left = `${spot.x}px`;
      hit.style.top = `${spot.y}px`;
      hit.style.rotate = `${spot.angle}rad`;
      hit.style.opacity = (life / HIT_SECONDS).toFixed(2);
    });
  }

  clear(): void {
    this.hitLife.fill(0);
    for (const node of [...this.arrows, ...this.hits]) node.hidden = true;
  }
}

const projected = new THREE.Vector3();

/** Dónde va la flecha hacia `pos` (en píxeles y con su giro), o null si se ve en pantalla. */
export function edgeSpot(
  camera: THREE.Camera,
  pos: Vec2,
  width: number,
  height: number,
): { x: number; y: number; angle: number } | null {
  const p = projected.set(pos.x, 1, pos.z).project(camera);
  const behind = p.z > 1;
  let x = behind ? -p.x : p.x;
  let y = behind ? -p.y : p.y;
  if (!behind && Math.abs(x) < EDGE_X && Math.abs(y) < EDGE_Y) return null;
  // Justo detrás de la cámara se proyecta cerca del centro: se empuja al borde de abajo.
  if (behind && Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1;
  const scale = Math.max(Math.abs(x) / EDGE_X, Math.abs(y) / EDGE_Y);
  x /= scale;
  y /= scale;
  return {
    x: ((x + 1) / 2) * width,
    y: ((1 - y) / 2) * height,
    // La flecha dibujada apunta hacia arriba; se gira para que apunte hacia afuera.
    angle: Math.atan2(-y, x) + Math.PI / 2,
  };
}
