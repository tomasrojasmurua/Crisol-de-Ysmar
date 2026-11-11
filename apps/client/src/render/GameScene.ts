import { createMatch, type GameRules, type Vec2, type Wizard } from '@crisol/core';
import * as THREE from 'three';
import { CameraRig } from '../camera/CameraRig';
import type { QualityName } from '../game/MatchPerfLog';
import { AdaptiveResolution } from './AdaptiveResolution';
import { AimGuide } from './AimGuide';
import { ArenaView } from './arena/ArenaView';
import { MapViews } from './arena/MapViews';
import { ZoneView } from './arena/ZoneView';
import { CreatureViews } from './CreatureViews';
import { EffectsView } from './EffectsView';
import { Particles } from './Particles';
import { PostProcessing } from './postprocessing';
import { SpellViews, type SpellWorld } from './SpellViews';
import { TargetMarker } from './TargetMarker';
import { type WizardLook, WizardView } from './WizardView';

/** Un mundo de hechizos vacío, para limpiar la escena fuera de partida. */
const NO_SPELL_WORLD: SpellWorld = {
  positionOf: () => ({ x: 0, z: 0 }),
  time: 0,
  delta: 0,
  wizard: () => undefined,
  wizardPos: () => undefined,
};

/**
 * Todo lo 3D que no depende de una partida en particular: el renderer, la arena y los mapas,
 * la cámara, el posprocesado, las vistas compartidas (hechizos, bestias, efectos, partículas),
 * la calidad gráfica, la resolución adaptable y el mago del Vestidor.
 */
