import {
  BEAST_NAMES,
  blindedFrom,
  DEFAULT_LOOK,
  ELEMENTS,
  GAME_RULES,
  GUARDIAN_NAME,
  NO_OMEN,
  ROBE_COLORS,
  rulesForMode,
  SKIN_TONES,
  spellName,
  TRIM_COLORS,
  veiledFromTeam,
  visibleEnemies,
  WIZARD_NAMES,
} from '@crisol/content';
import {
  autoTarget,
  type Beast,
  createMatch,
  ELEMENT_IDS,
  type ElementId,
  FixedStepClock,
  type GameEvent,
  type GameRules,
  isHiddenFrom,
  isSpectre,
  type MatchState,
  SeededRng,
  TICK_MS,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import { isValidRoomCode, type PlayerInfo, randomRoomCode } from '@crisol/protocol';
import * as THREE from 'three';
import { GameAudio } from './audio/GameAudio';
import { type CameraMode, readCameraMode, saveCameraMode } from './camera/CameraMode';
import { CameraRig, CENTER_STYLE, FOLLOW_STYLE } from './camera/CameraRig';
import { Grimoire } from './game/Grimoire';
import { LocalMatch, type MatchOptions, PLAYER_ID } from './game/LocalMatch';
import { MatchPerfLog } from './game/MatchPerfLog';
import type { MatchView } from './game/MatchView';
import {
  type Appearance,
  loadProfile,
  lookColor,
  type Profile,
  randomAppearance,
  saveProfile,
} from './game/Profile';
import { TrainingMatch } from './game/TrainingMatch';
import { blockBrowserGestures } from './input/blockBrowserGestures';
import { CameraDrag } from './input/CameraDrag';
import { HumanController } from './input/HumanController';
import { PlayerInput } from './input/PlayerInput';
import { TouchControls } from './input/TouchControls';
import { NetMatch } from './net/NetMatch';
import { enterImmersive, ScreenAwake } from './platform/mobile';
import { AdaptiveResolution } from './render/AdaptiveResolution';
import { AimGuide } from './render/AimGuide';
import { ArenaView } from './render/arena/ArenaView';
import { MapViews } from './render/arena/MapViews';
import { ZoneView } from './render/arena/ZoneView';
import { CreatureViews } from './render/CreatureViews';
import { EffectsView } from './render/EffectsView';
import { MenuPortrait } from './render/MenuPortrait';
import { Particles } from './render/Particles';
import { teamColorHex } from './render/palette';
import { PostProcessing } from './render/postprocessing';
import { readQuality, saveQuality } from './render/Quality';
import { SpellViews, type SpellWorld } from './render/SpellViews';
import { TargetMarker } from './render/TargetMarker';
import { type WizardLook, WizardView } from './render/WizardView';
import { BlindVeil } from './ui/BlindVeil';
import { ComboCallouts } from './ui/ComboCallouts';
import { EdgeIndicators } from './ui/EdgeIndicators';
import { FpsMeter } from './ui/FpsMeter';
import { GlyphPicker } from './ui/GlyphPicker';
import { GrimoireBook, weaveOrbs } from './ui/GrimoireBook';
import { Hud, type WizardBadge } from './ui/Hud';
import { Lobby } from './ui/Lobby';
import { Menu } from './ui/Menu';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './ui/PauseMenu';
import { TrainingPanel } from './ui/TrainingPanel';
import { UiObstacles } from './ui/UiObstacles';
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
  (screen) => rig.moveToGround(screen.right, screen.up),
  (screen) => rig.screenToGround(screen.right, screen.up),
  rules,
);
const obstacles = new UiObstacles(uiRoot);
const labels = new WorldLabels(uiRoot, obstacles);
const screenAwake = new ScreenAwake();
const controls = new TouchControls(uiRoot, input);
const audio = new GameAudio();
// Tus notas suenan al tocar, con tu tejido tal como lo ves (predicción local incluida).
input.onAction((action) => {
  if (match) audio.playerAction(action, match.present?.(match.player) ?? match.player);
});
// Un clic suave en los botones de los menús (los del combate ya suenan con su nota).
uiRoot.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest('button');
  if (!button || button.closest('.element-button, .cast-button, .cancel-button')) return;
  audio.click();
});
const minimap = new Minimap(uiRoot, rules);
const menuPortrait = new MenuPortrait(rules);
const fpsMeter = new FpsMeter(uiRoot);
/** Lo que pasó con el rendimiento en toda la partida (se ve al final, con los datos activados). */
const perfLog = new MatchPerfLog();
let audioCutsSeen = 0;
const blindVeil = new BlindVeil(uiRoot);
const comboCallouts = new ComboCallouts(uiRoot);
const cameraDrag = new CameraDrag(canvas, (radians) => rig.rotate(radians));
const hud = new Hud(
  uiRoot,
  () => {
    if (net) {
      net.requestRematch();
      hud.hideResult();
      hud.announce('Revancha pedida', 'Esperando a tu rival', 3);
    } else startMatch(match?.options ?? menu.options);
  },
  () => showMenu(),
);
let profile = loadProfile();
const grimoire = new Grimoire();
const menu = new Menu(
  uiRoot,
  (options) => startMatch(options),
  () => openWardrobe(),
  () => openGrimoire(),
  () => openLobby(),
  () => startTraining(),
  audio.engine,
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
const grimoireBook = new GrimoireBook(
  uiRoot,
  () => closeOverlays(),
  () => rules,
);
const glyphPicker = new GlyphPicker(uiRoot, (glyph) => match?.chooseGlyph(glyph));

const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
let match: MatchView | null = null;
/** El duelo en red, si estás jugando con un amigo. */
let net: NetMatch | null = null;
const netBadge = document.createElement('div');
netBadge.className = 'net-badge';
netBadge.hidden = true;
uiRoot.append(netBadge);
/** Con la pausa abierta contra la IA, la partida se detiene; en red sigue corriendo. */
let paused = false;
let lastAlpha = 1;
let quality = readQuality();
/** Alta: todo el ambiente. Liviana: sin sombras, luces de brasero, resplandor ni estelas. */
function applyQuality(): void {
  const full = quality === 'alta';
  post.enabled = full;
  arena.setLight(full);
  spells.trailsEnabled = full;
}
applyQuality();

// ---------- Modos de cámara (de prueba, se eligen en Pausa) ----------

let cameraMode: CameraMode = readCameraMode();
const edges = new EdgeIndicators(uiRoot);
/** Cámara asistida: al disparar sin arrastrar, la cámara se centra un rato en ese blanco. */
let castFocus: { id: number; until: number } | null = null;
/** Hasta dónde se avisa con flechas de un rival fuera de pantalla. */
const EDGE_RANGE = 25;
const CAST_FOCUS_SECONDS = 1.5;
function applyCameraMode(): void {
  rig.style = cameraMode === 'seguimiento' ? FOLLOW_STYLE : CENTER_STYLE;
  castFocus = null;
  if (cameraMode !== 'asistida') edges.clear();
}
applyCameraMode();
input.onAction((action) => {
  if (action.type !== 'cast' || action.aim || cameraMode !== 'asistida' || !match) return;
  const target = autoTarget(match.state, match.player, rules);
  castFocus = target ? { id: target.id, until: elapsed + CAST_FOCUS_SECONDS } : null;
});

/** Dónde está ahora un mago o una bestia (para el aviso de golpes). */
function entityPos(state: MatchState, id: number): Vec2 | null {
  return (
    state.wizards.find((w) => w.id === id)?.pos ??
    state.beasts.find((b) => b.id === id)?.pos ??
    null
  );
}
const pauseMenu = new PauseMenu(
  uiRoot,
  audio.engine,
  {
    onPause: (value) => {
      paused = value;
      if (value && match && match !== net) controls.visible = false;
    },
    onMenu: () => showMenu(),
    onDiagnostics: (on) => {
      fpsMeter.enabled = on;
      netBadge.hidden = !(on && net);
    },
    onCameraMode: (mode) => {
      cameraMode = mode;
      saveCameraMode(mode);
      applyCameraMode();
    },
    onLightGraphics: (on) => {
      quality = on ? 'liviana' : 'alta';
      saveQuality(quality);
      applyQuality();
      if (match) perfLog.qualityChanged(quality);
    },
  },
  fpsMeter.enabled,
  quality === 'liviana',
  cameraMode,
);
// Si el celular cambia de app en plena partida contra la IA, queda en pausa.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && match && match !== net) pauseMenu.open();
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !match) return;
  if (pauseMenu.isOpen) pauseMenu.close();
  else pauseMenu.open();
});
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
    face: look.face,
    outfit: look.outfit,
    headwear: look.headwear,
    mask: look.mask,
    cape: look.cape,
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
  menuPortrait.setLook(lookOf(profile.look, profile.affinity, '#e8d7a8', true));
  menu.visible = true;
  if (pendingInvite && profile.name) {
    const code = pendingInvite;
    pendingInvite = '';
    joinRoom(code);
  }
}

