import {
  BEAST_NAMES,
  ELEMENTS,
  GAME_RULES,
  GUARDIAN_NAME,
  ROBE_COLORS,
  rulesForMode,
  SKIN_TONES,
  spellName,
  TRIM_COLORS,
  WIZARD_NAMES,
} from '@crisol/content';
import {
  type Beast,
  createMatch,
  currentTarget,
  ELEMENT_IDS,
  type ElementId,
  FixedStepClock,
  type GameEvent,
  type GameRules,
  isSpectre,
  SeededRng,
  TICK_MS,
  type Wizard,
} from '@crisol/core';
import * as THREE from 'three';
import { CameraRig } from './camera/CameraRig';
import { Grimoire } from './game/Grimoire';
import { LocalMatch, type MatchOptions, PLAYER_ID } from './game/LocalMatch';
import {
  type Appearance,
  loadProfile,
  lookColor,
  type Profile,
  randomAppearance,
  saveProfile,
} from './game/Profile';
import { blindedFrom, veiledFromTeam, visibleEnemies } from './game/Sight';
import { blockBrowserGestures } from './input/blockBrowserGestures';
import { CameraDrag } from './input/CameraDrag';
import { HumanController } from './input/HumanController';
import { PlayerInput } from './input/PlayerInput';
import { TouchControls } from './input/TouchControls';
import { AimGuide } from './render/AimGuide';
import { ArenaView } from './render/arena/ArenaView';
import { MapViews } from './render/arena/MapViews';
import { ZoneView } from './render/arena/ZoneView';
import { CreatureViews } from './render/CreatureViews';
import { EffectsView } from './render/EffectsView';
import { Particles } from './render/Particles';
import { teamColorHex } from './render/palette';
import { PostProcessing } from './render/postprocessing';
import { SpellViews, type SpellWorld } from './render/SpellViews';
import { TargetMarker } from './render/TargetMarker';
import { type WizardLook, WizardView } from './render/WizardView';
import { BlindVeil } from './ui/BlindVeil';
import { GlyphPicker } from './ui/GlyphPicker';
import { GrimoireBook, weaveOrbs } from './ui/GrimoireBook';
import { Hud, type WizardBadge } from './ui/Hud';
import { Menu } from './ui/Menu';
import { Minimap } from './ui/Minimap';
import { Wardrobe } from './ui/Wardrobe';
import { WorldLabels } from './ui/WorldLabels';

/** Las reglas de la partida en curso: cambian de mapa entre el 1v1 (plaza) y los equipos (jungla). */
let rules: GameRules = GAME_RULES;
blockBrowserGestures();
const canvas = document.querySelector<HTMLCanvasElement>('#game');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) {
  throw new Error('Faltan el canvas o la capa de interfaz');
}

// ---------- Escena ----------

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const particles = new Particles();
const arena = new ArenaView(rules.arenaRadius, particles);
const scene = arena.scene;
scene.add(particles.points);
const zone = new ZoneView(rules.arenaRadius);
scene.add(zone.group);
const maps = new MapViews(scene, arena, zone, rules);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
const rig = new CameraRig(camera);
const post = new PostProcessing(renderer, scene, camera);
/** El aspecto de cada mago de la partida, para que su Señuelo se vea igual que él. */
const wizardLooks = new Map<number, WizardLook>();
const spells = new SpellViews(scene, rules, particles, (ownerId) => {
  const look = wizardLooks.get(ownerId);
  return look ? new WizardView({ ...look, isPlayer: false }, rules, particles) : null;
});
const NO_SPELL_WORLD: SpellWorld = {
  positionOf: () => ({ x: 0, z: 0 }),
  time: 0,
  delta: 0,
  wizard: () => undefined,
  wizardPos: () => undefined,
};
const creatures = new CreatureViews(scene, rules);
const effects = new EffectsView(scene, particles, PLAYER_ID);
const aimGuide = new AimGuide();
scene.add(aimGuide.mesh);
const targetMarker = new TargetMarker('#f3dfb0');
scene.add(targetMarker.group);
// Una luz suave sobre tu mago: en la jungla siempre se ve dónde estás.
const lantern = new THREE.PointLight('#ffe2b0', 0, 11, 1.4);
scene.add(lantern);

