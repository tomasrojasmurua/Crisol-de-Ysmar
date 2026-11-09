import type { Beast, ElementId } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, glow } from './palette';

/**
 * Una bestia neutral: cuerpo de piedra y sombra con un núcleo que brilla del color de su elemento,
 * y un rasgo propio por elemento (cresta de brasas, alas, caparazón, astas o cola de humo).
 */
export class BeastView {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly skin: THREE.MeshStandardMaterial;
  private readonly wings: THREE.Mesh[] = [];
  private flash = 0;
  private lastHp = -1;
  private stride = 0;
  private lastX = 0;
  private lastZ = 0;

  constructor(readonly element: ElementId) {
    const color = elementColor(element);
    this.skin = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3631').lerp(color, 0.3),
      roughness: 0.8,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: glow(color, 2.4) });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), this.skin);
    torso.scale.set(0.9, 0.7, 1.25);
    torso.position.y = 0.7;
    torso.castShadow = true;
    this.body.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), this.skin);
    head.position.set(0, 0.85, 0.65);
    head.scale.set(1, 0.85, 1.1);
    head.castShadow = true;
    this.body.add(head);

    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, glowMaterial);
      eye.position.set(side * 0.12, 0.92, 0.88);
      this.body.add(eye);
    }

    // El núcleo: una grieta de luz en el lomo.
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glowMaterial);
    core.position.set(0, 1.05, 0);
    core.scale.set(1, 0.6, 1.8);
    this.body.add(core);

    const legGeometry = new THREE.CylinderGeometry(0.07, 0.05, 0.5, 6);
    legGeometry.translate(0, -0.25, 0);
    for (const [x, z] of [
      [-0.3, 0.35],
      [0.3, 0.35],
      [-0.3, -0.35],
      [0.3, -0.35],
    ] as const) {
      const leg = new THREE.Mesh(legGeometry, this.skin);
      leg.position.set(x, 0.5, z);
      leg.castShadow = true;
      this.legs.push(leg);
      this.body.add(leg);
    }

    this.addFeature(element, color, glowMaterial);
    this.group.add(this.body);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.85, 32),
      new THREE.MeshBasicMaterial({
        color: glow(color, 0.8),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);
  }

  update(beast: Beast, timeSeconds: number, deltaSeconds: number): void {
    const x = beast.pos.x;
    const z = beast.pos.z;
    const speed = deltaSeconds > 0 ? Math.hypot(x - this.lastX, z - this.lastZ) / deltaSeconds : 0;
    this.lastX = x;
    this.lastZ = z;
    this.group.position.set(x, 0, z);
    this.body.rotation.y = Math.atan2(beast.facing.x, beast.facing.z);

    const moving = Math.min(1, speed / 3);
    this.stride += deltaSeconds * (3 + moving * 10);
    this.legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(this.stride + (i % 2 === 0 ? 0 : Math.PI)) * 0.6 * moving;
    });
    const hover = this.element === 'tormenta' ? 0.35 + Math.sin(timeSeconds * 3) * 0.1 : 0;
    this.body.position.y = hover + Math.abs(Math.sin(this.stride)) * 0.05 * moving;
    for (const wing of this.wings) {
      wing.rotation.z = (wing.userData.side as number) * (0.4 + Math.sin(timeSeconds * 14) * 0.5);
    }

    if (this.lastHp >= 0 && beast.hp < this.lastHp) this.flash = 1;
    this.lastHp = beast.hp;
    this.flash = Math.max(0, this.flash - deltaSeconds * 6);
    this.skin.emissive.setScalar(this.flash * 0.8);
    // Enojada, la bestia se tiñe de su color.
    if (beast.targetId !== null) {
      this.skin.emissive.add(elementColor(this.element).clone().multiplyScalar(0.18));
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }

  private addFeature(element: ElementId, color: THREE.Color, glowMaterial: THREE.Material): void {
    switch (element) {
      case 'brasa': {
        // Cresta de brasas a lo largo del lomo.
        const spike = new THREE.ConeGeometry(0.07, 0.3, 5);
        for (let i = 0; i < 5; i++) {
          const cone = new THREE.Mesh(spike, glowMaterial);
          cone.position.set(0, 1.0 + Math.sin((i / 4) * Math.PI) * 0.08, 0.45 - i * 0.22);
          cone.rotation.x = -0.4;
          this.body.add(cone);
        }
        return;
      }
      case 'tormenta': {
        // Alas finas que vibran.
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.9, 0.25);
        shape.lineTo(0.75, -0.15);
        shape.closePath();
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
          color: glow(color, 1.2),
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(geometry, material);
          wing.position.set(side * 0.25, 0.95, 0);
          wing.rotation.x = -Math.PI / 2;
          wing.scale.x = side;
          wing.userData.side = side;
          this.wings.push(wing);
          this.body.add(wing);
        }
        return;
      }
      case 'marea': {
        // Caparazón con vetas que brillan.
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({
            color: '#1f2b3a',
            roughness: 0.4,
            metalness: 0.3,
            emissive: color,
            emissiveIntensity: 0.25,
          }),
        );
        shell.position.y = 0.72;
        shell.scale.set(1, 0.8, 1.2);
        shell.castShadow = true;
        this.body.add(shell);
        return;
      }
      case 'raiz': {
        // Astas de madera y musgo.
        const antler = new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5);
        for (const side of [-1, 1]) {
          const main = new THREE.Mesh(antler, this.skin);
          main.position.set(side * 0.15, 1.2, 0.6);
          main.rotation.z = side * -0.5;
          this.body.add(main);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), glowMaterial);
          tip.position.set(side * 0.28, 1.43, 0.6);
          this.body.add(tip);
        }
        const moss = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: '#2f4a26', roughness: 1 }),
        );
        moss.position.set(0, 0.98, -0.15);
        moss.scale.set(1.3, 0.5, 1.4);
        this.body.add(moss);
        return;
      }
      case 'umbra': {
        // Cola larga de humo.
        const tail = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 1.1, 8),
          new THREE.MeshBasicMaterial({
            color: glow(color, 0.8),
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        tail.position.set(0, 0.8, -0.95);
        tail.rotation.x = -Math.PI / 2 - 0.3;
        this.body.add(tail);
        this.skin.transparent = true;
        this.skin.opacity = 0.85;
        return;
      }
    }
  }
}
