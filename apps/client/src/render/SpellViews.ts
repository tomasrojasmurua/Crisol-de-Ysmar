import type { GameRules, SpellEntity, Summon, Wizard } from '@crisol/core';
import * as THREE from 'three';
import { createGlowTexture } from './arena/textures';
import { createField, createGuidedBolt, updateField, updateGuidedBolt } from './FourthSpellViews';
import {
  createDrown,
  createFireRain,
  createMangrove,
  createPortal,
  createPyre,
  createStrike,
  createSweeper,
  createThornRing,
  createTrap,
  updateDrown,
  updateFireRain,
  updateMangrove,
  updatePortal,
  updatePyre,
  updateStrike,
  updateSweeper,
  updateThornRing,
  updateTrap,
} from './GreatSpellViews';
import { createGrownTree, updateGrownTree } from './JungleSpellViews';
import type { Particles } from './Particles';
import { elementColor, elementOfForm, formColor, glow } from './palette';
import {
  createRootWall,
  createTether,
  createZone,
  updateRootWall,
  updateTether,
  updateZone,
} from './SpellExtras';
import {
  createAreaZone,
  createCurrent,
  createIceWall,
  createIgnite,
  createObsidian,
  createShackle,
  updateAreaZone,
  updateCurrent,
  updateIceWall,
  updateIgnite,
  updateObsidian,
  updateShackle,
} from './SpellScenery';
import { createSummon, updateSummon } from './SummonViews';
import { createAura, createBubble, updateAura, updateBubble } from './SupportViews';
import { Trails } from './Trails';
import type { WizardView } from './WizardView';

type Position = { x: number; z: number };

/** El Señuelo, el Gemelo sombrío y las copias del Espejismo se dibujan como su mago. */
function isDouble(summon: Summon): boolean {
  return summon.summon === 'decoy' || summon.summon === 'shadowTwin' || summon.summon === 'mirage';
}

/** Lo que las vistas de hechizos necesitan saber del mundo en este cuadro. */
export interface SpellWorld {
  /** Posición interpolada de un proyectil o una invocación. */
  readonly positionOf: (spell: SpellEntity) => Position;
  readonly time: number;
  readonly delta: number;
  readonly wizard: (id: number) => Wizard | undefined;
  /** Posición interpolada de un mago. */
  readonly wizardPos: (id: number) => Position | undefined;
  /** El equipo de quien mira: lo escondido del rival (la Mandrágora) no se dibuja. */
  readonly viewerTeam?: number;
}

/** Arma la vista de un Señuelo: un mago igual a quien lo lanzó. */
export type DecoyFactory = (ownerId: number) => WizardView | null;

/**
 * Dibuja los conjuros que existen en el mundo. Crea una vista al aparecer un conjuro
 * y la quita cuando el núcleo lo elimina; no decide nada del juego.
 */
