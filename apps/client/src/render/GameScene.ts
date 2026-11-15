import { createMatch, type GameRules, type Vec2, type Wizard } from '@crisol/core';
import * as THREE from 'three';
import { CameraRig } from '../camera/CameraRig';
import type { QualityName, SceneLoad } from '../game/MatchPerfLog';
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

/**
 * Tope de nitidez en celulares (pantallas táctiles). A 2 se dibujaban 1,8 veces más píxeles que
 * a 1,5 y el celular se calentaba; en una pantalla de 6 pulgadas la diferencia casi no se ve.
 */
const PHONE_MAX_PIXEL_RATIO = 1.5;

/** Un mundo de hechizos vacío, para limpiar la escena fuera de partida. */
const NO_SPELL_WORLD: SpellWorld = {
  positionOf: () => ({ x: 0, z: 0 }),
  time: 0,
  delta: 0,
  wizard: () => undefined,
  wizardPos: () => undefined,
};

/** Lo que mide el mago del Vestidor con su foco (alto y ancho, en metros) y la altura de su centro. */
const PREVIEW_HEIGHT = 3.0;
const PREVIEW_WIDTH = 1.8;
const PREVIEW_MIDDLE = 1.35;
/** Qué parte de la franja ocupa el mago: el resto queda de aire alrededor. */
const PREVIEW_FILL = 0.86;

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
  readonly resolution = new AdaptiveResolution(
    window.devicePixelRatio,
    window.matchMedia?.('(pointer: coarse)').matches ? PHONE_MAX_PIXEL_RATIO : undefined,
  );
  /** El aspecto de cada mago de la partida, para que su Señuelo se vea igual que él. */
  readonly wizardLooks = new Map<number, WizardLook>();
  /** Una luz suave sobre tu mago: en la jungla siempre se ve dónde estás. */
  private readonly lantern = new THREE.PointLight('#ffe2b0', 0, 11, 1.4);
  // Luz de estudio para el Vestidor: una principal cálida y un contraluz frío.
  private readonly previewKey = new THREE.PointLight('#ffe2bd', 0, 14, 1.4);
  private readonly previewRim = new THREE.PointLight('#9fb6ff', 0, 12, 1.4);
  /** El mago del Vestidor: quieto en el centro de la arena, girando despacio. */
  private preview: { view: WizardView; wizard: Wizard } | null = null;
  /** El último tamaño aplicado al dibujo, en píxeles CSS. */
  private size = { width: 0, height: 0 };

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
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        const { clientWidth, clientHeight } = canvas;
        if (clientWidth === this.size.width && clientHeight === this.size.height) return;
        this.resize();
        // El resto de la interfaz (el Vestidor, las etiquetas) mide al oír "resize": se le
        // avisa, porque Safari pudo haberlo mandado antes de tener las medidas nuevas.
        window.dispatchEvent(new Event('resize'));
      }).observe(canvas);
    }

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
    this.scene.add(this.aimGuide.mesh, this.targetMarker.group, this.lantern);

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

  /** Cuánto hay en pantalla, para el informe de rendimiento. */
  get load(): SceneLoad {
    return { spells: this.spells.count, particles: this.particles.alive };
  }

  get previewing(): boolean {
    return this.preview !== null;
  }

  showPreview(look: WizardLook, rules: GameRules): void {
    this.preview?.view.dispose();
    const state = createMatch(
      { seed: 1, deathRule: 'out', wizards: [{ team: 0, spawn: { x: 0, z: 0 } }] },
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

  /**
   * Cámara del Vestidor: el mago entero (de los pies a la punta del sombrero) centrado en la
   * franja libre a la izquierda del panel. `stageWidth` es esa franja como parte del ancho de la
   * pantalla (0 a 1). La distancia se calcula con la proporción de la pantalla, así el mago no
   * queda cortado ni debajo del panel en ningún celular.
   */
  updatePreview(time: number, delta: number, rules: GameRules, stageWidth: number): void {
    if (!this.preview) return;
    const { view, wizard } = this.preview;
    const angle = Math.PI + Math.sin(time * 0.35) * 0.9;
    wizard.facing = { x: Math.sin(angle), z: Math.cos(angle) };
    view.update(wizard, 0, 0, time, delta, rules);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const aspect = this.camera.aspect;
    const stage = Math.min(Math.max(stageWidth, 0.2), 1);
    // Que quepa a lo alto (con aire arriba y abajo) y a lo ancho de la franja libre.
    const byHeight = PREVIEW_HEIGHT / 2 / (tanHalf * PREVIEW_FILL);
    const byWidth = PREVIEW_WIDTH / 2 / (tanHalf * aspect * stage * PREVIEW_FILL);
    const distance = Math.max(byHeight, byWidth);
    // El centro de la franja, en coordenadas de pantalla (-1 a 1); la derecha de la cámara es -x.
    const center = stage - 1;
    const sideways = center * distance * tanHalf * aspect;
    this.camera.position.set(sideways, PREVIEW_MIDDLE + 0.2, -distance);
    this.camera.lookAt(sideways, PREVIEW_MIDDLE, 0);
  }

  /**
   * Ajusta el dibujo al tamaño con que el lienzo se ve de verdad. Safari en iPhone avisa el
   * cambio de tamaño (al girar, al cerrar el teclado, al volver de otra app) a veces antes de
   * actualizar `innerWidth` e `innerHeight`: con esas medidas viejas el dibujo quedaba con la
   * forma del celular en vertical, estirado y corrido (el mago gigante y la tarjeta del menú
   * vacía). Por eso se mide el lienzo mismo, y un observador lo vuelve a medir cuando cambia.
   */
  resize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    this.size = { width, height };
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
