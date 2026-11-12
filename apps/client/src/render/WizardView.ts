import type { ElementId, GameRules, StatusId, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { AffinityLook } from './AffinityLook';
import { CastSigil } from './CastSigil';
import type { Particles } from './Particles';
import { elementColor, glow } from './palette';
import { WeaveHalo } from './WeaveHalo';
import { buildWizardModel } from './wizard/build';
import { FLOATING_FOCI } from './wizard/foci';
import { ModelKit } from './wizard/kit';
import { addCapeWave } from './wizard/rim';

const REVIVE_SEGMENTS = 48;

export interface WizardLook {
  /** Color del bando: anillo, ojos y cristal del báculo. */
  readonly teamColor: string;
  readonly isPlayer: boolean;
  /** Colores del Vestidor, en hexadecimal. */
  readonly robe: string;
  readonly trim: string;
  readonly skin: string;
  /** Ids de las piezas del Vestidor (ver `content/appearance.ts`). */
  readonly face: string;
  readonly outfit: string;
  readonly headwear: string;
  readonly mask: string;
  readonly cape: string;
  readonly focus: string;
  readonly affinity: ElementId | null;
}

/**
 * Un mago en pantalla: túnica, capucha con ojos que brillan, báculo con cristal,
 * anillo de bando, orbes del tejido y señales de estado. Formas simples y bien iluminadas
 * hasta que lleguen los modelos del Hito 5.
 */
/** Cuánto se enciende el contorno del mago con el color de su bando. */
const RIM_STRENGTH = 0.9;

export class WizardView {
  /**
   * Hacia dónde mira la cámara (ángulo en el suelo), para que el tejido sobre la cabeza quede
   * de frente. Lo fija el bucle de dibujo una vez por cuadro.
   */
  static viewYaw = 0;
  readonly group = new THREE.Group();
  /** Todo lo que se mueve con el cuerpo; el anillo del suelo queda fuera. */
  private readonly body = new THREE.Group();
  private readonly staff = new THREE.Group();
  private readonly robeMaterial: THREE.MeshStandardMaterial;
  private readonly crystalMaterial: THREE.MeshBasicMaterial;
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private readonly affinityLook: AffinityLook | null = null;
  private readonly floatingFocus: boolean;
  private readonly ghostMaterial: THREE.MeshStandardMaterial;
  private readonly solidMeshes: THREE.Mesh[];
  private readonly halo = new WeaveHalo();
  private readonly sigil = new CastSigil();
  private readonly rootRing: THREE.Mesh;
  private readonly curseRing: THREE.Mesh;
  private readonly frost: THREE.Mesh;
  /** Ataúd helado: un bloque de hielo alrededor del mago. */
  private readonly iceBlock: THREE.Mesh;
  /** Un anillo por cada estado de la cuarta tanda. */
  private readonly marks: {
    readonly mesh: THREE.Mesh;
    readonly status: StatusId;
    readonly spin: number;
  }[] = [];
  private readonly teamRing: THREE.Mesh;
  private readonly reviveRing: THREE.Mesh;
  private readonly grave: THREE.Mesh;
  private readonly teamColor: THREE.Color;
  private lastHp = -1;
  private flash = 0;
  private lastX = 0;
  private lastZ = 0;
  private stride = 0;
  /** Movimiento de la capa, leído por su sombreado. */
  private readonly capeMotion = { time: { value: 0 }, move: { value: 0 } };
  /** Retroceso al soltar un conjuro: 1 justo al lanzar y se apaga solo. */
  private recoil = 0;
  private wasChanneling = false;
  private ghostly = false;

  constructor(
    look: WizardLook,
    rules: GameRules,
    private readonly particles: Particles | null = null,
  ) {
    this.teamColor = new THREE.Color(look.teamColor);
    const radius = rules.wizard.radius;

    this.crystalMaterial = new THREE.MeshBasicMaterial({ color: glow(this.teamColor, 2.2) });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: glow(this.teamColor, 2.2) });
    this.floatingFocus = FLOATING_FOCI.has(look.focus);
    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: '#9fb4ff',
      emissive: new THREE.Color('#6d7fd6'),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    const kit = new ModelKit(
      this.body,
      this.staff,
      look,
      this.crystalMaterial,
      this.eyeMaterial,
      radius,
    );
    kit.applyRim(this.teamColor, RIM_STRENGTH);
    addCapeWave(kit.cape, this.capeMotion);
    this.robeMaterial = kit.robe;
    const model = buildWizardModel(kit, look);
    this.solidMeshes = kit.merge();
    this.body.add(this.staff);
    this.group.add(this.body);

    if (look.affinity) {
      this.affinityLook = new AffinityLook(look.affinity, {
        body: this.body,
        robe: model.robe,
        robeMaterial: this.robeMaterial,
        eyeMaterial: this.eyeMaterial,
        headY: model.headTop,
        mouthY: model.mouthY,
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

    for (const mark of STATUS_MARKS) {
      const mesh = statusRing(
        radius * mark.size + 0.2,
        glow(new THREE.Color(mark.color), 1.8),
        mark.height,
      );
      this.marks.push({ mesh, status: mark.status, spin: mark.spin });
      this.group.add(mesh);
    }

    this.group.add(this.halo.group, this.sigil.group);
  }

  /** Coloca al mago y muestra su tejido, que todos pueden leer. */
  update(
    wizard: Wizard,
    x: number,
    z: number,
    timeSeconds: number,
    deltaSeconds: number,
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
    // También dentro del Bosque maldito o con la Sombra prestada.
    const st = wizard.statuses;
    this.setGhostly(
      st.veiled !== undefined || st.shrouded !== undefined || st.shadowed !== undefined,
    );
    this.body.visible = alive;
    this.grave.visible = !alive;
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
    this.capeMotion.time.value = timeSeconds;
    // La capa sigue al paso con algo de inercia: no salta de quieta a flameando.
    this.capeMotion.move.value +=
      (moving - this.capeMotion.move.value) * Math.min(1, deltaSeconds * 6);
    this.stride += deltaSeconds * (4 + moving * 8);
    let float = 0;
    // Por los aires: un arco de subida y caída mientras dura el Géiser.
    const airborne = wizard.statuses.airborne;
    if (airborne) {
      const t = 1 - airborne.ticks / rules.statuses.airborne.ticks;
      float += Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 1.6;
    }
    // Raíces profundas: hundido en el suelo hasta las rodillas.
    if (st.deepRooted) float -= 0.35;
    this.body.position.y = float + Math.abs(Math.sin(this.stride)) * 0.06 * moving;
    // Dormido, se inclina hacia adelante; en Surf y como pantera, va casi echado.
    const lean = st.surfing || st.panther ? 0.7 : moving * 0.12;
    this.body.rotation.x = st.asleep ? 0.45 : lean;
    // La pantera es baja y larga.
    if (st.panther) this.body.scale.set(1.15, 0.65, 1.3);
    else this.body.scale.set(1, 1, 1);
    this.staff.rotation.z = Math.sin(this.stride) * 0.06 * moving;
    if (this.floatingFocus) this.staff.position.y = Math.sin(timeSeconds * 2.2) * 0.05;

    // Al canalizar, el báculo se levanta.
    const channel = wizard.channel;
    const total = rules.weave.castTicksByLength[(channel?.weave.length ?? 1) - 1] ?? 1;
    const progress = channel ? 1 - channel.ticksLeft / total : 0;
    // Al soltar el conjuro: el báculo empuja hacia adelante y el cuerpo retrocede apenas.
    if (this.wasChanneling && !channel && alive) this.recoil = 1;
    this.wasChanneling = channel !== null;
    this.recoil = Math.max(0, this.recoil - deltaSeconds * 4);
    const kick = this.recoil * this.recoil;
    this.staff.rotation.x = channel ? -0.6 * Math.min(1, progress * 3) : 0.7 * kick;
    this.body.rotation.x -= 0.18 * kick;

    const weave: readonly ElementId[] = channel ? channel.weave : wizard.weave;
    const first = weave[0];
    this.crystalMaterial.color.copy(
      first ? glow(elementColor(first), 2.6) : glow(this.teamColor, 2),
    );
    this.halo.update(weave, progress, channel !== null, alive, timeSeconds, WizardView.viewYaw);
    const aim =
      channel && (channel.aim.x !== 0 || channel.aim.z !== 0) ? channel.aim : wizard.facing;
    this.sigil.update(
      channel && alive ? channel.weave : null,
      progress,
      aim,
      timeSeconds,
      deltaSeconds,
    );

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
    // Forma de magma: la túnica brilla como roca fundida.
    if (wizard.statuses.magma) {
      emissive.add(
        new THREE.Color('#ff5a1f').multiplyScalar(0.18 + 0.06 * Math.sin(timeSeconds * 6)),
      );
    }
    if (wizard.statuses.panther) {
      emissive.add(elementColor('umbra').clone().multiplyScalar(0.08));
    }
    this.frost.visible =
      (wizard.statuses.slow !== undefined || wizard.statuses.soaked !== undefined) && alive;
    this.rootRing.visible =
      (wizard.statuses.root !== undefined || wizard.statuses.deepRooted !== undefined) && alive;
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
    for (const mark of this.marks) {
      mark.mesh.visible = wizard.statuses[mark.status] !== undefined && alive;
      if (mark.mesh.visible) mark.mesh.rotation.z = timeSeconds * mark.spin;
    }
    // Detenido en el tiempo: la túnica queda pálida, sin color.
    if (wizard.statuses.halted) emissive.add(new THREE.Color('#9aa6c0').multiplyScalar(0.35));

    this.affinityLook?.update(x, z, facing, timeSeconds, deltaSeconds, alive, this.particles);
  }

  dispose(): void {
    this.group.removeFromParent();
  }

  /** Con Velo y demás sigilos, los tuyos te ven como humo translúcido y sin báculo. */
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

/**
 * Los estados de la cuarta tanda: un anillo de su color, a su altura y con su giro, para leerlos
 * de lejos sin carteles. Los de arriba de la cabeza son de control; los de los pies, de zonas.
 */
const STATUS_MARKS: readonly {
  readonly status: StatusId;
  readonly color: string;
  readonly height: number;
  readonly size: number;
  readonly spin: number;
}[] = [
  { status: 'stunned', color: '#ffe066', height: 2.45, size: 0.45, spin: 6 },
  { status: 'halted', color: '#f2f6ff', height: 1.1, size: 1.25, spin: 0 },
  { status: 'untouchable', color: '#d8c8ff', height: 1.0, size: 1.15, spin: 3 },
  { status: 'thorny', color: '#7fd65a', height: 0.5, size: 1.1, spin: -1.5 },
  { status: 'emberSeed', color: '#ff8a3a', height: 1.5, size: 0.35, spin: 2 },
  { status: 'oath', color: '#f0d9a0', height: 1.9, size: 0.7, spin: 0.5 },
  { status: 'rotting', color: '#8a9a3a', height: 0.3, size: 0.9, spin: 1 },
  { status: 'muted', color: '#5a3a7a', height: 2.2, size: 0.5, spin: -2 },
  { status: 'attracting', color: '#e9f6ff', height: 1.2, size: 1.4, spin: 5 },
  { status: 'mirroring', color: '#5fe0ff', height: 1.2, size: 1.3, spin: -3 },
  { status: 'wailing', color: '#4a2a6a', height: 1.2, size: 1.6, spin: 1 },
  { status: 'depth', color: '#2a6aa0', height: 0.15, size: 1.2, spin: 0.8 },
  { status: 'rebirth', color: '#9effc8', height: 0.15, size: 1.3, spin: -0.8 },
  { status: 'vengeful', color: '#c0203a', height: 2.0, size: 0.6, spin: 1.5 },
  { status: 'ashHunger', color: '#ff6a2a', height: 2.0, size: 0.6, spin: -1.5 },
  { status: 'hexed', color: '#b05aff', height: 2.3, size: 0.4, spin: 4 },
  { status: 'forgetful', color: '#9aa0b8', height: 2.3, size: 0.5, spin: -1 },
  { status: 'robbed', color: '#3a1f55', height: 1.6, size: 0.8, spin: 2 },
  { status: 'scalded', color: '#ffd0b0', height: 1.0, size: 1.0, spin: 2 },
  { status: 'grafted', color: '#6fe8a0', height: 0.9, size: 0.95, spin: 1 },
  { status: 'forged', color: '#ffb347', height: 1.3, size: 0.5, spin: 3 },
  { status: 'overcharged', color: '#e9f6ff', height: 1.3, size: 0.55, spin: -4 },
  { status: 'echoing', color: '#ff7a3a', height: 1.4, size: 0.6, spin: 2.5 },
  { status: 'propelled', color: '#ff9a4a', height: 0.2, size: 0.8, spin: 4 },
  { status: 'dewy', color: '#9effc8', height: 1.8, size: 0.6, spin: 1 },
  { status: 'harvesting', color: '#7a5aa0', height: 0.15, size: 1.0, spin: 1 },
  { status: 'steering', color: '#e9f6ff', height: 1.6, size: 0.55, spin: 6 },
  { status: 'primed', color: '#9fd8ff', height: 1.5, size: 0.75, spin: -6 },
  { status: 'grounded', color: '#5f8fc8', height: 0.1, size: 0.8, spin: 0 },
  { status: 'withered', color: '#6b4a2a', height: 0.1, size: 0.85, spin: 0 },
  { status: 'kindled', color: '#ffb060', height: 0.1, size: 0.75, spin: 0 },
];

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
