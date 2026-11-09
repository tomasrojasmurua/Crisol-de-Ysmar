import type { GameEvent, MatchState } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, formColor } from './palette';

interface Flash {
  readonly mesh: THREE.Mesh;
  age: number;
}

const FLASH_SECONDS = 0.35;

/** Destellos breves para impactos y bloqueos. Un grupo fijo de mallas que se reutilizan. */
export class EffectsView {
  private readonly pool: Flash[] = [];
  private readonly geometry = new THREE.SphereGeometry(1, 12, 8);

  constructor(private readonly scene: THREE.Scene) {}

  onEvents(events: readonly GameEvent[], state: MatchState): void {
    for (const event of events) {
      if (event.type === 'hit') {
        const target = state.wizards.find((w) => w.id === event.targetId);
        // Los daños por segundo (quemadura, maldición) no generan destello.
        if (target && event.amount >= 1)
          this.spawn(target.pos.x, 1.2, target.pos.z, formColor(event.form));
      } else if (event.type === 'blocked') {
        this.spawn(event.pos.x, 1.3, event.pos.z, elementColor('marea'));
      }
    }
  }

  update(deltaSeconds: number): void {
    for (const flash of this.pool) {
      if (!flash.mesh.visible) continue;
      flash.age += deltaSeconds;
      const t = flash.age / FLASH_SECONDS;
      if (t >= 1) {
        flash.mesh.visible = false;
        continue;
      }
      flash.mesh.scale.setScalar(0.3 + t * 1.2);
      (flash.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }

  private spawn(x: number, y: number, z: number, color: THREE.Color): void {
    let flash = this.pool.find((f) => !f.mesh.visible);
    if (!flash) {
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      this.scene.add(mesh);
      flash = { mesh, age: 0 };
      this.pool.push(flash);
    }
    flash.age = 0;
    flash.mesh.visible = true;
    flash.mesh.position.set(x, y, z);
    (flash.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
  }
}