// ---------- Interfaz ----------

const input = new PlayerInput();
const human = new HumanController(
  input,
  (screen) => rig.screenToGround(screen.right, screen.up),
  rules,
);
const labels = new WorldLabels(uiRoot);
const controls = new TouchControls(uiRoot, input);
const minimap = new Minimap(uiRoot, rules);
const blindVeil = new BlindVeil(uiRoot);
const cameraDrag = new CameraDrag(canvas, (radians) => rig.rotate(radians));
const hud = new Hud(
  uiRoot,
  () => startMatch(match?.options ?? menu.options),
  () => showMenu(),
);
let profile = loadProfile();
const grimoire = new Grimoire();
const menu = new Menu(
  uiRoot,
  (options) => startMatch(options),
  () => openWardrobe(),
  () => openGrimoire(),
);
const wardrobe = new Wardrobe(
  uiRoot,
  (draft) => showPreview(draft),
  (done) => {
    profile = done;
    saveProfile(profile);
    closeOverlays();
  },
  profile,
);
const grimoireBook = new GrimoireBook(uiRoot, () => closeOverlays());
const glyphPicker = new GlyphPicker(uiRoot, (glyph) => match?.chooseGlyph(glyph));

const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
let match: LocalMatch | null = null;
const wizardViews = new Map<number, WizardView>();
let badges = new Map<number, WizardBadge>();
let shownRound = 0;
let resultShown = false;
let pickerShown = false;

const elementColorHex = (element: string): string =>
  ELEMENTS.find((e) => e.id === element)?.color ?? '#ffffff';
const elementName = (element: string): string =>
  ELEMENTS.find((e) => e.id === element)?.name ?? element;
const beastName = (beast: Beast): string =>
  beast.guardian
    ? GUARDIAN_NAME
    : (BEAST_NAMES[beast.element as keyof typeof BEAST_NAMES] ?? 'Bestia');

/** El aspecto de un mago en pantalla: sus piezas, su Afinidad y el color de su bando. */
function lookOf(
  look: Appearance,
  affinity: ElementId | null,
  teamColor: string,
  isPlayer: boolean,
): WizardLook {
  return {
    teamColor,
    isPlayer,
    robe: lookColor(ROBE_COLORS, look.robe),
    trim: lookColor(TRIM_COLORS, look.trim),
    skin: lookColor(SKIN_TONES, look.skin),
    headwear: look.headwear,
    focus: look.focus,
    affinity,
  };
}

// ---------- Vestidor y Grimorio ----------

/** El mago del Vestidor: un mago quieto en el centro de la arena que gira despacio. */
let preview: { view: WizardView; wizard: Wizard } | null = null;
// Luz de estudio para el Vestidor: una principal cálida y un contraluz frío.
const previewKey = new THREE.PointLight('#ffe2bd', 0, 14, 1.4);
const previewRim = new THREE.PointLight('#9fb6ff', 0, 12, 1.4);
previewKey.position.set(-1.6, 2.8, -2.6);
previewRim.position.set(1.4, 2.4, 1.8);
scene.add(previewKey, previewRim);

function showPreview(draft: Profile): void {
  preview?.view.dispose();
  const state = createMatch(
    { seed: 1, deathRule: 'spectre', wizards: [{ team: 0, spawn: { x: 0, z: 0 } }] },
    rules,
  );
  const wizard = state.wizards[0];
  if (!wizard) return;
  const view = new WizardView(
    lookOf(draft.look, draft.affinity, '#e8d7a8', true),
    rules,
    particles,
  );
  scene.add(view.group);
  preview = { view, wizard };
  previewKey.intensity = 22;
  previewRim.intensity = 14;
}

