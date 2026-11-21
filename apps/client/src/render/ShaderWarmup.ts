import {
  CAPES,
  DEFAULT_LOOK,
  FACES,
  FOCI,
  HEADWEAR,
  type LookIds,
  type LookOption,
  MASKS,
  OUTFITS,
} from '@crisol/content';
import {
  createMatch,
  type GameEvent,
  type GameRules,
  type Intent,
  type MatchState,
  SPELL_WEAVES,
  type SpellEntity,
  stepMatch,
  type Weave,
} from '@crisol/core';
import * as THREE from 'three';
import { AimGuide } from './AimGuide';
import { BeastView } from './BeastView';
import { EffectsView } from './EffectsView';
import { Particles } from './Particles';
import { ShrineView } from './ShrineView';
import { SpellViews } from './SpellViews';
import { TargetMarker } from './TargetMarker';
import { type WizardLook, WizardView } from './WizardView';

/** Pasos que se simula cada hechizo de muestra: alcanza para que salga y se abra entero. */
const SAMPLE_TICKS = 75;
/**
 * Lo que se simula en cada tanda, en milisegundos: con el menú a 30 cuadros por segundo no se
 * nota, y aunque el navegador nunca quede libre las muestras están en pocos segundos.
 */
const SLICE_MS = 6;
/** Dónde queda el rival de la muestra: al alcance de casi todo. */
const RIVAL_AT = { x: 0, z: 6 };

/**
 * Compila de antemano los sombreadores de todos los hechizos y sus efectos.
 *
 * three.js compila el sombreador de un material la primera vez que lo dibuja. En un Android de
 * gama media cada uno traba el juego decenas o cientos de milisegundos, y en una partida
 * aparecían unos 20 nuevos (cada hechizo que alguien lanzaba por primera vez): tirones en
 * plena pelea, sobre todo el primer minuto. Aquí se lanza cada uno de los 155 hechizos en una
 * partida de mentira, se arman sus vistas fuera de la escena y se compilan sin bloquear
 * (`compileAsync`, que en los celulares usa la compilación en paralelo del navegador).
 *
 * Todo se hace una sola vez, de a poco mientras se está en el menú. La compilación se repite al
 * empezar cada partida y al cambiar la calidad, porque el sombreador depende de las luces y
 * sombras de la escena (si ya estaba compilado, no cuesta nada). Las vistas de muestra se guardan
 * para siempre: si se liberaran, three.js borraría también sus sombreadores.
 */
