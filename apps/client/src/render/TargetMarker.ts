import * as THREE from 'three';
import { glow } from './palette';

/** Marca bajo el rival fijado: cuatro puntas que giran, para saber a quién apuntas. */
export class TargetMarker {
  readonly group = new THREE.Group();

  constructor(color: string) {
    const material = new THREE.MeshBasicMaterial({
      color: glow(new THREE.Color(color), 1.6),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.95);
    shape.lineTo(0.16, 1.25);
    shape.lineTo(-0.16, 1.25);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    for (let i = 0; i < 4; i++) {
      const tip = new THREE.Mesh(geometry, material);
      tip.rotation.z = (i * Math.PI) / 2;
      this.group.add(tip);
    }
    this.group.rotation.x = -Math.PI / 2;
    this.group.visible = false;
  }

  update(position: { x: number; z: number } | null, timeSeconds: number): void {
    this.group.visible = position !== null;
    if (!position) return;
    this.group.position.set(position.x, 0.06, position.z);
    this.group.rotation.z = timeSeconds * 1.5;
    this.group.scale.setScalar(1 + Math.sin(timeSeconds * 5) * 0.06);
  }
}
