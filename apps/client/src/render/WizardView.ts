import type { ElementId, GameRules, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, glow } from './palette';

const ORB_COUNT = 3;
const REVIVE_SEGMENTS = 48;

export interface WizardLook {
  /** Color del bando: anillo, ojos y cristal del báculo. */
  readonly teamColor: string;
  readonly isPlayer: boolean;
}

/**
 * Un mago en pantalla: túnica, capucha con ojos que brillan, báculo con cristal,
 * anillo de bando, orbes del tejido y señales de estado. Formas simples y bien iluminadas
 * hasta que lleguen los modelos del Hito 5.
 */
export class WizardView {
  readonly group = new THREE.Group();
  /** Todo lo que se mueve con el cuerpo; el anillo del suelo queda fuera. */
  private readonly body = new THREE.Group();
  private readonly staff = new THREE.Group();
  private readonly robeMaterial: THREE.MeshStandardMaterial;
  private readonly trimMaterial: THREE.MeshStandardMaterial;
  private readonly crystalMaterial: THREE.MeshBasicMaterial;
  private readonly ghostMaterial: THREE.MeshStandardMaterial;
  private readonly solidMeshes: THREE.Mesh[] = [];
  private readonly orbs: THREE.Mesh[] = [];
  private readonly rootRing: THREE.Mesh;
  private readonly curseRing: THREE.Mesh;
  private readonly frost: THREE.Mesh;
  private readonly teamRing: THREE.Mesh;
  private readonly reviveRing: THREE.Mesh;
  private readonly grave: THREE.Mesh;
  private readonly teamColor: THREE.Color;
  private lastHp = -1;
  private flash = 0;
  private lastX = 0;
  private lastZ = 0;
  private stride = 0;
  private ghostly = false;

