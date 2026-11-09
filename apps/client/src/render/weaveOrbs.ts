import type { ElementData } from '@crisol/content';
import * as THREE from 'three';

const ORBIT_RADIUS = 1.1;
const ORBIT_HEIGHT = 1.4;

/**
 * Los orbes de los cinco elementos girando alrededor del mago.
 * La magia es lo único con color intenso en la escena.
 */
export class WeaveOrbs {
  readonly group = new THREE.Group();
  private readonly orbs: THREE.Mesh[] = [];

  constructor(elements: readonly ElementData[]) {
    const geometry = new THREE.SphereGeometry(0.14, 16, 12);
    for (const element of elements) {
      const color = new THREE.Color(element.color);
      const orb = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }),
      );
      orb.add(new THREE.PointLight(color, 0.8, 3));
      this.orbs.push(orb);
      this.group.add(orb);
    }
  }

  /** Coloca los orbes según el tiempo de simulación (en segundos). */
  update(timeSeconds: number): void {
    const count = this.orbs.length;
    this.orbs.forEach((orb, index) => {
      const angle = timeSeconds * 0.9 + (index / count) * Math.PI * 2;
      orb.position.set(
        Math.cos(angle) * ORBIT_RADIUS,
        ORBIT_HEIGHT + Math.sin(timeSeconds * 2 + index) * 0.12,
        Math.sin(angle) * ORBIT_RADIUS,
      );
    });
  }
}