export class ShaderWarmup {
  private started = false;
  /** La escena de muestra, nunca dibujada: solo sostiene los materiales. */
  private readonly samples = new THREE.Scene();
  private ready = false;
  private compiling: Promise<void> = Promise.resolve();
  /** Las luces con que se compiló la última vez (ver `GameScene.lightKey`). */
  private compiledFor: string | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly rules: GameRules,
    /** Dónde se dibuja la escena ahora (ver `PostProcessing.sceneTarget`). */
    private readonly target: () => THREE.WebGLRenderTarget | null,
  ) {}

  /**
   * En los ratos libres (en el menú): simula los hechizos de muestra, arma sus vistas y las
   * compila con las luces de `scene`. Se hace una sola vez.
   */
  prepare(scene: THREE.Scene, camera: THREE.Camera, lights: () => string): void {
    if (this.started) return;
    this.started = true;
    const spells: SpellEntity[] = [];
    const events: GameEvent[] = [];
    const weaves = Object.values(SPELL_WEAVES) as Weave[];
    let state: MatchState | null = null;
    let next = 0;
    let nextId = 1;
    const slice = (deadline: Deadline): void => {
      const start = performance.now();
      const budget = Math.max(SLICE_MS, deadline.timeRemaining() - 2);
      do {
        const weave = weaves[next++];
        if (!weave) break;
        state = sampleCast(
          weave,
          this.rules,
          (spell) => {
            // Los ids de cada partida de mentira se repiten: se les da uno propio.
            spells.push({ ...spell, id: nextId++ } as SpellEntity);
          },
          events,
        );
      } while (performance.now() - start < budget);
      if (next < weaves.length) idle(slice);
      else if (state) {
        const last = state;
        idle(() => {
          this.build(spells, events, last);
          this.ready = true;
          void this.compile(scene, camera, lights()).then(() => this.prune());
        });
      }
    };
    idle(slice);
  }

  /**
   * Compila los sombreadores de los hechizos con las luces de `scene` tal como están ahora.
   * Si las muestras todavía no están listas no hace nada (se compilará al lanzar, como antes).
   */
  compile(scene: THREE.Scene, camera: THREE.Camera, lights: string): Promise<void> {
    // Recorrer las muestras cuesta (three.js arma la clave de cada material): solo si cambió algo.
    if (!this.ready || lights === this.compiledFor) return this.compiling;
    this.compiledFor = lights;
    this.compiling = this.compiling
      .then(() => compileFor(this.renderer, this.target(), this.samples, camera, scene))
      .then(
        () => undefined,
        () => undefined,
      );
    return this.compiling;
  }

  /** Arma una vista de cada conjuro y cada efecto en la escena de muestra. */
  private build(spells: readonly SpellEntity[], events: GameEvent[], state: MatchState): void {
    const particles = new Particles();
    this.samples.add(particles.points);
    const views = new SpellViews(this.samples, this.rules, particles);
    const at = (id: number) => state.wizards.find((w) => w.id === id);
    views.sync(spells, {
      positionOf: () => RIVAL_AT,
      time: 1,
      delta: 1 / 30,
      wizard: at,
      wizardPos: (id) => at(id)?.pos,
    });
    const effects = new EffectsView(this.samples, particles, 1);
    effects.onEvents(events, state, () => RIVAL_AT);
    effects.update(1 / 30);
    particles.update(1 / 30);
    this.buildCreatures(state, particles);
    // Todo a la vista de la cámara de compilación (se compila lo visible, no se dibuja nunca).
    // También lo escondido: los anillos de estado, el bloque de hielo o la tumba de un mago se
    // muestran recién cuando pasa algo, y compilarlos ahí era un tirón en plena pelea.
    this.samples.traverse((object) => {
      object.frustumCulled = false;
      object.visible = true;
    });
  }

  /**
   * Magos, bestias y santuarios. Antes se compilaban al empezar cada partida (y la primera vez
   * que alguien quedaba con Velo, congelado o caído): unos cuatro sombreadores en el primer
   * cuadro. Un mago por cada pieza del Vestidor y cada Afinidad, propio y rival, y uno con Velo
   * (su túnica pasa a un material de humo).
   */
  private buildCreatures(state: MatchState, particles: Particles): void {
    const wizard = state.wizards[0];
    if (!wizard) return;
    const veiled = {
      ...wizard,
      statuses: { ...wizard.statuses, veiled: wizard.statuses.veiled ?? { ticks: 30 } },
    } as typeof wizard;
    sampleLooks().forEach((look, i) => {
      const view = new WizardView(look, this.rules, particles);
      view.update(i === 0 ? veiled : wizard, 0, 0, 1, 1 / 30, this.rules);
      this.samples.add(view.group);
    });
    for (const element of ELEMENTS) {
      for (const guardian of [false, true]) {
        const beast = new BeastView(element, guardian);
        this.samples.add(beast.group);
      }
    }
    // La marca del duelo y la guía de puntería, escondidas en el menú.
    this.samples.add(new TargetMarker('#ffffff').group, new AimGuide().mesh);
    const shrine = state.shrines[0];
    if (shrine) {
      const view = new ShrineView(shrine, this.rules);
      view.update(shrine, () => '#ffffff', 1);
      this.samples.add(view.group);
    }
  }

  /**
   * Deja una sola pieza por sombreador: con eso alcanza para recompilarlos todos (al cambiar la
   * calidad o las luces) y la escena de muestra pasa de cientos de piezas a unas decenas.
   */
  private prune(): void {
    const seen = new Set<string>();
    const kept: THREE.Object3D[] = [];
    this.samples.traverse((object) => {
      const material = (object as Partial<THREE.Mesh>).material;
      if (!material) return;
      const keys = (Array.isArray(material) ? material : [material]).map((m) =>
        programKey(this.renderer, m),
      );
      // Sin sombreador: estaba escondida y nunca se compiló; no sirve de muestra.
      if (keys.some((key) => key === null)) return;
      if (keys.every((key) => seen.has(key as string))) return;
      for (const key of keys) seen.add(key as string);
      kept.push(object);
    });
    // Se sacan sin liberar sus materiales: liberarlos borraría el sombreador compartido. Cada
    // pieza que queda pasa a colgar directo de la escena de muestra, sin sus hijas.
    for (const object of kept) object.removeFromParent();
    this.samples.clear();
    for (const object of kept) {
      object.clear();
      this.samples.add(object);
    }
  }
}