function hidePreview(): void {
  preview?.view.dispose();
  preview = null;
  previewKey.intensity = 0;
  previewRim.intensity = 0;
}

function openWardrobe(): void {
  menu.visible = false;
  wardrobe.show(profile);
  showPreview(profile);
}

function openGrimoire(): void {
  menu.visible = false;
  grimoireBook.show(grimoire);
}

function closeOverlays(): void {
  wardrobe.hide();
  grimoireBook.hide();
  hidePreview();
  menu.setIdentity(profile, grimoire.count, grimoire.total);
  menu.visible = true;
}

/** Cámara del Vestidor: el mago a un lado y el panel al otro. */
function previewCamera(time: number, delta: number): void {
  if (!preview) return;
  const { view, wizard } = preview;
  const angle = Math.PI + Math.sin(time * 0.35) * 0.9;
  wizard.facing = { x: Math.sin(angle), z: Math.cos(angle) };
  view.update(wizard, 0, 0, time, delta, false, rules);
  const portrait = window.innerWidth < window.innerHeight;
  if (portrait) {
    camera.position.set(0, 1.7, -7.2);
    camera.lookAt(0, -1.3, 0);
  } else {
    camera.position.set(-1.1, 1.55, -3.9);
    camera.lookAt(-1.1, 1.05, 0);
  }
}

/** Color del bando de un equipo, a partir de cualquiera de sus magos. */
function teamColor(team: number): string {
  const member = match?.state.wizards.find((w) => w.team === team);
  return (member && badges.get(member.id)?.color) ?? '#ffffff';
}

/** Cambia el mapa que se dibuja y el que usan el minimapa y la vista. */
function useRules(next: GameRules): void {
  rules = next;
  maps.apply(next);
  minimap.setRules(next);
}

function showMenu(): void {
  match = null;
  useRules(GAME_RULES);
  targetMarker.update(null, 0);
  creatures.clear();
  glyphPicker.hide();
  clearWizards();
  spells.sync([], NO_SPELL_WORLD);
  menu.visible = true;
  hud.visible = false;
  labels.visible = false;
  controls.visible = false;
  minimap.show(false);
  blindVeil.reset();
  cameraDrag.enabled = false;
  lantern.intensity = 0;
  hud.hideResult();
  wardrobe.hide();
  grimoireBook.hide();
  hidePreview();
  menu.setIdentity(profile, grimoire.count, grimoire.total);
}

function startMatch(options: MatchOptions): void {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  useRules(rulesForMode(options.mode));
  const current = new LocalMatch(options, rules, human, seed);
  match = current;
  const ffa = options.mode.kind === 'ffa';
  const player = current.player;

  // Nombres de los rivales y aliados, sin repetir, elegidos con la semilla.
  const rng = new SeededRng(seed);
  const names = [...WIZARD_NAMES];
  badges = new Map();
  for (const wizard of current.state.wizards) {
    const isPlayer = wizard.id === PLAYER_ID;
    const name = isPlayer
      ? profile.name || 'Tú'
      : (names.splice(rng.int(0, names.length - 1), 1)[0] ?? 'Hechicero');
    badges.set(wizard.id, { name, color: teamColorHex(wizard.team, player.team, isPlayer, ffa) });
  }

  clearWizards();
  wizardLooks.clear();
  for (const wizard of current.state.wizards) {
    const isPlayer = wizard.id === PLAYER_ID;
    const look = lookOf(
      isPlayer ? profile.look : randomAppearance(rng),
      current.affinities.get(wizard.id) ?? null,
      badges.get(wizard.id)?.color ?? '#ffffff',
      isPlayer,
    );
    wizardLooks.set(wizard.id, look);
    const view = new WizardView(look, rules, particles);
    scene.add(view.group);
    wizardViews.set(wizard.id, view);
  }
  spells.sync([], NO_SPELL_WORLD);
  labels.reset(badges, PLAYER_ID);
  menu.visible = false;
  hud.visible = true;
  hud.hideResult();
  labels.visible = true;
  controls.visible = true;
  minimap.show(true);
  cameraDrag.enabled = true;
  lantern.intensity = 5;
  minimap.reset();
  shownRound = 0;
  resultShown = false;
  pickerShown = false;
  hud.setOmen(current.omen.name, current.omen.description);
  hud.setPlayerName(profile.name);
  rig.snap();
}

