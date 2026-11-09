import type { ElementId, GameRules, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { AffinityLook } from './AffinityLook';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';

const ORB_COUNT = 3;
const REVIVE_SEGMENTS = 48;

export interface WizardLook {
  /** Color del bando: anillo, ojos y cristal del báculo. */
  readonly teamColor: string;
  readonly isPlayer: boolean;
  /** Colores del Vestidor, en hexadecimal. */
  readonly robe: string;
  readonly trim: string;
  readonly skin: string;
  /** capucha, sombrero o diadema. */
  readonly headwear: string;
  /** baculo, cetro u orbe. */
  readonly focus: string;
  readonly affinity: ElementId | null;
}

const HEAD_Y = 1.74;

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
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private readonly skinMaterial: THREE.MeshStandardMaterial;
  private robe: THREE.Mesh | null = null;
  private readonly affinityLook: AffinityLook | null = null;
  private readonly floatingFocus: boolean;
  private readonly ghostMaterial: THREE.MeshStandardMaterial;
  private readonly solidMeshes: THREE.Mesh[] = [];
  private readonly orbs: THREE.Mesh[] = [];
  private readonly rootRing: THREE.Mesh;
  private readonly curseRing: THREE.Mesh;
  private readonly frost: THREE.Mesh;
  /** Ataúd helado: un bloque de hielo alrededor del mago. */
  private readonly iceBlock: THREE.Mesh;
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

  constructor(
    look: WizardLook,
    rules: GameRules,
    private readonly particles: Particles | null = null,
  ) {
    this.teamColor = new THREE.Color(look.teamColor);
    const radius = rules.wizard.radius;

    this.robeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.robe),
      roughness: 0.85,
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.trim),
      roughness: 0.45,
      metalness: 0.45,
    });
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.skin),
      roughness: 0.75,
    });
    this.crystalMaterial = new THREE.MeshBasicMaterial({ color: glow(this.teamColor, 2.2) });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: glow(this.teamColor, 2.2) });
    this.floatingFocus = look.focus === 'orbe';
    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: '#9fb4ff',
      emissive: new THREE.Color('#6d7fd6'),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    this.buildBody(radius, look.headwear);
    this.buildFocus(look.focus);
    this.group.add(this.body);

    if (look.affinity && this.robe) {
      this.affinityLook = new AffinityLook(look.affinity, {
        body: this.body,
        robe: this.robe,
        robeMaterial: this.robeMaterial,
        eyeMaterial: this.eyeMaterial,
        headY: look.headwear === 'sombrero' ? 2.02 : 1.9,
        mouthY: HEAD_Y - 0.04,
        radius,
      });
      this.affinityLook.attach(this.group);
    }

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

    this.iceBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.85, 2.3, 6),
      new THREE.MeshStandardMaterial({
        color: '#bfe6ff',
        emissive: new THREE.Color('#2f7dff'),
        emissiveIntensity: 0.45,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.55,
        flatShading: true,
        depthWrite: false,
      }),
    );
    this.iceBlock.position.y = 1.1;
    this.iceBlock.visible = false;
    this.group.add(this.iceBlock);

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
    /** Con Velo y lejos de tu equipo: no se dibuja. */
    hidden = false,
  ): void {
    this.group.visible = !hidden;
    this.group.position.set(x, 0, z);
    const speed = deltaSeconds > 0 ? Math.hypot(x - this.lastX, z - this.lastZ) / deltaSeconds : 0;
    this.lastX = x;
    this.lastZ = z;
    const facing = Math.atan2(wizard.facing.x, wizard.facing.z);
    this.body.rotation.y = facing;

    const alive = wizard.hp > 0;
    const fallen = wizard.fallen;
    // Con Velo, los tuyos te ven como una sombra translúcida.
    this.setGhostly(spectre || wizard.statuses.veiled !== undefined);
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
    let float = spectre ? 0.35 + Math.sin(timeSeconds * 2) * 0.1 : 0;
    // Por los aires: un arco de subida y caída mientras dura el Géiser.
    const airborne = wizard.statuses.airborne;
    if (airborne) {
      const t = 1 - airborne.ticks / rules.statuses.airborne.ticks;
      float += Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 1.6;
    }
    this.body.position.y = float + Math.abs(Math.sin(this.stride)) * 0.06 * moving;
    // Dormido, se inclina hacia adelante.
    this.body.rotation.x = wizard.statuses.asleep ? 0.45 : moving * 0.12;
    this.staff.rotation.z = Math.sin(this.stride) * 0.06 * moving;
    if (this.floatingFocus) this.staff.position.y = Math.sin(timeSeconds * 2.2) * 0.05;

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
    this.frost.visible =
      (wizard.statuses.slow !== undefined || wizard.statuses.soaked !== undefined) && alive;
    this.rootRing.visible = wizard.statuses.root !== undefined && alive;
    this.rootRing.rotation.z = -timeSeconds;
    this.curseRing.visible = wizard.statuses.curse !== undefined && alive;
    this.curseRing.rotation.z = timeSeconds * 2;
    // El Ataúd helado y la Era de hielo dejan al mago dentro de un bloque.
    // Dentro de la Planta carnívora (una quietud que le puso otro) no se ve.
    const stasis = wizard.statuses.stasis;
    const swallowed = stasis !== undefined && stasis.sourceId !== wizard.id;
    if (swallowed) this.body.visible = false;
    this.iceBlock.visible =
      ((stasis !== undefined && !swallowed) || wizard.statuses.frozen !== undefined) && alive;
    this.iceBlock.rotation.y = timeSeconds * 0.3;

    this.affinityLook?.update(
      x,
      z,
      facing,
      timeSeconds,
      deltaSeconds,
      alive && !spectre,
      this.particles,
    );
  }

  dispose(): void {
    this.group.removeFromParent();
  }

  private buildBody(radius: number, headwear: string): void {
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
    this.robe = robe;
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

    if (headwear === 'capucha') this.buildHood(radius);
    else this.buildHead(radius, headwear);
  }

  /** Capucha en punta con el rostro en sombra: solo se ven los ojos. */
  private buildHood(radius: number): void {
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

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.42, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#050407' }),
    );
    face.position.set(0, HEAD_Y, radius * 0.22);
    face.scale.set(1, 1.1, 0.6);
    this.body.add(face);
    this.addEyes(radius * 0.45, 1.77);
  }

  /** Cabeza descubierta con sombrero de ala ancha o con diadema. */
  private buildHead(_radius: number, headwear: string): void {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), this.skinMaterial);
    head.position.set(0, HEAD_Y, 0.03);
    head.scale.set(0.95, 1.1, 1);
    this.addSolid(head);
    this.addEyes(0.18, HEAD_Y + 0.02);

    if (headwear === 'sombrero') {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.46, 0.03, 24),
        this.robeMaterial,
      );
      brim.position.set(0, HEAD_Y + 0.13, 0);
      brim.rotation.x = -0.12;
      this.addSolid(brim);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.62, 16, 1, true),
        this.robeMaterial,
      );
      crown.position.set(0, HEAD_Y + 0.43, -0.06);
      crown.rotation.x = -0.32;
      this.addSolid(crown);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 20), this.trimMaterial);
      band.position.set(0, HEAD_Y + 0.17, -0.01);
      band.rotation.x = Math.PI / 2 - 0.12;
      this.addSolid(band);
    } else {
      // Diadema con una gema que brilla del color del bando, y el pelo recogido.
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
        new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.9 }),
      );
      hair.position.set(0, HEAD_Y + 0.02, -0.01);
      hair.rotation.x = -0.5;
      this.addSolid(hair);
      const circlet = new THREE.Mesh(
        new THREE.TorusGeometry(0.168, 0.016, 6, 24),
        this.trimMaterial,
      );
      circlet.position.set(0, HEAD_Y + 0.08, 0.02);
      circlet.rotation.x = Math.PI / 2 + 0.15;
      this.addSolid(circlet);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), this.crystalMaterial);
      gem.position.set(0, HEAD_Y + 0.1, 0.19);
      gem.scale.set(0.8, 1.3, 0.6);
      this.body.add(gem);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 20), this.trimMaterial);
      collar.position.set(0, 1.55, 0.02);
      collar.rotation.x = Math.PI / 2;
      this.addSolid(collar);
    }
  }

  private addEyes(depth: number, height: number): void {
    const eyeGeometry = new THREE.SphereGeometry(0.035, 8, 6);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.eyeMaterial);
      eye.position.set(side * 0.07, height, depth);
      this.body.add(eye);
    }
  }

  /** Báculo largo, cetro corto u orbe que flota junto a la mano. */
  private buildFocus(focus: string): void {
    const wood = new THREE.MeshStandardMaterial({ color: '#3b2a1d', roughness: 0.7 });
    if (focus === 'cetro') {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 0.75, 6),
        this.trimMaterial,
      );
      rod.position.y = 1.0;
      rod.rotation.x = 0.35;
      this.staff.add(rod);
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 14), this.trimMaterial);
      head.position.set(0, 1.4, 0.13);
      head.rotation.x = 0.35;
      this.staff.add(head);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), this.crystalMaterial);
      crystal.position.set(0, 1.42, 0.14);
      crystal.scale.set(0.8, 1.3, 0.8);
      this.staff.add(crystal);
      this.staff.position.set(0.42, 0, 0.18);
    } else if (focus === 'orbe') {
      const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), this.crystalMaterial);
      crystal.position.y = 1.22;
      this.staff.add(crystal);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 24), this.trimMaterial);
      cage.position.y = 1.22;
      cage.rotation.x = Math.PI / 2.4;
      this.staff.add(cage);
      const cage2 = cage.clone();
      cage2.rotation.set(0, Math.PI / 2, Math.PI / 3);
      this.staff.add(cage2);
      this.staff.position.set(0.46, 0, 0.3);
    } else {
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
    }
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
