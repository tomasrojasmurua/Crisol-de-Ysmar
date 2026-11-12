import type { GameRules, MatchState, Vec2, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { canLock, nextLockTarget } from './lockTargets';
import type { PlayerInput } from './PlayerInput';

/**
 * Un toque, no un arrastre: arrastrar el dedo gira la cámara y no debe cambiar de objetivo.
 * Es el mismo margen con que `CameraDrag` empieza a girar, así un toque nunca mueve la cámara.
 */
export const TAP_SLOP_PX = 14;
const TAP_MAX_MS = 350;
/** Qué tan cerca del mago (o la bestia) en pantalla hay que tocar para fijarlo. */
const WIZARD_REACH_PX = 80;
const BEAST_REACH_PX = 70;
const SUMMON_REACH_PX = 60;

/**
 * Entrar en duelo: tocando a un rival, una bestia o una invocación rival en la pantalla, o con el botón de duelo,
 * que pasa de uno a otro. Solo se fija lo que el núcleo acepta (vivo, a la vista y al alcance);
 * si no hay nada, no vibra, para que no parezca que se fijó.
 */
export class TapToLock {
  private readonly taps = new Map<number, { x: number; y: number; at: number }>();
  private readonly projected = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly input: PlayerInput,
    /** La partida en curso, tu mago (como lo ves en este celular) y las reglas, o null fuera de partida. */
    private readonly current: () => { state: MatchState; player: Wizard; rules: GameRules } | null,
    /** Hacia dónde mira la cámara, sobre el suelo. */
    private readonly forward: () => Vec2,
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

  /** Botón de duelo: fija al mejor puesto o pasa al siguiente. */
  cycle(): void {
    const match = this.current();
    if (!match || match.player.hp <= 0) return;
    const next = nextLockTarget(
      match.state,
      match.player,
      match.rules,
      this.forward(),
      match.player.lockTarget,
    );
    if (next === null || next === match.player.lockTarget) return;
    this.input.push({ type: 'lock', targetId: next });
    navigator.vibrate?.(10);
  }

  private lockAt(screenX: number, screenY: number): void {
    const match = this.current();
    if (!match || match.player.hp <= 0) return;
    const { state, player, rules } = match;
    let best: { id: number; distance: number } | null = null;
    const consider = (id: number, x: number, y: number, z: number, reach: number): void => {
      if (!canLock(state, player, rules, id)) return;
      const p = this.projected.set(x, y, z).project(this.camera);
      // Detrás de la cámara la proyección sale invertida: no se puede tocar lo que no se ve.
      if (p.z > 1) return;
      const sx = ((p.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - p.y) / 2) * window.innerHeight;
      const distance = Math.hypot(sx - screenX, sy - screenY);
      if (distance < reach && (!best || distance < best.distance)) best = { id, distance };
    };
    for (const wizard of state.wizards) {
      consider(wizard.id, wizard.pos.x, 1.2, wizard.pos.z, WIZARD_REACH_PX);
    }
    for (const beast of state.beasts) {
      consider(beast.id, beast.pos.x, 0.8, beast.pos.z, BEAST_REACH_PX);
    }
    // Las invocaciones rivales se fijan tocándolas (el botón de duelo no pasa por ellas).
    for (const spell of state.spells) {
      if (spell.kind === 'summon') {
        consider(spell.id, spell.pos.x, 0.6, spell.pos.z, SUMMON_REACH_PX);
      }
    }
    const chosen = best as { id: number; distance: number } | null;
    if (chosen && chosen.id !== player.lockTarget) {
      this.input.push({ type: 'lock', targetId: chosen.id });
      navigator.vibrate?.(10);
    }
  }
}
