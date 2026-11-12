import type { GameRules, MatchState, Vec2 } from '@crisol/core';
import type * as THREE from 'three';
import { BeastView } from './BeastView';
import { ShrineView } from './ShrineView';

/**
 * Bestias y santuarios en pantalla. Crea y quita vistas según lo que hay en el estado,
 * y recuerda dónde estaba cada cosa para los efectos de cuando desaparece.
 */
export class CreatureViews {
  private readonly beasts = new Map<number, BeastView>();
  private readonly shrines = new Map<number, ShrineView>();
  private readonly lastPositions = new Map<number, Vec2>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rules: GameRules,
  ) {}

  /** Dónde estaba por última vez una bestia o un santuario. */
  positionOf(id: number): Vec2 | undefined {
    return this.lastPositions.get(id);
  }

  sync(
    state: MatchState,
    teamColor: (team: number) => string,
    timeSeconds: number,
    deltaSeconds: number,
    /** Dónde está la cámara: las bestias lejanas se dibujan con menos detalle. */
    viewer?: Vec2,
  ): void {
    const alive = new Set<number>();
    for (const beast of state.beasts) {
      alive.add(beast.id);
      let view = this.beasts.get(beast.id);
      if (!view) {
        view = new BeastView(beast.element, beast.guardian);
        this.beasts.set(beast.id, view);
        this.scene.add(view.group);
      }
      view.update(beast, timeSeconds, deltaSeconds, viewer);
      this.lastPositions.set(beast.id, beast.pos);
    }
    for (const shrine of state.shrines) {
      alive.add(shrine.id);
      let view = this.shrines.get(shrine.id);
      if (!view) {
        view = new ShrineView(shrine, this.rules);
        this.shrines.set(shrine.id, view);
        this.scene.add(view.group);
      }
      view.update(shrine, teamColor, timeSeconds);
      this.lastPositions.set(shrine.id, shrine.pos);
    }
    for (const views of [this.beasts, this.shrines] as Map<number, BeastView | ShrineView>[]) {
      for (const [id, view] of views) {
        if (!alive.has(id)) {
          view.dispose();
          views.delete(id);
        }
      }
    }
  }

  clear(): void {
    for (const view of [...this.beasts.values(), ...this.shrines.values()]) view.dispose();
    this.beasts.clear();
    this.shrines.clear();
    this.lastPositions.clear();
  }
}
