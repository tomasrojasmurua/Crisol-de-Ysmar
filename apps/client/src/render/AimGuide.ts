import type { Vec2 } from '@crisol/core';
import * as THREE from 'three';

/** Dónde quedará un hechizo de suelo mientras se arrastra ✦: el punto y su tamaño real. */
export interface AimSpot {
  readonly pos: Vec2;
  readonly radius: number;
}

/**
 * La guía de apuntado al arrastrar el botón de lanzar: una franja en la dirección elegida y, en
 * los hechizos que se dejan en el suelo, un círculo del tamaño real de lo que cae.
 */
export class AimGuide {
  readonly mesh: THREE.Group;
  private readonly strip: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly disc: THREE.Mesh;

  constructor() {
    const geometry = new THREE.PlaneGeometry(0.35, 5);
    geometry.translate(0, 2.5, 0);
    geometry.rotateX(-Math.PI / 2);
    this.strip = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: '#e8e4dc',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    // Círculo de radio 1 que se escala al del hechizo: borde de oro y relleno muy tenue.
    const ringGeometry = new THREE.RingGeometry(0.92, 1, 48);
    ringGeometry.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: '#f3dfb0',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        // Se ve aunque un pilar lo tape: tienes que saber dónde va a caer.
        depthTest: false,
      }),
    );
    const discGeometry = new THREE.CircleGeometry(0.92, 48);
    discGeometry.rotateX(-Math.PI / 2);
    this.disc = new THREE.Mesh(
      discGeometry,
      new THREE.MeshBasicMaterial({
        color: '#b49cff',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.ring.renderOrder = 2;
    this.disc.renderOrder = 1;
    this.mesh = new THREE.Group();
    this.mesh.add(this.strip, this.ring, this.disc);
    this.mesh.visible = false;
  }

  update(from: Vec2, direction: Vec2 | null, spot: AimSpot | null = null): void {
    this.mesh.visible = direction !== null || spot !== null;
    this.strip.visible = direction !== null && spot === null;
    this.ring.visible = spot !== null;
    this.disc.visible = spot !== null;
    if (direction) {
      this.strip.position.set(from.x, 0.04, from.z);
      // La geometría apunta hacia -z; se gira para seguir la dirección elegida.
      this.strip.rotation.y = Math.atan2(-direction.x, -direction.z);
    }
    if (spot) {
      for (const mesh of [this.ring, this.disc]) {
        mesh.position.set(spot.pos.x, 0.05, spot.pos.z);
        mesh.scale.setScalar(Math.max(0.6, spot.radius));
      }
    }
  }
}