function clearWizards(): void {
  for (const view of wizardViews.values()) view.dispose();
  wizardViews.clear();
}

/** Avisos de la partida según lo que pasó en el paso. */
function announceEvents(events: readonly GameEvent[], current: LocalMatch): void {
  for (const event of events) {
    if (event.type === 'cast' && event.wizardId === PLAYER_ID) {
      if (grimoire.discover(event.weave)) {
        hud.celebrateDiscovery(
          spellName(event.weave),
          weaveOrbs(event.weave),
          grimoire.count,
          grimoire.total,
        );
      }
    } else if (event.type === 'phase') {
      hud.announcePhase(event.phase);
    } else if (event.type === 'defeated' && event.wizardId === PLAYER_ID) {
      const subtitle =
        current.state.deathRule === 'spectre'
          ? 'Sigues como espectro'
          : current.player.lives > 1
            ? 'Reapareces en unos segundos'
            : 'Te quedaste sin vidas';
      hud.announce('Caíste', subtitle);
    } else if (event.type === 'revived' && event.wizardId === PLAYER_ID) {
      hud.announce('De pie', `${badges.get(event.byId)?.name ?? 'Un aliado'} te levantó`);
    } else if (event.type === 'guardianAwake') {
      hud.announce('El Guardián despertó', 'Está en la plaza: vencerlo da Esencia de todo', 2.6);
    } else if (event.type === 'beastSlain' && event.guardian) {
      const killer = event.killerId === PLAYER_ID ? 'Tú' : badges.get(event.killerId ?? -1)?.name;
      hud.announce(
        'Cayó el Guardián',
        event.killerId === PLAYER_ID
          ? 'Esencia de los cinco elementos'
          : `${killer ?? 'Alguien'} se llevó su Esencia`,
        2.4,
      );
    } else if (event.type === 'beastSlain' && event.killerId === PLAYER_ID) {
      const bonus = Math.round(rules.beasts.essenceDamagePerStack * 100);
      hud.announce(
        `Esencia de ${elementName(event.element)}`,
        `+${bonus}% de daño con ${elementName(event.element)} esta ronda`,
        1.8,
      );
    } else if (event.type === 'shrineClaimed' && event.team === current.player.team) {
      hud.announce('Santuario tomado', 'Recuperas vida y tu magia pega más fuerte', 2);
    }
  }
}

function teamName(current: LocalMatch, team: number): string {
  const ffa = current.options.mode.kind === 'ffa';
  if (team === current.player.team) return ffa ? 'ti' : 'tu equipo';
  if (!ffa) return 'el equipo rival';
  const member = current.state.wizards.find((w) => w.team === team);
  return (member && badges.get(member.id)?.name) ?? 'un rival';
}

/** Quién ganó la última ronda: si perdiste, el selector de Glifos lo dice. */
let lastWinner = -1;