  constructor(look: WizardLook, rules: GameRules) {
    this.teamColor = new THREE.Color(look.teamColor);
    const radius = rules.wizard.radius;

    this.robeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3530').lerp(this.teamColor, 0.22),
      roughness: 0.85,
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: this.teamColor.clone().multiplyScalar(0.7),
      roughness: 0.5,
      metalness: 0.3,
    });
    this.crystalMaterial = new THREE.MeshBasicMaterial({ color: glow(this.teamColor, 2.2) });
    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: '#9fb4ff',
      emissive: new THREE.Color('#6d7fd6'),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    this.buildBody(radius);
    this.buildStaff();
    this.group.add(this.body);

    this.teamRing = new THREE.Mesh(
      new THREE.RingGeometry(radius + 0.12, radius + 0.26, 40),
      new THREE.MeshBasicMaterial({
        color: glow(this.teamColor, look.isPlayer ? 1.05 : 0.95),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.teamRing.rotation.x = -Math.PI / 2;
    this.teamRing.position.y = 0.03;
    this.group.add(this.teamRing);

    this.reviveRing = new THREE.Mesh(
      new THREE.RingGeometry(
        radius + 0.45,
        radius + 0.65,
        REVIVE_SEGMENTS,
        1,
        Math.PI / 2,
        Math.PI * 2,
      ),
      new THREE.MeshBasicMaterial({
        color: glow(new THREE.Color('#9effc8'), 1.8),
        side: THREE.DoubleSide,
      }),
    );
    this.reviveRing.rotation.x = -Math.PI / 2;
    this.reviveRing.position.y = 0.05;
    this.reviveRing.visible = false;
    this.group.add(this.reviveRing);

    this.grave = new THREE.Mesh(
      new THREE.RingGeometry(0.2, radius + 0.3, 6),
      new THREE.MeshBasicMaterial({
        color: this.teamColor.clone().multiplyScalar(0.5),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.grave.rotation.x = -Math.PI / 2;
    this.grave.position.y = 0.04;
    this.grave.visible = false;
    this.group.add(this.grave);

    this.rootRing = statusRing(radius + 0.45, glow(elementColor('raiz'), 1.6), 0.08);
    this.curseRing = statusRing(radius * 0.7, glow(elementColor('umbra'), 1.8), 2.55);
    this.frost = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 16, 12),
      new THREE.MeshBasicMaterial({
        color: elementColor('marea'),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.frost.scale.set(1, 1.6, 1);
    this.frost.position.y = 1.05;
    this.frost.visible = false;
    this.group.add(this.rootRing, this.curseRing, this.frost);

    const orbGeometry = new THREE.SphereGeometry(0.12, 14, 10);
    for (let i = 0; i < ORB_COUNT; i++) {
      const orb = new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial());
      orb.visible = false;
      this.orbs.push(orb);
      this.body.add(orb);
    }
  }

  /** Coloca al mago y muestra su tejido, que todos pueden leer. */
  update(
    wizard: Wizard,
    x: number,
    z: number,
    timeSeconds: number,
    deltaSeconds: number,
    spectre: boolean,
    rules: GameRules,
  ): void {
    this.group.position.set(x, 0, z);
    const speed = deltaSeconds > 0 ? Math.hypot(x - this.lastX, z - this.lastZ) / deltaSeconds : 0;
    this.lastX = x;
    this.lastZ = z;
    const facing = Math.atan2(wizard.facing.x, wizard.facing.z);
    this.body.rotation.y = facing;

    const alive = wizard.hp > 0;
    const fallen = wizard.fallen;
    this.setGhostly(spectre);
    this.body.visible = alive || spectre;
    this.grave.visible = !alive && !spectre;
    this.teamRing.visible = alive;
    if (this.grave.visible) {
      this.grave.rotation.z = timeSeconds * 0.4;
    }

    // Revivir: el anillo verde se completa a medida que el aliado lo levanta.
    const revive = fallen ? fallen.reviveProgress / rules.death.revive.ticks : 0;
    this.reviveRing.visible = revive > 0;
    if (revive > 0) {
      this.reviveRing.geometry.setDrawRange(0, Math.ceil(revive * REVIVE_SEGMENTS) * 6);
    }

    // Paso: balanceo al caminar y una leve inclinación hacia adelante.
    const moving = Math.min(1, speed / rules.wizard.moveSpeed);
    this.stride += deltaSeconds * (4 + moving * 8);
    const float = spectre ? 0.35 + Math.sin(timeSeconds * 2) * 0.1 : 0;
    this.body.position.y = float + Math.abs(Math.sin(this.stride)) * 0.06 * moving;
    this.body.rotation.x = moving * 0.12;
    this.staff.rotation.z = Math.sin(this.stride) * 0.06 * moving;

    // Al canalizar, el báculo se levanta.
    const channel = wizard.channel;
    const total = rules.weave.castTicksByLength[(channel?.weave.length ?? 1) - 1] ?? 1;
    const progress = channel ? 1 - channel.ticksLeft / total : 0;
    this.staff.rotation.x = channel ? -0.6 * Math.min(1, progress * 3) : 0;

    const weave: readonly ElementId[] = channel ? channel.weave : wizard.weave;
    const first = weave[0];
    this.crystalMaterial.color.copy(
      first ? glow(elementColor(first), 2.6) : glow(this.teamColor, 2),
    );
    const spin = channel ? 10 : 2.6;
    this.orbs.forEach((orb, i) => {
      const element = weave[i];
      orb.visible = element !== undefined && alive;
      if (element === undefined) return;
      (orb.material as THREE.MeshBasicMaterial).color.copy(glow(elementColor(element), 2.4));
      const angle = timeSeconds * spin + (i / Math.max(1, weave.length)) * Math.PI * 2;
      const r = 0.5 - progress * 0.28;
      orb.position.set(
        Math.cos(angle) * r,
        1.35 + Math.sin(angle * 0.5) * 0.06,
        0.5 + Math.sin(angle) * r * 0.6,
      );
      orb.scale.setScalar(1 + progress * 0.9);
    });

    // Golpe recibido: un destello breve en la túnica.
    if (this.lastHp >= 0 && wizard.hp < this.lastHp - 0.9) this.flash = 1;
    this.lastHp = wizard.hp;
    this.flash = Math.max(0, this.flash - deltaSeconds * 6);
    const emissive = this.robeMaterial.emissive;
    emissive.setRGB(this.flash * 0.9, this.flash * 0.8, this.flash * 0.75);
    if (wizard.statuses.burn) {
      emissive.add(
        elementColor('brasa')
          .clone()
          .multiplyScalar(0.1 + 0.06 * Math.sin(timeSeconds * 20)),
      );
    }
    if (wizard.statuses.curse) {
      emissive.add(elementColor('umbra').clone().multiplyScalar(0.06));
    }
    this.frost.visible = wizard.statuses.slow !== undefined && alive;
    this.rootRing.visible = wizard.statuses.root !== undefined && alive;
    this.rootRing.rotation.z = -timeSeconds;
    this.curseRing.visible = wizard.statuses.curse !== undefined && alive;
    this.curseRing.rotation.z = timeSeconds * 2;
  }

  dispose(): void {
    this.group.removeFromParent();
  }

  private buildBody(radius: number): void {
    // Túnica: un perfil girado, ancho abajo y ceñido en la cintura.
    const robeProfile = [
      [0.0, 0.0],
      [radius * 1.25, 0.0],
      [radius * 1.15, 0.25],
      [radius * 0.82, 0.85],
      [radius * 0.78, 1.05],
      [radius * 0.86, 1.3],
      [radius * 0.72, 1.48],
      [radius * 0.3, 1.58],
      [0.0, 1.6],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const robe = new THREE.Mesh(new THREE.LatheGeometry(robeProfile, 18), this.robeMaterial);
    this.addSolid(robe);

    // Faja del color del bando.
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.8, 0.045, 6, 20),
      this.trimMaterial,
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.98;
    this.addSolid(sash);

    // Hombreras.
    const mantle = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
      this.robeMaterial,
    );
    mantle.position.y = 1.32;
    mantle.scale.set(1.1, 0.7, 0.95);
    this.addSolid(mantle);

    // Capucha en punta, un poco echada hacia atrás.
    const hoodProfile = [
      [0.0, 0.0],
      [radius * 0.62, 0.02],
      [radius * 0.66, 0.25],
      [radius * 0.5, 0.48],
      [radius * 0.2, 0.68],
      [0.0, 0.82],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const hood = new THREE.Mesh(new THREE.LatheGeometry(hoodProfile, 16), this.robeMaterial);
    hood.position.set(0, 1.5, -0.04);
    hood.rotation.x = -0.18;
    this.addSolid(hood);

    // Rostro en sombra, con dos ojos que brillan del color del bando.
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.42, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#050407' }),
    );
    face.position.set(0, 1.74, radius * 0.22);
    face.scale.set(1, 1.1, 0.6);
    this.body.add(face);
    const eyeGeometry = new THREE.SphereGeometry(0.035, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.crystalMaterial);
      eye.position.set(side * 0.07, 1.77, radius * 0.45);
      this.body.add(eye);
    }
  }

  private buildStaff(): void {
    const wood = new THREE.MeshStandardMaterial({ color: '#3b2a1d', roughness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2, 6), wood);
    pole.position.y = 1;
    this.staff.add(pole);
    const claw = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.025, 6, 12, Math.PI * 1.5),
      this.trimMaterial,
    );
    claw.position.y = 2.02;
    this.staff.add(claw);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), this.crystalMaterial);
    crystal.position.y = 2.06;
    crystal.scale.set(0.8, 1.4, 0.8);
    this.staff.add(crystal);
    this.staff.position.set(0.48, 0, 0.12);
    for (const child of this.staff.children) {
      if (child instanceof THREE.Mesh && child.material !== this.crystalMaterial) {
        this.solidMeshes.push(child);
        child.castShadow = true;
      }
    }
    this.body.add(this.staff);
  }

  private addSolid(mesh: THREE.Mesh): void {
    mesh.castShadow = true;
    mesh.userData.solidMaterial = mesh.material;
    this.solidMeshes.push(mesh);
    this.body.add(mesh);
  }

  /** El espectro se ve como humo translúcido y sin báculo. */
  private setGhostly(ghostly: boolean): void {
    if (ghostly === this.ghostly) return;
    this.ghostly = ghostly;
    for (const mesh of this.solidMeshes) {
      if (!mesh.userData.solidMaterial) mesh.userData.solidMaterial = mesh.material;
      mesh.material = ghostly
        ? this.ghostMaterial
        : (mesh.userData.solidMaterial as THREE.Material);
      mesh.castShadow = !ghostly;
    }
    this.staff.visible = !ghostly;
  }
}

function statusRing(radius: number, color: THREE.Color, height: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.04, 6, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = height;
  ring.visible = false;
  return ring;
}