export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly particles = new Particles();
  readonly arena: ArenaView;
  readonly scene: THREE.Scene;
  readonly zone: ZoneView;
  readonly maps: MapViews;
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  readonly rig: CameraRig;
  readonly post: PostProcessing;
  readonly spells: SpellViews;
  readonly creatures: CreatureViews;
  readonly effects: EffectsView;
  readonly aimGuide = new AimGuide();
  readonly targetMarker = new TargetMarker('#f3dfb0');
  /** Baja la resolución si el celular no alcanza los cuadros por segundo, y la sube si sobra. */
  readonly resolution = new AdaptiveResolution(window.devicePixelRatio);
  /** El aspecto de cada mago de la partida, para que su Señuelo se vea igual que él. */
  readonly wizardLooks = new Map<number, WizardLook>();
  /** Una luz suave sobre tu mago: en la jungla siempre se ve dónde estás. */
  private readonly lantern = new THREE.PointLight('#ffe2b0', 0, 11, 1.4);
  // Luz de estudio para el Vestidor: una principal cálida y un contraluz frío.
  private readonly previewKey = new THREE.PointLight('#ffe2bd', 0, 14, 1.4);
  private readonly previewRim = new THREE.PointLight('#9fb6ff', 0, 12, 1.4);
  /** El mago del Vestidor: quieto en el centro de la arena, girando despacio. */
  private preview: { view: WizardView; wizard: Wizard } | null = null;

  constructor(canvas: HTMLCanvasElement, rules: GameRules, playerId: number) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Las llamadas de dibujo se cuentan por cuadro completo (sombras y resplandor incluidos).
    this.renderer.info.autoReset = false;

    this.arena = new ArenaView(rules.arenaRadius, this.particles);
    this.scene = this.arena.scene;
    this.scene.add(this.particles.points);
    this.zone = new ZoneView(rules.arenaRadius);
    this.scene.add(this.zone.group);
    this.maps = new MapViews(this.scene, this.arena, this.zone, rules);
    this.rig = new CameraRig(this.camera);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.spells = new SpellViews(this.scene, rules, this.particles, (ownerId) => {
      const look = this.wizardLooks.get(ownerId);
      return look ? new WizardView({ ...look, isPlayer: false }, rules, this.particles) : null;
    });
    this.creatures = new CreatureViews(this.scene, rules);
    this.effects = new EffectsView(this.scene, this.particles, playerId);
    this.scene.add(
      this.aimGuide.mesh,
      this.targetMarker.group,
      this.targetMarker.duelFrame,
      this.lantern,
    );

    this.previewKey.position.set(-1.6, 2.8, -2.6);
    this.previewRim.position.set(1.4, 2.4, 1.8);
    // Apagadas del todo fuera del Vestidor: una luz en 0 igual se calcula en cada píxel.
    this.previewKey.visible = false;
    this.previewRim.visible = false;
    this.scene.add(this.previewKey, this.previewRim);
    this.setLantern(false);
    this.resize();
  }

  /** Cambia el mapa que se dibuja (plaza en el 1v1, jungla en los equipos). */
  useRules(rules: GameRules): void {
    this.maps.apply(rules);
  }

  /** Alta: todo el ambiente. Liviana: sin sombras, luces de brasero, resplandor ni estelas. */
  applyQuality(quality: QualityName): void {
    const full = quality === 'alta';
    this.post.enabled = full;
    this.arena.setLight(full);
    this.spells.trailsEnabled = full;
  }

  setLantern(on: boolean): void {
    this.lantern.intensity = on ? 5 : 0;
    this.lantern.visible = on;
  }

  /** Sigue a quien se mira: la linterna, la niebla de la arena y los braseros encendidos. */
  follow(pos: Vec2): void {
    this.arena.focus(pos.x, pos.z);
    this.lantern.position.set(pos.x, 3.2, pos.z);
    this.arena.lightBraziersNear(pos.x, pos.z);
  }

  /** Saca los hechizos, bestias y la marca de objetivo de la escena (al volver al menú). */
  clearMatch(): void {
    this.targetMarker.update(null, 0);
    this.creatures.clear();
    this.spells.sync([], NO_SPELL_WORLD);
  }

  /** Limpia los hechizos (al empezar una partida o ronda). */
  clearSpells(): void {
    this.spells.sync([], NO_SPELL_WORLD);
  }

  get previewing(): boolean {
    return this.preview !== null;
  }

  showPreview(look: WizardLook, rules: GameRules): void {
    this.preview?.view.dispose();
    const state = createMatch(
      { seed: 1, deathRule: 'spectre', wizards: [{ team: 0, spawn: { x: 0, z: 0 } }] },
      rules,
    );
    const wizard = state.wizards[0];
    if (!wizard) return;
    const view = new WizardView(look, rules, this.particles);
    this.scene.add(view.group);
    this.preview = { view, wizard };
    this.previewKey.intensity = 22;
    this.previewRim.intensity = 14;
    this.previewKey.visible = true;
    this.previewRim.visible = true;
  }

  hidePreview(): void {
    this.preview?.view.dispose();
    this.preview = null;
    this.previewKey.intensity = 0;
    this.previewRim.intensity = 0;
    this.previewKey.visible = false;
    this.previewRim.visible = false;
  }

  /** Cámara del Vestidor: el mago a un lado y el panel al otro. */
  updatePreview(time: number, delta: number, rules: GameRules): void {
    if (!this.preview) return;
    const { view, wizard } = this.preview;
    const angle = Math.PI + Math.sin(time * 0.35) * 0.9;
    wizard.facing = { x: Math.sin(angle), z: Math.cos(angle) };
    view.update(wizard, 0, 0, time, delta, false, rules);
    this.camera.position.set(-0.8, 1.65, -3.0);
    this.camera.lookAt(-0.8, 1.25, 0);
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = this.resolution.pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.post.setSize(width, height, pixelRatio);
    this.particles.setViewportHeight(height * pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Lo común de cada cuadro, después de mover la partida: el ambiente, la jungla, los efectos
   * y el dibujo final. `simDelta` es 0 con la partida en pausa (los efectos se congelan).
   */
  render(elapsed: number, delta: number, simDelta: number, player: Vec2 | null): void {
    if (!player) this.maps.jungle.setBurned([]);
    this.arena.update(elapsed, delta);
    this.maps.jungle.update(elapsed, this.camera.position, player);
    this.effects.update(simDelta);
    this.particles.update(simDelta);
    this.post.render();
  }
}