/** Cámara del Vestidor: el mago a un lado y el panel al otro. */
function previewCamera(time: number, delta: number): void {
  if (!preview) return;
  const { view, wizard } = preview;
  const angle = Math.PI + Math.sin(time * 0.35) * 0.9;
  wizard.facing = { x: Math.sin(angle), z: Math.cos(angle) };
  view.update(wizard, 0, 0, time, delta, false, rules);
  camera.position.set(-0.8, 1.65, -3.0);
  camera.lookAt(-0.8, 1.25, 0);
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
  trainingPanel.visible = false;
  hud.training = false;
  screenAwake.active = false;
  net?.close();
  net = null;
  if (location.search) history.replaceState(null, '', location.pathname);
  lobby.hide();
  netBadge.hidden = true;
  watchBadge.hidden = true;
  edges.clear();
  pauseMenu.setAvailable(false, false);
  paused = false;
  match = null;
  useRules(GAME_RULES);
  targetMarker.update(null, 0);
  creatures.clear();
  glyphPicker.hide();
  clearWizards();
  spells.sync([], NO_SPELL_WORLD);
  menu.visible = true;
  audio.setMood('menu');
  hud.visible = false;
  labels.visible = false;
  controls.visible = false;
  minimap.show(false);
  blindVeil.reset();
  comboCallouts.clear();
  cameraDrag.enabled = false;
  lantern.intensity = 0;
  hud.hideResult();
  wardrobe.hide();
  grimoireBook.hide();
  hidePreview();
  menu.setIdentity(profile, grimoire.count, grimoire.total);
  menuPortrait.setLook(lookOf(profile.look, profile.affinity, '#e8d7a8', true));
}