export class SpellViews {
  private readonly views = new Map<number, THREE.Object3D>();
  private readonly coreGeometry = new THREE.IcosahedronGeometry(1, 2);
  private readonly sparkGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  private readonly glowTexture = createGlowTexture();
  private readonly decoys = new Map<number, WizardView>();
  private readonly trails: Trails;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rules: GameRules,
    private readonly particles: Particles,
    private readonly makeDecoy: DecoyFactory = () => null,
  ) {
    this.trails = new Trails(scene);
  }

  set trailsEnabled(value: boolean) {
    this.trails.enabled = value;
  }

  sync(spells: readonly SpellEntity[], world: SpellWorld): void {
    const alive = new Set<number>();
    for (const spell of spells) {
      alive.add(spell.id);
      let view = this.views.get(spell.id);
      if (!view) {
        view = this.create(spell);
        this.views.set(spell.id, view);
        this.scene.add(view);
      }
      this.update(view, spell, world);
    }
    for (const [id, view] of this.views) {
      if (!alive.has(id)) {
        view.removeFromParent();
        this.views.delete(id);
        this.decoys.get(id)?.dispose();
        this.decoys.delete(id);
      }
    }
    this.trails.update(world.delta);
  }

  private create(spell: SpellEntity): THREE.Object3D {
    switch (spell.kind) {
      case 'projectile':
        return this.createProjectile(spell, formColor(spell.payload.form));
      case 'wall':
        if (spell.passable) return createMangrove(spell);
        return spell.solid ? createRootWall(spell) : createIceWall(spell);
      case 'zone':
        return spell.effect === 'burn'
          ? createZone(spell)
          : createAreaZone(
              spell as typeof spell & { effect: Exclude<typeof spell.effect, 'burn'> },
            );
      case 'current':
        return createCurrent(spell);
      case 'strike':
        return createStrike(spell);
      case 'sweeper':
        return createSweeper(spell);
      case 'pyre':
        return createPyre();
      case 'drown':
        return createDrown();
      case 'fireRain':
        return createFireRain(this.rules.spells.fireRain.radius);
      case 'portal':
        return createPortal(spell);
      case 'thornRing':
        return createThornRing(spell);
      case 'trap':
        return createTrap(spell);
      case 'tempest':
        // Los destellos se dibujan al saltar.
        return new THREE.Group();
      case 'tether':
        return createTether();
      case 'obsidian':
        return createObsidian();
      case 'ignite':
        return createIgnite();
      case 'shackle':
        return createShackle(spell);
      case 'summon':
        return isDouble(spell) ? this.createDecoy(spell) : createSummon(spell);
      case 'thornRush':
        // Los brotes se dibujan como estallidos, a medida que salen.
        return new THREE.Group();
      case 'bubble':
        return createBubble();
      case 'aura':
        return createAura(spell);
      case 'grownTree':
        return createGrownTree(spell);
      case 'field':
        return createField(spell);
      case 'guidedBolt':
        return createGuidedBolt();
      case 'bond':
        return createTether();
      case 'stepper':
      case 'echo':
      case 'deferred':
      case 'boon':
        // Se ven en sus efectos: los saltos, el segundo hechizo, los golpes.
        return new THREE.Group();
    }
  }

  private createDecoy(decoy: Summon): THREE.Object3D {
    const view = this.makeDecoy(decoy.ownerId);
    if (!view) return new THREE.Group();
    this.decoys.set(decoy.id, view);
    return view.group;
  }

  private createProjectile(
    spell: SpellEntity & { kind: 'projectile' },
    baseColor: THREE.Color,
  ): THREE.Object3D {
    let color = baseColor;
    const group = new THREE.Group();
    const size = spell.radius;
    // La Ceguera es una bola de sombra, no de luz.
    if (spell.payload.spell === 'blinding') color = new THREE.Color('#3a1f55');
    // La Llama negra arde en negro y violeta; el Cometa negro, en sombra con borde de fuego.
    if (spell.payload.spell === 'blackFlame') color = new THREE.Color('#5a1f7a');
    if (spell.payload.spell === 'darkComet') color = new THREE.Color('#7a3a2a');
    const core = new THREE.Mesh(
      this.coreGeometry,
      new THREE.MeshBasicMaterial({ color: glow(color, 3) }),
    );
    core.scale.setScalar(size * 0.8);
    group.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: glow(color, 1.5),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    halo.scale.setScalar(size * 6);
    group.add(halo);
    // Cada modificador deja una chispa de su color girando alrededor del proyectil.
    spell.payload.weave.slice(1).forEach((element, i) => {
      const spark = new THREE.Mesh(
        this.sparkGeometry,
        new THREE.MeshBasicMaterial({ color: glow(elementColor(element), 3) }),
      );
      spark.userData.phase = i * Math.PI;
      spark.userData.element = element;
      group.add(spark);
    });
    group.userData.color = color;
    return group;
  }

  private update(view: THREE.Object3D, spell: SpellEntity, world: SpellWorld): void {
    const { time, particles } = { time: world.time, particles: this.particles };
    switch (spell.kind) {
      case 'zone':
        if (spell.effect === 'burn') updateZone(view, spell, time, particles);
        else updateAreaZone(view, spell, time, particles);
        return;
      case 'current':
        updateCurrent(view, spell, time, particles);
        return;
      case 'strike':
        updateStrike(view, spell, time, particles);
        return;
      case 'sweeper':
        updateSweeper(view, spell, world.positionOf(spell), time, world.delta, particles);
        return;
      case 'pyre':
        updatePyre(
          view,
          spell,
          this.rules.spells.soulPyre.delayTicks,
          world.wizardPos(spell.targetId),
          time,
          particles,
        );
        return;
      case 'drown':
        updateDrown(
          view,
          spell,
          world.wizardPos(spell.ownerId),
          world.wizardPos(spell.targetId),
          particles,
        );
        return;
      case 'fireRain':
        updateFireRain(view, spell, world.wizardPos(spell.ownerId), time, particles);
        return;
      case 'portal':
        updatePortal(view, spell, time, particles);
        return;
      case 'thornRing':
        updateThornRing(view, spell, particles);
        return;
      case 'trap':
        updateTrap(view, spell, time);
        return;
      case 'tempest':
        return;
      case 'tether':
        updateTether(
          view,
          world.wizardPos(spell.ownerId),
          world.wizardPos(spell.targetId),
          time,
          particles,
        );
        return;
      case 'thornRush':
        // Nada que mover: cada brote es un estallido.
        return;
      case 'wall':
        if (spell.passable) updateMangrove(view, spell);
        else if (spell.solid) updateRootWall(view, spell);
        else updateIceWall(view, spell, particles);
        return;
      case 'obsidian':
        updateObsidian(
          view,
          world.wizard(spell.ownerId),
          world.wizardPos(spell.ownerId),
          this.rules,
          time,
          particles,
        );
        return;
      case 'ignite':
        updateIgnite(view, spell, world.wizardPos(spell.targetId), time, particles);
        return;
      case 'shackle':
        updateShackle(view, spell, world.wizardPos(spell.targetId), this.rules, time);
        return;
      case 'summon':
        if (isDouble(spell)) this.updateDecoy(spell, world);
        else updateSummon(view, spell, world.positionOf(spell), time, particles);
        return;
      case 'projectile':
        this.updateProjectile(view, spell, world.positionOf(spell), time);
        return;
      case 'bubble':
        updateBubble(
          view,
          spell,
          world.wizard(spell.targetId),
          world.wizardPos(spell.targetId),
          time,
        );
        return;
      case 'aura':
        updateAura(view, spell, world.wizardPos(spell.ownerId), time, particles);
        return;
      case 'grownTree':
        updateGrownTree(view, spell, particles);
        return;
      case 'field':
        updateField(view, spell, time, particles, world.viewerTeam);
        return;
      case 'guidedBolt':
        updateGuidedBolt(view, spell, world.positionOf(spell), time, particles);
        return;
      case 'bond':
        updateTether(view, world.wizardPos(spell.aId), world.wizardPos(spell.bId), time, particles);
        return;
      case 'stepper':
      case 'echo':
      case 'deferred':
      case 'boon':
        return;
    }
  }

  /** El Señuelo y el Gemelo sombrío se dibujan como su dueño, sin estados ni tejido. */
  private updateDecoy(decoy: Summon, world: SpellWorld): void {
    const view = this.decoys.get(decoy.id);
    const owner = world.wizard(decoy.ownerId);
    if (!view || !owner) return;
    const pos = world.positionOf(decoy);
    const double: Wizard = {
      ...owner,
      pos,
      facing: decoy.facing,
      hp: owner.maxHp,
      // El Gemelo sombrío se ve como tu sombra: medio transparente.
      statuses:
        decoy.summon === 'shadowTwin' ? { veiled: { ticks: 1, sourceId: decoy.ownerId } } : {},
      weave: [],
      channel: null,
      leap: null,
      fallen: null,
      // Las copias del Espejismo caminan solo cuando camina su mago.
      moveInput: decoy.summon === 'mirage' ? owner.moveInput : decoy.facing,
    };
    view.update(double, pos.x, pos.z, world.time, world.delta, this.rules);
  }

  private updateProjectile(
    view: THREE.Object3D,
    spell: SpellEntity & { kind: 'projectile' },
    pos: Position,
    timeSeconds: number,
  ): void {
    view.position.set(pos.x, 1.3, pos.z);
    const color = view.userData.color as THREE.Color;
    // Estela de cinta del color del conjuro; la de Tormenta tiembla como un rayo.
    const element = elementOfForm(spell.payload.form);
    this.trails.track(
      spell.id,
      pos.x,
      1.3,
      pos.z,
      glow(color, 1.6),
      Math.max(0.12, spell.radius * 0.75),
      element === 'tormenta',
    );
    // Estela de chispas detrás del proyectil.
    this.particles.emit({
      x: pos.x + (Math.random() - 0.5) * 0.15,
      y: 1.3 + (Math.random() - 0.5) * 0.15,
      z: pos.z + (Math.random() - 0.5) * 0.15,
      vy: 0.3,
      color:
        spell.payload.spell === 'blinding' || spell.payload.spell === 'blackFlame'
          ? glow(color, 2.5)
          : glow(color, 1.4),
      life: 0.35,
      size: 0.45,
    });
    view.children.forEach((child) => {
      const phase = child.userData.phase as number | undefined;
      if (phase === undefined) return;
      const angle = timeSeconds * 18 + phase;
      child.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0);
    });
    view.rotation.y = Math.atan2(spell.velocity.x, spell.velocity.z);
  }
}
