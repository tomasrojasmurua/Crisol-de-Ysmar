import type { ElementId, GameRules, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { elementColor } from './palette';

const ORB_COUNT = 3;

/** Un mago en pantalla: cuerpo, anillo de equipo, orbes del tejido y señales de estado. */
export class WizardView {
  readonly group = new THREE.Group();
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly orbs: THREE.Mesh[] = [];
  private readonly rootRing: THREE.Mesh;
  private readonly curseRing: THREE.Mesh;

  constructor(isPlayer: boolean, rules: GameRules) {
    const radius = rules.wizard.radius;
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: isPlayer ? '#5a5650' : '#3a3442',
      roughness: 0.8,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 1.1, 6, 12), this.bodyMaterial);
    body.position.y = radius + 0.55;
    this.group.add(body);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.9, 0.7, 10), this.bodyMaterial);
    hood.position.y = radius * 2 + 1.25;
    this.group.add(hood);

    const teamRing = new THREE.Mesh(
      new THREE.RingGeometry(radius + 0.15, radius + 0.3, 32),
      new THREE.MeshBasicMaterial({ color: isPlayer ? '#d9c9a3' : '#a3454b' }),
    );
    teamRing.rotation.x = -Math.PI / 2;
    teamRing.position.y = 0.02;
    this.group.add(teamRing);

    this.rootRing = statusRing(radius + 0.5, elementColor('raiz'), 0.03);
    this.curseRing = statusRing(radius * 0.8, elementColor('umbra'), 2.6);
    this.group.add(this.rootRing, this.curseRing);

    const orbGeometry = new THREE.SphereGeometry(0.13, 14, 10);
    for (let i = 0; i < ORB_COUNT; i++) {
      const orb = new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial());
      orb.visible = false;
      this.orbs.push(orb);
      this.group.add(orb);
    }
  }

  /** Coloca al mago y muestra su tejido, que todos pueden leer. */
  update(wizard: Wizard, x: number, z: number, timeSeconds: number, rules: GameRules): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.atan2(wizard.facing.x, wizard.facing.z);
    this.group.visible = wizard.hp > 0;

    const weave: readonly ElementId[] = wizard.channel ? wizard.channel.weave : wizard.weave;
    const total = rules.weave.castTicksByLength[weave.length - 1] ?? 1;
    const progress = wizard.channel ? 1 - wizard.channel.ticksLeft / total : 0;
    const spin = wizard.channel ? 9 : 2.5;
    this.orbs.forEach((orb, i) => {
      const element = weave[i];
      orb.visible = element !== undefined;
      if (element === undefined) return;
      (orb.material as THREE.MeshBasicMaterial).color.copy(elementColor(element));
      const angle = timeSeconds * spin + (i / Math.max(1, weave.length)) * Math.PI * 2;
      const r = 0.45 - progress * 0.25;
      orb.position.set(
        Math.cos(angle) * r,
        1.35 + Math.sin(angle * 0.5) * 0.05,
        0.55 + Math.sin(angle) * r,
      );
      orb.scale.setScalar(1 + progress * 0.8);
    });

    const emissive = this.bodyMaterial.emissive;
    emissive.setRGB(0, 0, 0);
    if (wizard.statuses.burn)
      emissive.copy(elementColor('brasa')).multiplyScalar(0.35 + 0.15 * Math.sin(timeSeconds * 20));
    if (wizard.statuses.slow) emissive.copy(elementColor('marea')).multiplyScalar(0.3);
    this.rootRing.visible = wizard.statuses.root !== undefined;
    this.curseRing.visible = wizard.statuses.curse !== undefined;
    this.curseRing.rotation.z = timeSeconds * 2;
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

function statusRing(radius: number, color: THREE.Color, height: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.05, 6, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = height;
  ring.visible = false;
  return ring;
}