function updateMatchFlow(current: LocalMatch): void {
  const playerTeam = current.player.team;
  const stage = current.stage;
  if (stage.kind === 'playing' && current.roundNumber !== shownRound) {
    shownRound = current.roundNumber;
    hud.reset(current.state, current.player, badges);
    creatures.clear();
    minimap.reset();
    rig.snap();
    hud.announce(
      `Ronda ${shownRound}`,
      shownRound === 1 ? `Presagio: ${current.omen.name}` : 'Caza: la arena está abierta',
      shownRound === 1 ? 3 : 2.4,
    );
  }
  if (stage.kind === 'playing' && pickerShown) {
    pickerShown = false;
    glyphPicker.hide();
    controls.visible = true;
  }
  if (stage.kind === 'choosing' && !pickerShown) {
    pickerShown = true;
    controls.visible = false;
    const lost = current.series.roundsPlayed > 0 && lastWinner !== playerTeam;
    glyphPicker.show(stage.options, current.glyphsOf(PLAYER_ID), lost);
  }
  if (stage.kind === 'intermission' && stage.ticksLeft === INTERMISSION_ANNOUNCE_TICK) {
    const winner = stage.roundWinner;
    lastWinner = winner;
    if (winner < 0) hud.announce('Ronda empatada', 'Nadie suma', 3.5);
    else if (winner === playerTeam) hud.announce('Ganaste la ronda', '', 3.5);
    else hud.announce('Ronda perdida', `Para ${teamName(current, winner)}`, 3.5);
  }
  if (stage.kind === 'finished' && !resultShown) {
    resultShown = true;
    const winner = current.series.winnerTeam ?? -1;
    const title = winner === playerTeam ? 'Victoria' : winner < 0 ? 'Empate' : 'Derrota';
    const own = current.series.wins[playerTeam] ?? 0;
    const others = current.series.wins.filter((_, team) => team !== playerTeam);
    const detail =
      winner >= 0 && winner !== playerTeam ? ` · ganó ${teamName(current, winner)}` : '';
    hud.showResult(title, `${own} a ${Math.max(0, ...others)}${detail}`);
    controls.visible = false;
  }
}

// ---------- Fijar objetivo tocando a un rival ----------

canvas.addEventListener('pointerdown', (event) => {
  if (!match) return;
  const projected = new THREE.Vector3();
  let best: { id: number; distance: number } | null = null;
  for (const wizard of match.state.wizards) {
    if (wizard.team === match.player.team || wizard.hp <= 0) continue;
    projected.set(wizard.pos.x, 1.2, wizard.pos.z).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    const distance = Math.hypot(x - event.clientX, y - event.clientY);
    if (distance < 80 && (!best || distance < best.distance)) best = { id: wizard.id, distance };
  }
  for (const beast of match.state.beasts) {
    projected.set(beast.pos.x, 0.8, beast.pos.z).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    const distance = Math.hypot(x - event.clientX, y - event.clientY);
    if (distance < 70 && (!best || distance < best.distance)) best = { id: beast.id, distance };
  }
  if (best) input.push({ type: 'lock', targetId: best.id });
});

// ---------- Tamaño ----------

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  post.setSize(width, height, pixelRatio);
  particles.setViewportHeight(height * pixelRatio);
  camera.aspect = width / height;
  // En vertical se abre el ángulo para no perder de vista al rival.
  camera.fov = width < height ? 75 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Bucle ----------

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
let lastFrame = performance.now();
let elapsed = 0;

renderer.setAnimationLoop((now) => {
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  const delta = frameMs / 1000;
  elapsed += delta;

  const current = match;
  if (current) {
    const { steps, alpha } = clock.advance(frameMs);
    for (let i = 0; i < steps; i++) {
      const events = current.step();
      effects.onEvents(events, current.state, (id) => creatures.positionOf(id));
      announceEvents(events, current);
    }
    updateMatchFlow(current);
    renderMatch(current, alpha, delta);
  } else if (preview) {
    previewCamera(elapsed, delta);
    zone.update(rules.arenaRadius, elapsed);
  } else {
    rig.orbit(elapsed, delta);
    zone.update(rules.arenaRadius, elapsed);
  }

  if (!current) maps.jungle.setBurned([]);
  arena.update(elapsed, delta);
  maps.jungle.update(elapsed, camera.position, current ? current.player.pos : null);
  effects.update(delta);
  particles.update(delta);
  post.render();
});

