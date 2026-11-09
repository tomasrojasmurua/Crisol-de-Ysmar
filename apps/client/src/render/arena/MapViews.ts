import type { GameRules, MapLayout } from '@crisol/core';
import type * as THREE from 'three';
import type { ArenaView } from './ArenaView';
import { JungleView } from './JungleView';
import type { ZoneView } from './ZoneView';

/**
 * Cambia lo que se dibuja según el mapa de la partida: el 1v1 en la plaza cierra el murete y
 * esconde la jungla; 2v2 en adelante la muestra entera. Cada mapa arma su vista una sola vez.
 */
export class MapViews {
  private readonly views = new Map<MapLayout, JungleView>();
  private current: JungleView;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly arena: ArenaView,
    private readonly zone: ZoneView,
    rules: GameRules,
  ) {
    this.current = this.viewFor(rules.map);
    this.apply(rules);
  }

  /** La jungla (u obstáculos de la plaza) que se está mostrando. */
  get jungle(): JungleView {
    return this.current;
  }

  apply(rules: GameRules): void {
    const next = this.viewFor(rules.map);
    if (next !== this.current) {
      this.current.group.visible = false;
      this.current.setBurned([]);
      this.current = next;
    }
    next.group.visible = true;
    this.arena.setLayout(rules.arenaRadius, rules.map.camps.length > 0);
    this.zone.setArenaRadius(rules.arenaRadius);
  }

  private viewFor(map: MapLayout): JungleView {
    let view = this.views.get(map);
    if (!view) {
      view = new JungleView(map);
      view.group.visible = false;
      this.scene.add(view.group);
      this.views.set(map, view);
    }
    return view;
  }
}
