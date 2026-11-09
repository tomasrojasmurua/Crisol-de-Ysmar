import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/** Guía en el suelo que muestra hacia dónde saldrá el conjuro mientras se arrastra. */
export class AimGuide {
  readonly mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.PlaneGeometry(0.35, 5);
    geometry.translate(0, 2.5, 0);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: '#e8e4dc',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.mesh.visible = false;
  }

  update(from: Vec2, direction: Vec2 | null): void {
    this.mesh.visible = direction !== null;
    if (!direction) return;
    this.mesh.position.set(from.x, 0.04, from.z);
    // La geometría apunta hacia -z; se gira para seguir la dirección elegida.
    this.mesh.rotation.y = Math.atan2(-direction.x, -direction.z);
  }
}
