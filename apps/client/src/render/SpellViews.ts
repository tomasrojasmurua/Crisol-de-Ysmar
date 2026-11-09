import type { GameRules, SpellEntity } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, formColor } from './palette';

/**
 * Dibuja los conjuros que existen en el mundo. Crea una vista al aparecer un conjuro
 * y la quita cuando el núcleo lo elimina; no decide nada del juego.
 */
export class SpellViews {
  private readonly views = new Map<number, THREE.Object3D>();
  private readonly projectileGeometry = new THREE.SphereGeometry(1, 16, 12);
  private readonly sparkGeometry = new THREE.SphereGeometry(0.09, 8, 6);
  private readonly trapGeometry = new THREE.TorusGeometry(1, 0.07, 8, 40);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rules: GameRules,
  ) {}

  /** `positionOf` entrega la posición interpolada de los proyectiles. */
  sync(
    spells: readonly SpellEntity[],
    positionOf: (spell: SpellEntity) => { x: number; z: number },
    timeSeconds: number,
  ): void {
    const alive = new Set<number>();
    for (const spell of spells) {
      alive.add(spell.id);
      let view = this.views.get(spell.id);
      if (!view) {
        view = this.create(spell);
        this.views.set(spell.id, view);
        this.scene.add(view);
      }
      this.update(view, spell, positionOf(spell), timeSeconds);
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        view.removeFromParent();
        this.views.delete(id);
      }
    }
  }

  private create(spell: SpellEntity): THREE.Object3D {
    const color = formColor(spell.payload.form);
    switch (spell.kind) {
      case 'projectile': {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
          this.projectileGeometry,
          new THREE.MeshBasicMaterial({ color }),
        );
        core.scale.setScalar(
          this.rules.forms.projectile.radius * (1 + 0.2 * (spell.payload.weave.length - 1)),
        );
        group.add(core);
        // Cada modificador deja una chispa de su color girando alrededor del proyectil.
        spell.payload.weave.slice(1).forEach((element, i) => {
          const spark = new THREE.Mesh(
            this.sparkGeometry,
            new THREE.MeshBasicMaterial({ color: elementColor(element) }),
          );
          spark.userData.phase = i * Math.PI;
          group.add(spark);
        });
        return group;
      }
      case 'wall': {
        const length = this.rules.forms.wall.halfLength * 2;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(length, 2.2, 0.4),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.55,
          }),
        );
        wall.position.set(spell.center.x, 1.1, spell.center.z);
        wall.rotation.y = -Math.atan2(spell.along.z, spell.along.x);
        return wall;
      }
      case 'trap': {
        const ring = new THREE.Mesh(
          this.trapGeometry,
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.scale.setScalar(this.rules.forms.trap.triggerRadius);
        ring.position.set(spell.pos.x, 0.05, spell.pos.z);
        return ring;
      }
    }
  }

  private update(
    view: THREE.Object3D,
    spell: SpellEntity,
    pos: { x: number; z: number },
    timeSeconds: number,
  ): void {
    if (spell.kind === 'projectile') {
      view.position.set(pos.x, 1.3, pos.z);
      view.children.forEach((child) => {
        const phase = child.userData.phase as number | undefined;
        if (phase === undefined) return;
        const angle = timeSeconds * 18 + phase;
        child.position.set(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0);
      });
      view.rotation.y = Math.atan2(spell.velocity.x, spell.velocity.z);
    } else if (spell.kind === 'trap') {
      const material = (view as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = spell.armTicks > 0 ? 0.25 : 0.6 + 0.3 * Math.sin(timeSeconds * 6);
    } else {
      const material = (view as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.opacity = Math.min(0.55, spell.ticksLeft / 20);
    }
  }
}