/**
 * Compila sin bloquear como si se dibujara en `target`. Sin esto, con calidad Alta se compilaba
 * para la pantalla (sRGB y con tono) pero la escena se dibuja en la textura del resplandor
 * (lineal y sin tono): eran otros sombreadores y cada hechizo nuevo igual compilaba el suyo en
 * plena pelea. three.js arma la clave del sombreador al llamar, así que basta apuntar al
 * destino solo durante la llamada.
 */
export function compileFor(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget | null,
  object: THREE.Object3D,
  camera: THREE.Camera,
  scene?: THREE.Scene,
): Promise<unknown> {
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  try {
    return scene
      ? renderer.compileAsync(object, camera, scene)
      : renderer.compileAsync(object, camera);
  } finally {
    renderer.setRenderTarget(previous);
  }
}

/**
 * Lanza un hechizo en una partida de mentira (un mago y un rival quieto) y avisa cada conjuro
 * nuevo que aparece. Los eventos se juntan, uno de cada tipo y hechizo.
 */
function sampleCast(
  weave: Weave,
  rules: GameRules,
  onSpell: (spell: SpellEntity) => void,
  events: GameEvent[],
): MatchState {
  const state = createMatch(
    {
      seed: 1,
      deathRule: 'out',
      wizards: [
        { team: 0, spawn: { x: 0, z: 0 } },
        { team: 1, spawn: RIVAL_AT },
      ],
    },
    rules,
  );
  const first: Intent[] = [
    ...weave.map((element): Intent => ({ kind: 'weave', element })),
    { kind: 'cast', dirX: 0, dirZ: 1 },
  ];
  const seen = new Set<number>();
  const seenEvents = new Set<string>();
  for (let tick = 0; tick < SAMPLE_TICKS; tick++) {
    stepMatch(state, new Map([[1, tick === 0 ? first : []]]), rules);
    for (const event of state.events) {
      const key = `${event.type}:${'spell' in event ? event.spell : ''}`;
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      events.push(event);
    }
    for (const spell of state.spells) {
      if (seen.has(spell.id)) continue;
      seen.add(spell.id);
      onSpell(spell);
    }
  }
  return state;
}

/** El sombreador que three.js le asignó a un material (null si nunca se compiló). */
function programKey(renderer: THREE.WebGLRenderer, material: THREE.Material): string | null {
  const properties = renderer.properties.get(material) as {
    currentProgram?: { cacheKey?: string };
  };
  return properties.currentProgram?.cacheKey ?? null;
}

const ELEMENTS = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'] as const;

/** Un aspecto por cada pieza del Vestidor y cada Afinidad (los colores no cambian el sombreador). */
function sampleLooks(): WizardLook[] {
  const base = (ids: LookIds, isPlayer: boolean, affinity: WizardLook['affinity']): WizardLook => ({
    ...ids,
    teamColor: '#e8d7a8',
    isPlayer,
    robe: '#5a4a6a',
    trim: '#c8a050',
    skin: '#c89878',
    affinity,
  });
  const looks = [base(DEFAULT_LOOK, true, null), base(DEFAULT_LOOK, false, null)];
  const slots: readonly [keyof LookIds, readonly LookOption[]][] = [
    ['face', FACES],
    ['outfit', OUTFITS],
    ['headwear', HEADWEAR],
    ['mask', MASKS],
    ['cape', CAPES],
    ['focus', FOCI],
  ];
  for (const [slot, options] of slots) {
    for (const option of options) {
      if (option.id !== DEFAULT_LOOK[slot]) {
        looks.push(base({ ...DEFAULT_LOOK, [slot]: option.id }, false, null));
      }
    }
  }
  for (const element of ELEMENTS) looks.push(base(DEFAULT_LOOK, false, element));
  return looks;
}

interface Deadline {
  timeRemaining(): number;
}

/** Corre `task` cuando el navegador esté libre (o pronto, si no sabe avisar, como Safari). */
function idle(task: (deadline: Deadline) => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(task, { timeout: 200 });
    return;
  }
  setTimeout(() => task({ timeRemaining: () => 0 }), 50);
}
