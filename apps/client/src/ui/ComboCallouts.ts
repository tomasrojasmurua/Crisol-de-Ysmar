import { REACTION_TEXT } from '@crisol/content';
import type { ComboId, Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { el } from './dom';

const LIFE_SECONDS = 1.3;
/** Altura del aviso sobre el suelo, por encima del tejido. */
const CALLOUT_Y = 3.1;
/** El color de cada reacción: el del elemento que la provoca. */
const COMBO_COLORS: Readonly<Record<ComboId, string>> = {
  conduction: '#8fd8ff',
  shatter: '#cfe9ff',
  kindling: '#ff8a3d',
  steam: '#e8f4ff',
  ashenCurse: '#b48cff',
  mire: '#9bd27a',
};

interface Callout {
  readonly root: HTMLElement;
  readonly targetId: number;
  age: number;
  /** Cuánto más arriba nace: el nombre de un combo va sobre el de la reacción. */
  readonly lift: number;
}

/**
 * El nombre de la reacción que flota sobre quien la recibe ("¡Conducción!"), para que se aprendan
 * jugando. Sube y se apaga en poco más de un segundo.
 */
export class ComboCallouts {
  private readonly layer: HTMLElement;
  private readonly callouts: Callout[] = [];
  private readonly projected = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.layer = el('div', 'combo-callouts');
    parent.append(this.layer);
  }

  show(combo: ComboId, targetId: number): void {
    this.add(`¡${REACTION_TEXT[combo].name}!`, COMBO_COLORS[combo], targetId, false);
  }

  /**
   * Un combo de hechizos del catálogo: en oro y algo más grande que una reacción, porque es
   * una jugada tuya entera. Si a la vez salió una reacción, queda encima de ella.
   */
  showCombo(name: string, targetId: number): void {
    this.add(`¡${name}!`, '#f3dfb0', targetId, true);
  }

  private add(text: string, color: string, targetId: number, big: boolean): void {
    const root = el('div', big ? 'combo-callout big' : 'combo-callout', text);
    root.style.setProperty('--combo', color);
    this.layer.append(root);
    this.callouts.push({ root, targetId, age: 0, lift: big ? 0.9 : 0 });
  }

  clear(): void {
    for (const callout of this.callouts) callout.root.remove();
    this.callouts.length = 0;
  }

  update(camera: THREE.Camera, positionOf: (id: number) => Vec2 | undefined, delta: number): void {
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const callout = this.callouts[i];
      if (!callout) continue;
      callout.age += delta;
      const pos = positionOf(callout.targetId);
      if (callout.age >= LIFE_SECONDS || !pos) {
        callout.root.remove();
        this.callouts.splice(i, 1);
        continue;
      }
      const t = callout.age / LIFE_SECONDS;
      this.projected.set(pos.x, CALLOUT_Y + callout.lift + t * 0.8, pos.z).project(camera);
      const behind = this.projected.z > 1;
      const x = ((this.projected.x + 1) / 2) * window.innerWidth;
      const y = ((1 - this.projected.y) / 2) * window.innerHeight;
      const scale = t < 0.12 ? 0.6 + (t / 0.12) * 0.5 : 1.1 - Math.min(0.1, (t - 0.12) * 0.3);
      callout.root.style.opacity = behind ? '0' : String(t > 0.7 ? (1 - t) / 0.3 : 1);
      callout.root.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
    }
  }
}
