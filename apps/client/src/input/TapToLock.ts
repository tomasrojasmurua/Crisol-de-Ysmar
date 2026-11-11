import type { MatchState, Wizard } from '@crisol/core';
import * as THREE from 'three';
import type { PlayerInput } from './PlayerInput';

/** Un toque, no un arrastre: arrastrar el dedo gira la cámara y no debe cambiar de objetivo. */
const TAP_SLOP_PX = 14;
const TAP_MAX_MS = 350;
/** Qué tan cerca del mago (o la bestia) en pantalla hay que tocar para fijarlo. */
const WIZARD_REACH_PX = 80;
const BEAST_REACH_PX = 70;

/** Fijar objetivo tocando a un rival o a una bestia en la pantalla. */
export class TapToLock {
  private readonly taps = new Map<number, { x: number; y: number; at: number }>();
  private readonly projected = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly input: PlayerInput,
    /** La partida en curso y tu mago, o null fuera de partida. */
    private readonly current: () => { state: MatchState; player: Wizard } | null,
  ) {
    canvas.addEventListener('pointerdown', (event) => {
      this.taps.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp });
    });
    canvas.addEventListener('pointercancel', (event) => this.taps.delete(event.pointerId));
    canvas.addEventListener('pointerup', (event) => {
      const start = this.taps.get(event.pointerId);
      this.taps.delete(event.pointerId);
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > TAP_SLOP_PX || event.timeStamp - start.at > TAP_MAX_MS) return;
      this.lockAt(start.x, start.y);
    });
  }

  private lockAt(screenX: number, screenY: number): void {
    const match = this.current();
    if (!match) return;
    let best: { id: number; distance: number } | null = null;
    const consider = (id: number, x: number, y: number, z: number, reach: number): void => {
      const p = this.projected.set(x, y, z).project(this.camera);
      const sx = ((p.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - p.y) / 2) * window.innerHeight;
      const distance = Math.hypot(sx - screenX, sy - screenY);
      if (distance < reach && (!best || distance < best.distance)) best = { id, distance };
    };
    for (const wizard of match.state.wizards) {
      if (wizard.team === match.player.team || wizard.hp <= 0) continue;
      consider(wizard.id, wizard.pos.x, 1.2, wizard.pos.z, WIZARD_REACH_PX);
    }
    for (const beast of match.state.beasts) {
      consider(beast.id, beast.pos.x, 0.8, beast.pos.z, BEAST_REACH_PX);
    }
    const chosen = best as { id: number; distance: number } | null;
    if (chosen) {
      this.input.push({ type: 'lock', targetId: chosen.id });
      navigator.vibrate?.(10);
    }
  }
}