function startMatch(options: MatchOptions): void {
  enterImmersive();
  const seed = (Math.random() * 2 ** 32) >>> 0;
  useRules(rulesForMode(options.mode));
  const current = new LocalMatch(options, rules, human, seed);
  // Nombres y aspecto de los rivales y aliados, sin repetir, elegidos con la semilla.
  const rng = new SeededRng(seed);
  const names = [...WIZARD_NAMES];
  const others = new Map(
    current.state.wizards
      .filter((w) => w.id !== PLAYER_ID)
      .map((w) => [
        w.id,
        {
          name: names.splice(rng.int(0, names.length - 1), 1)[0] ?? 'Hechicero',
          look: randomAppearance(rng),
        },
      ]),
  );
  beginMatch(current, (id) => others.get(id) ?? { name: 'Hechicero', look: profile.look });
}

/** El modo entrenamiento: tú contra un muñeco, con el panel de lo que estás tejiendo. */
function startTraining(): void {
  enterImmersive();
  useRules(rulesForMode({ kind: 'duel' }));
  const current = new TrainingMatch(rules, human, profile.affinity);
  useRules(current.rules);
  beginMatch(current, () => ({
    name: 'Muñeco',
    look: { ...DEFAULT_LOOK, robe: 'hueso', headwear: 'ninguno', face: 'automata' },
  }));
  trainingPanel.visible = true;
  obstacles.invalidate();
}

/** Empieza (o reempieza) un duelo en red: los nombres y el aspecto vienen de la sala. */
function startNetMatch(current: NetMatch): void {
  useRules(current.rules);
  const info = (id: number): PlayerInfo | undefined => current.roster.find((p) => p.id === id);
  lobby.hide();
  // Los datos de la conexión solo se ven si se pidieron en Pausa.
  netBadge.hidden = !fpsMeter.enabled;
  beginMatch(current, (id) => ({
    name: info(id)?.name ?? 'Rival',
    look: info(id)?.look ?? profile.look,
  }));
}