/** Un tejido falso, que cambia cada segundo y medio, igual en todas las pantallas. */
function disguise(wizard: Wizard, tick: number): Wizard {
  const shift = (Math.floor(tick / 45) + wizard.id) % ELEMENT_IDS.length;
  const fake = (weave: readonly ElementId[]): ElementId[] =>
    weave.map(
      (e, i) => ELEMENT_IDS[(ELEMENT_IDS.indexOf(e) + shift + i) % ELEMENT_IDS.length] ?? e,
    );
  return {
    ...wizard,
    weave: fake(wizard.weave),
    channel: wizard.channel ? { ...wizard.channel, weave: fake(wizard.channel.weave) } : null,
  };
}

function renderMatch(current: LocalMatch, alpha: number, delta: number): void {
  const state = current.state;
  const time = ((state.tick + alpha) * TICK_MS) / 1000;
  const player = current.player;
  const playerPos = current.interpolated(player.id, player.pos, alpha);

  for (const wizard of state.wizards) {
    const view = wizardViews.get(wizard.id);
    if (!view) continue;
    const pos = current.interpolated(wizard.id, wizard.pos, alpha);
    const spectre = isSpectre(state, wizard);
    const hidden =
      veiledFromTeam(state, player.team, wizard.id, rules) || blindedFrom(player, wizard, rules);
    // Ilusión de tejido: el rival ve otros elementos en lo que tejes.
    const shown =
      wizard.team !== player.team && wizard.statuses.disguised
        ? disguise(wizard, state.tick)
        : wizard;
    view.update(shown, pos.x, pos.z, time, delta, spectre, rules, hidden);
    if (!hidden) effects.aura(wizard, pos.x, pos.z, spectre, delta);
  }
  const wizardOf = (id: number): Wizard | undefined => state.wizards.find((w) => w.id === id);
  spells.sync(state.spells, {
    positionOf: (spell) =>
      spell.kind === 'projectile' || spell.kind === 'summon' || spell.kind === 'sweeper'
        ? current.interpolated(spell.id, spell.pos, alpha)
        : { x: 0, z: 0 },
    time,
    delta,
    wizard: wizardOf,
    wizardPos: (id) => {
      const wizard = wizardOf(id);
      return wizard ? current.interpolated(id, wizard.pos, alpha) : undefined;
    },
  });
  // Cegado: la pantalla se oscurece alrededor y el minimapa se apaga.
  blindVeil.update(player, delta);
  minimap.show(!player.statuses.blind);
  zone.update(state.zoneRadius, time);
  creatures.sync(state, teamColor, time, delta);

  // El objetivo es la bestia fijada a mano, o el rival.
  const lockedBeast = state.beasts.find((b) => b.id === player.lockTarget);
  const target = currentTarget(state, player, rules);
  const targetPos = lockedBeast
    ? lockedBeast.pos
    : target
      ? current.interpolated(target.id, target.pos, alpha)
      : null;
  rig.update(playerPos, targetPos, delta, effects.shake);
  arena.focus(playerPos.x, playerPos.z);
  lantern.position.set(playerPos.x, 3.2, playerPos.z);
  targetMarker.update(player.hp > 0 ? targetPos : null, time);
  const aim = input.aimPreview;
  aimGuide.update(playerPos, aim && player.hp > 0 ? rig.screenToGround(aim.right, aim.up) : null);

  controls.render(player, rules, isSpectre(state, player));
  hud.update(state, player, current.series, current.roundNumber, badges, rules);
  labels.updateBeasts(state, camera, beastName, elementColorHex);
  const seen = visibleEnemies(state, player.team, rules);
  labels.update(
    state,
    (id, pos) => current.interpolated(id, pos, alpha),
    camera,
    player.team,
    badges,
    rules,
    seen,
    player.statuses.insight !== undefined,
  );
  maps.jungle.setBurned(state.burnedTrees);
  minimap.update(state, player, rig.forward(), seen, badges, time);
}

showMenu();
// La primera vez eliges nombre y personaje.
if (!profile.name) openWardrobe();

// Solo en desarrollo: acceso a la partida desde la consola para probar pantallas.
if (import.meta.env.DEV) {
  Object.assign(window, { crisol: { match: () => match } });
}