/** Prepara la pantalla para una partida: magos, nombres, colores y HUD. */
function beginMatch(
  current: MatchView,
  other: (id: number) => { readonly name: string; readonly look: Appearance },
): void {
  match = current;
  effects.playerId = current.playerId;
  const ffa = current.options.mode.kind === 'ffa';
  const player = current.player;
  badges = new Map();
  for (const wizard of current.state.wizards) {
    const isPlayer = wizard.id === current.playerId;
    const name = isPlayer ? profile.name || 'Tú' : other(wizard.id).name;
    badges.set(wizard.id, { name, color: teamColorHex(wizard.team, player.team, isPlayer, ffa) });
  }

  clearWizards();
  wizardLooks.clear();
  for (const wizard of current.state.wizards) {
    const isPlayer = wizard.id === current.playerId;
    const look = lookOf(
      isPlayer ? profile.look : other(wizard.id).look,
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
  labels.reset(badges, current.playerId);
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
  // Una sala sin Presagio no muestra ninguno.
  if (current.omen.id === NO_OMEN.id) hud.setOmen(null);
  else hud.setOmen(current.omen.name, current.omen.description);
  hud.setPlayerName(profile.name);
  hud.training = current instanceof TrainingMatch;
  pauseMenu.training = current instanceof TrainingMatch;
  pauseMenu.setAvailable(true, current === net);
  screenAwake.active = true;
  resolution.restart();
  perfLog.start(resolution.pixelRatio, quality);
  audioCutsSeen = audio.engine.interruptions;
  obstacles.invalidate();
  rig.snap();
}

function clearWizards(): void {
  for (const view of wizardViews.values()) view.dispose();
  wizardViews.clear();
}

/** Avisos de la partida según lo que pasó en el paso. */
function announceEvents(events: readonly GameEvent[], current: MatchView): void {
  const me = current.playerId;
  for (const event of events) {
    if (event.type === 'cast' && event.wizardId === me) {
      if (grimoire.discover(event.weave)) {
        audio.discover();
        hud.celebrateDiscovery(
          spellName(event.weave),
          weaveOrbs(event.weave),
          grimoire.count,
          grimoire.total,
        );
      }
    } else if (event.type === 'phase') {
      hud.announcePhase(event.phase);
    } else if (event.type === 'defeated' && event.wizardId === me) {
      const rule = current.state.deathRule;
      const subtitle =
        rule === 'spectre'
          ? 'Sigues como espectro'
          : rule === 'out'
            ? 'Miras a quienes siguen en pie'
            : current.player.lives > 1
              ? 'Reapareces en unos segundos'
              : 'Te quedaste sin vidas';
      hud.announce('Caíste', subtitle);
    } else if (event.type === 'revived' && event.wizardId === me) {
      hud.announce('De pie', `${badges.get(event.byId)?.name ?? 'Un aliado'} te levantó`);
    } else if (event.type === 'guardianAwake') {
      hud.announce('El Guardián despertó', 'Está en la plaza: vencerlo da Esencia de todo', 2.6);
    } else if (event.type === 'beastSlain' && event.guardian) {
      const killer = event.killerId === me ? 'Tú' : badges.get(event.killerId ?? -1)?.name;
      hud.announce(
        'Cayó el Guardián',
        event.killerId === me
          ? 'Esencia de los cinco elementos'
          : `${killer ?? 'Alguien'} se llevó su Esencia`,
        2.4,
      );
    } else if (event.type === 'beastSlain' && event.killerId === me) {
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

function teamName(current: MatchView, team: number): string {
  const ffa = current.options.mode.kind === 'ffa';
  if (team === current.player.team) return ffa ? 'ti' : 'tu equipo';
  if (!ffa) return 'el equipo rival';
  const member = current.state.wizards.find((w) => w.team === team);
  return (member && badges.get(member.id)?.name) ?? 'un rival';
}

/** Quién ganó la última ronda: si perdiste, el selector de Glifos lo dice. */
let lastWinner = -1;

function updateMatchFlow(current: MatchView): void {
  const playerTeam = current.player.team;
  const stage = current.stage;
  if (stage.kind === 'playing' && current.roundNumber !== shownRound) {
    shownRound = current.roundNumber;
    audio.reset();
    audio.setMood('hunt');
    hud.reset(current.state, current.player, badges);
    creatures.clear();
    minimap.reset();
    rig.snap();
    if (current instanceof TrainingMatch) {
      hud.announce('Entrenamiento', 'Teje y mira qué sale', 3);
    } else {
      hud.announce(
        `Ronda ${shownRound}`,
        shownRound === 1 && current.omen.id !== NO_OMEN.id
          ? `Presagio: ${current.omen.name}`
          : 'Caza: la arena está abierta',
        shownRound === 1 ? 3 : 2.4,
      );
    }
  }
  if ((stage.kind === 'playing' || stage.kind === 'waiting') && pickerShown) {
    pickerShown = false;
    glyphPicker.hide();
    controls.visible = stage.kind === 'playing';
    if (stage.kind === 'waiting') hud.announce('Glifo elegido', 'Esperando a tu rival', 3);
  }
  // Jugando, los controles se ven salvo que hayas caído y estés mirando a otro.
  if (stage.kind === 'playing' && !resultShown) controls.visible = watchedOf(current) === null;
  if (stage.kind === 'choosing' && !pickerShown) {
    pickerShown = true;
    audio.setMood('menu');
    controls.visible = false;
    const lost = current.series.roundsPlayed > 0 && lastWinner !== playerTeam;
    glyphPicker.show(stage.options, current.glyphsOf(current.playerId), lost);
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
    audio.finish(winner === playerTeam);
    const title = winner === playerTeam ? 'Victoria' : winner < 0 ? 'Empate' : 'Derrota';
    const own = current.series.wins[playerTeam] ?? 0;
    const others = current.series.wins.filter((_, team) => team !== playerTeam);
    const detail =
      winner >= 0 && winner !== playerTeam ? ` · ganó ${teamName(current, winner)}` : '';
    hud.showResult(title, `${own} a ${Math.max(0, ...others)}${detail}`);
    if (fpsMeter.enabled) hud.showPerf(perfLog.summary(audio.engine.playing));
    controls.visible = false;
  }
}

// ---------- Entrenamiento ----------

const trainingPanel = new TrainingPanel(
  uiRoot,
  hud.playerColumn,
  (on) => {
    if (match instanceof TrainingMatch) match.restless = on;
  },
  () => showMenu(),
);

// ---------- Jugar con un amigo ----------

const lobby = new Lobby(
  uiRoot,
  () => joinRoom(randomRoomCode(Math.random)),
  (code) => joinRoom(code),
  () => showMenu(),
  () => net?.begin(),
  (settings) => net?.configure(settings),
);

function openLobby(): void {
  enterImmersive();
  menu.visible = false;
  lobby.showChoice();
}

/**
 * Entra a una sala (nueva o de un amigo) y espera a que empiece. Los ajustes (modo, tiempo,
 * rondas…) los elige en la sala quien la creó, a la vista de todos.
 */
function joinRoom(code: string): void {
  net?.close();
  menu.visible = false;
  lobby.showRoom(code);
  history.replaceState(null, '', `?sala=${code}`);
  const current = new NetMatch(
    code,
    { name: profile.name || 'Hechicero', look: profile.look, affinity: profile.affinity },
    human,
    {
      players: (players, me) => {
        lobby.setPlayers(players, me, current.settings, current.hostId);
        if (current !== net) return;
        // Presente: conectado y con la app a la vista. Si no, la IA juega por él.
        const present = (p: (typeof players)[number]): boolean => p.connected && !p.away;
        if (!current.started) {
          for (const p of players) seenConnected.set(p.id, present(p));
          return;
        }
        // Avisos de quien se fue o volvió durante el duelo.
        for (const p of players) {
          if (p.id === me) continue;
          const was = seenConnected.get(p.id);
          if (was === true && !present(p)) {
            // Conectado pero ausente: salió de la app o se quedó sin señal (la Sala no distingue).
            const why = p.connected ? 'se fue un momento' : 'se desconectó';
            hud.announce(`${p.name} ${why}`, 'La IA juega por él', 2.6);
          }
          if (was === false && present(p)) hud.announce(`${p.name} volvió`, '', 2);
        }
        for (const p of players) seenConnected.set(p.id, present(p));
      },
      start: (started) => {
        if (started !== net) return;
        resultShown = false;
        startNetMatch(started);
      },
      problem: (reason, fatal) => {
        if (current !== net) return;
        if (lobby.visible) lobby.setStatus(reason);
        else hud.announce(reason, fatal ? '' : 'Tu mago sigue en manos de la IA', 3);
        if (fatal && !match) lobby.setStatus(reason);
      },
      notice: (text) => {
        if (current !== net) return;
        if (!lobby.visible) hud.announce(text, '', 1.6);
      },
      stats: (stats) => {
        const simulated = stats.simulated ? ` · ${stats.simulated}` : '';
        netBadge.textContent = `${stats.ping} ms · colchón ${stats.buffer}/${stats.target} · cortes ${stats.stalls} · ${stats.kbps} kB/s · máx ${stats.biggest} B${simulated}`;
      },
    },
  );
  net = current;
  seenConnected.clear();
}
const seenConnected = new Map<number, boolean>();
/** Una invitación que llegó antes de que eligieras nombre: se usa al salir del Vestidor. */
let pendingInvite = '';

// ---------- Fijar objetivo tocando a un rival ----------

/** Un toque, no un arrastre: arrastrar el dedo gira la cámara y no debe cambiar de objetivo. */
const TAP_SLOP_PX = 14;
const TAP_MAX_MS = 350;
const taps = new Map<number, { x: number; y: number; at: number }>();
canvas.addEventListener('pointerdown', (event) => {
  taps.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp });
});
canvas.addEventListener('pointercancel', (event) => taps.delete(event.pointerId));
canvas.addEventListener('pointerup', (event) => {
  const start = taps.get(event.pointerId);
  taps.delete(event.pointerId);
  if (!start || !match) return;
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  if (moved > TAP_SLOP_PX || event.timeStamp - start.at > TAP_MAX_MS) return;
  lockAt(start.x, start.y);
});

function lockAt(screenX: number, screenY: number): void {
  if (!match) return;
  const projected = new THREE.Vector3();
  let best: { id: number; distance: number } | null = null;
  for (const wizard of match.state.wizards) {
    if (wizard.team === match.player.team || wizard.hp <= 0) continue;
    projected.set(wizard.pos.x, 1.2, wizard.pos.z).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    const distance = Math.hypot(x - screenX, y - screenY);
    if (distance < 80 && (!best || distance < best.distance)) best = { id: wizard.id, distance };
  }
  for (const beast of match.state.beasts) {
    projected.set(beast.pos.x, 0.8, beast.pos.z).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    const distance = Math.hypot(x - screenX, y - screenY);
    if (distance < 70 && (!best || distance < best.distance)) best = { id: beast.id, distance };
  }
  if (best) {
    input.push({ type: 'lock', targetId: best.id });
    navigator.vibrate?.(10);
  }
}

// ---------- Tamaño ----------

/** Baja la resolución si el celular no alcanza los cuadros por segundo, y la sube si sobra. */
const resolution = new AdaptiveResolution(window.devicePixelRatio);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = resolution.pixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  post.setSize(width, height, pixelRatio);
  particles.setViewportHeight(height * pixelRatio);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Bucle ----------

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
let lastFrame = performance.now();
let elapsed = 0;

// Las llamadas de dibujo se cuentan por cuadro completo (sombras y resplandor incluidos).
renderer.info.autoReset = false;

renderer.setAnimationLoop((now) => {
  const workStart = performance.now();
  renderer.info.reset();
  let simMs = 0;
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  fpsMeter.sample(frameMs);
  const newRatio = resolution.sample(frameMs);
  if (newRatio !== null) {
    resize();
    perfLog.resolutionChanged(newRatio);
  }
  const delta = frameMs / 1000;
  elapsed += delta;

  const current = match;
  const pausedHere = paused && current !== null && current !== net;
  const simDelta = pausedHere ? 0 : delta;
  if (current && pausedHere) {
    renderMatch(current, lastAlpha, 0);
  } else if (current) {
    const { steps, alpha } = clock.advance(frameMs);
    const simStart = performance.now();
    lastAlpha = alpha;
    for (let i = 0; i < steps; i++) {
      const events = current.step();
      effects.onEvents(events, current.state, (id) => creatures.positionOf(id));
      announceEvents(events, current);
      audio.onEvents(events, current.state);
      for (const event of events) {
        if (event.type === 'combo') comboCallouts.show(event.combo, event.targetId);
        if (
          event.type === 'hit' &&
          cameraMode === 'asistida' &&
          event.targetId === current.playerId &&
          event.form !== 'zone' &&
          event.sourceId !== current.playerId
        ) {
          const from = entityPos(current.state, event.sourceId);
          if (from) edges.hit(from);
        }
      }
      if (current instanceof TrainingMatch) {
        for (const event of events) {
          if (event.type === 'release' && event.wizardId === current.playerId) {
            trainingPanel.cast(event.spell, rules);
          }
        }
      }
    }
    simMs = performance.now() - simStart;
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
  effects.update(simDelta);
  particles.update(simDelta);
  post.render();
  if (current && !pausedHere && !resultShown) {
    perfLog.frame(frameMs, {
      simMs,
      jsMs: performance.now() - workStart,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
    while (audioCutsSeen < audio.engine.interruptions) {
      audioCutsSeen += 1;
      perfLog.audioCut();
    }
  }
  // Tu mago en la tarjeta del menú, encima de la arena, solo mientras el menú está a la vista.
  const portraitRect = menu.portraitRect;
  if (portraitRect) menuPortrait.render(renderer, portraitRect, elapsed, delta);
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

/**
 * Si caíste y quedaste fuera, el mago al que miras: primero un aliado en pie y si no, el rival
 * que siga vivo. Null mientras sigas jugando.
 */
function watchedOf(current: MatchView): Wizard | null {
  const state = current.state;
  const player = current.player;
  if (state.deathRule !== 'out' || !player.fallen) return null;
  const standing = state.wizards.filter((w) => w.hp > 0 && !w.fallen);
  return (
    standing.find((w) => w.team === player.team) ??
    standing.find((w) => w.id === watchedId) ??
    standing[0] ??
    null
  );
}
/** A quién mirabas, para no saltar de un rival a otro en cada cuadro. */
let watchedId = -1;
const watchBadge = document.createElement('div');
watchBadge.className = 'watch-badge';
watchBadge.hidden = true;
uiRoot.append(watchBadge);

function renderMatch(current: MatchView, alpha: number, delta: number): void {
  const state = current.state;
  const time = ((state.tick + alpha) * TICK_MS) / 1000;
  const player = current.player;
  // Si caíste, la cámara sigue a quien miras.
  const watched = watchedOf(current);
  watchedId = watched?.id ?? -1;
  // Entre rondas y al final, la pantalla de Glifos o el resultado ocupan el centro.
  watchBadge.hidden = watched === null || resultShown || glyphPicker.isOpen;
  if (watched)
    watchBadge.textContent = `Caíste · miras a ${badges.get(watched.id)?.name ?? 'otro mago'}`;
  const focus = watched ?? player;
  const playerPos = current.interpolated(focus.id, focus.pos, alpha);

  for (const wizard of state.wizards) {
    const view = wizardViews.get(wizard.id);
    if (!view) continue;
    const pos = current.interpolated(wizard.id, wizard.pos, alpha);
    const spectre = isSpectre(state, wizard);
    const hidden =
      current.isHidden?.(wizard.id) === true ||
      veiledFromTeam(state, player.team, wizard.id, rules) ||
      blindedFrom(player, wizard, rules);
    // Ilusión de tejido: el rival ve otros elementos en lo que tejes.
    const base = current.present?.(wizard) ?? wizard;
    const shown =
      base.team !== player.team && base.statuses.disguised ? disguise(base, state.tick) : base;
    view.update(shown, pos.x, pos.z, time, delta, spectre, rules, hidden);
    audio.watchWeave(shown, pos, hidden || spectre);
    if (!hidden) effects.aura(wizard, pos.x, pos.z, spectre, delta);
  }
  const wizardOf = (id: number): Wizard | undefined => state.wizards.find((w) => w.id === id);
  spells.sync(state.spells, {
    positionOf: (spell) =>
      spell.kind === 'projectile' ||
      spell.kind === 'summon' ||
      spell.kind === 'sweeper' ||
      spell.kind === 'guidedBolt'
        ? current.interpolated(spell.id, spell.pos, alpha)
        : { x: 0, z: 0 },
    viewerTeam: player.team,
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
  // En el entrenamiento la esquina es del panel; el muñeco no se esconde.
  const sightless = player.statuses.blind && !player.statuses.hunting;
  minimap.show(!sightless && !(current instanceof TrainingMatch));
  zone.update(state.zoneRadius, time);
  creatures.sync(state, teamColor, time, delta);

  // La marca muestra a quién irá el disparo automático (lo mismo que calcula el núcleo).
  const aimed = autoTarget(state, focus, rules);
  const targetPos = aimed
    ? aimed.kind === 'wizard'
      ? current.interpolated(aimed.id, aimed.pos, alpha)
      : aimed.pos
    : null;
  // Qué sigue la cámara depende del modo: lo fijado a mano (y, en la asistida, el blanco de un
  // disparo reciente) o, en seguimiento, el blanco del disparo. Si caíste, el de quien miras.
  if (castFocus && (elapsed > castFocus.until || castFocus.id !== aimed?.id)) castFocus = null;
  const follows =
    aimed !== null &&
    (watched !== null ||
      aimed.id === player.lockTarget ||
      cameraMode === 'seguimiento' ||
      castFocus?.id === aimed.id);
  const cameraFocus = follows && aimed && targetPos ? { id: aimed.id, pos: targetPos } : null;
  rig.update(playerPos, cameraFocus, delta, effects.shake);
  if (cameraMode === 'asistida') {
    const arrows =
      player.hp > 0 && !resultShown && !glyphPicker.isOpen
        ? state.wizards
            .filter(
              (w) =>
                w.team !== player.team &&
                w.hp > 0 &&
                !isHiddenFrom(w, player, rules) &&
                !blindedFrom(player, w, rules) &&
                Math.hypot(w.pos.x - playerPos.x, w.pos.z - playerPos.z) <= EDGE_RANGE,
            )
            .map((w) => ({
              pos: current.interpolated(w.id, w.pos, alpha),
              color: teamColor(w.team),
              strong: w.id === aimed?.id,
            }))
        : [];
    edges.update(camera, arrows, delta);
  }
  const forward = rig.forward();
  WizardView.viewYaw = Math.atan2(-forward.x, -forward.z);
  audio.setListener(playerPos, rig.forward(), current.playerId);
  arena.focus(playerPos.x, playerPos.z);
  lantern.position.set(playerPos.x, 3.2, playerPos.z);
  targetMarker.update(player.hp > 0 ? targetPos : null, time);
  const aim = input.aimPreview;
  aimGuide.update(playerPos, aim && player.hp > 0 ? rig.screenToGround(aim.right, aim.up) : null);

  controls.render(current.present?.(player) ?? player, rules, isSpectre(state, player));
  hud.update(state, player, current.series, current.roundNumber, badges, rules);
  obstacles.refresh();
  labels.updateBeasts(state, camera, beastName, elementColorHex);
  const seen = visibleEnemies(state, player.team, rules);
  // En red, a quien la Sala no te muestra no se lo ve ni en el mapa (llega quieto y sin tejido).
  for (const id of seen) if (current.isHidden?.(id)) seen.delete(id);
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
  comboCallouts.update(
    camera,
    (id) => {
      const wizard = wizardOf(id);
      return wizard ? current.interpolated(id, wizard.pos, alpha) : undefined;
    },
    delta,
  );
  minimap.update(state, player, rig.forward(), seen, badges, time);
}

showMenu();
// La primera vez eliges nombre y personaje.
if (!profile.name) openWardrobe();
// Un enlace de invitación (…?sala=K7QF) entra directo a la sala del amigo.
const invited = new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '';
if (isValidRoomCode(invited)) {
  if (profile.name) joinRoom(invited);
  else pendingInvite = invited;
}

// Solo en desarrollo: acceso a la partida desde la consola para probar pantallas.
if (import.meta.env.DEV) {
  Object.assign(window, { crisol: { match: () => match } });
}
