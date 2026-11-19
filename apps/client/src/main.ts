import {
  ARCHETYPES,
  DEFAULT_LOOK,
  DUEL_RULES,
  GAME_RULES,
  masterOf,
  NO_OMEN,
  rulesForMode,
  STORY_CONTINUES,
  type StoryFight,
  schoolOf,
  schoolSpellbook,
  storyFor,
  WIZARD_NAMES,
} from '@crisol/content';
import {
  type ElementId,
  FixedStepClock,
  type GameRules,
  type Intent,
  roundPhase,
  SeededRng,
} from '@crisol/core';
import {
  isValidRoomCode,
  type PlayerInfo,
  QUICK_ROOM_SETTINGS,
  randomRoomCode,
} from '@crisol/protocol';
import { GameAudio } from './audio/GameAudio';
import { ComboLog } from './game/ComboLog';
import { castOf, type OtherWizard, ownLook } from './game/cast';
import { Diagnostics } from './game/Diagnostics';
import { readDamageNumbers, saveDamageNumbers } from './game/damageNumbers';
import { Grimoire } from './game/Grimoire';
import { HitFeedback } from './game/HitFeedback';
import { LocalMatch, type MatchOptions, PLAYER_ID } from './game/LocalMatch';
import { MatchFlow } from './game/MatchFlow';
import type { QualityName } from './game/MatchPerfLog';
import { MatchRenderer } from './game/MatchRenderer';
import type { MatchView } from './game/MatchView';
import { PlayerStats } from './game/PlayerStats';
import { Pocket } from './game/Pocket';
import { loadProfile, randomAppearance, saveProfile } from './game/Profile';
import type { ReplayClip } from './game/ReplayRecorder';
import { ReplayView } from './game/ReplayView';
import { StoryProgress } from './game/StoryProgress';
import { DUMMY_ID, SECOND_DUMMY_ID, TrainingMatch } from './game/TrainingMatch';
import { examSchool, GIFT_CHAPTER, Tutorial, tutorialChapters } from './game/Tutorial';
import { TutorialProgress } from './game/TutorialProgress';
import { blockBrowserGestures } from './input/blockBrowserGestures';
import { CameraDrag } from './input/CameraDrag';
import { HumanController } from './input/HumanController';
import { PlayerInput } from './input/PlayerInput';
import { TapToLock } from './input/TapToLock';
import { TouchControls } from './input/TouchControls';
import { leftRoom, recentRoomCode, roomToRejoin } from './net/lastRoom';
import type { NetMatch } from './net/NetMatch';
import { openRoom } from './net/openRoom';
import { chooseRoomServer, newRoomServer, quickMatchUrls, warmUpRooms } from './net/serverUrl';
import { BackGuard } from './platform/BackGuard';
import { ProfileBackup } from './platform/backup';
import { startErrorReports } from './platform/ErrorReporter';
import { adoptCarriedProgress } from './platform/homeScreen';
import { enterImmersive, ScreenAwake } from './platform/mobile';
import { AutoQuality } from './render/AutoQuality';
import { CALM_FPS, FrameLimiter, PLAY_FPS } from './render/FrameLimiter';
import { GameScene } from './render/GameScene';
import { MenuPortrait } from './render/MenuPortrait';
import { readQuality, saveQuality } from './render/Quality';
import { ScreenCap } from './render/ScreenCap';
import { BackupSheet } from './ui/BackupSheet';
import { BlindVeil } from './ui/BlindVeil';
import { ComboCallouts } from './ui/ComboCallouts';
import { GlyphPicker } from './ui/GlyphPicker';
import { GrimoireBook } from './ui/GrimoireBook';
import type { HighlightView } from './ui/HighlightCard';
import { Hud, PHASE_NAMES, type WizardBadge } from './ui/Hud';
import { HurtEdge } from './ui/HurtEdge';
import { Lobby } from './ui/Lobby';
import { Menu } from './ui/Menu';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './ui/PauseMenu';
import { PocketStrip } from './ui/PocketStrip';
import { ProfileScreen } from './ui/ProfileScreen';
import { ReplayOverlay } from './ui/ReplayOverlay';
import type { ResultPath } from './ui/ResultScreen';
import { SchoolPicker } from './ui/SchoolPicker';
import { Screens } from './ui/Screens';
import { StoryScreen } from './ui/StoryScreen';
import { TrainingChooser } from './ui/TrainingChooser';
import { TrainingPanel } from './ui/TrainingPanel';
import { TutorialCard } from './ui/TutorialCard';
import { UiObstacles } from './ui/UiObstacles';
import { Wardrobe } from './ui/Wardrobe';
import { WeaveName } from './ui/WeaveName';
import { WorldLabels } from './ui/WorldLabels';

// Aquí se arma el juego: se crean las piezas, se conectan entre sí y corre el bucle. Lo que
// hace cada una vive en su archivo (escena, dibujo y curso de la partida, pantallas, sala).

// Lo primero: si algo falla de aquí en adelante, queda en el registro (ver docs/errores.md).
startErrorReports(() => ({ room: net?.code ?? '', match: describeMatch() }));
blockBrowserGestures();
// Abierto desde el ícono recién agregado a inicio: trae el progreso que tenía Safari.
adoptCarriedProgress();
// Y se respalda en el servidor cada vez que cambia (ver docs/respaldo.md).
const backup = new ProfileBackup();
backup.start();
const canvas = document.querySelector<HTMLCanvasElement>('#game');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) {
  throw new Error('Faltan el canvas o la capa de interfaz');
}

// ---------- Estado de la sesión ----------

/** Las reglas de la partida en curso: cambian de mapa entre el 1v1 (plaza) y los equipos (jungla). */
let rules: GameRules = GAME_RULES;
/** La partida a la vista (local, entrenamiento o en red), o null en los menús. */
let match: MatchView | null = null;
/** La sala en red, si estás jugando con amigos (también mientras se espera en la sala). */
let net: NetMatch | null = null;
/** Con la pausa abierta contra la IA, la partida se detiene; en red sigue corriendo. */
let paused = false;
/** Partidas empezadas en esta visita (para el registro de errores). */
let matchCount = 0;
/** El nombre y color de cada mago de la partida. */
let badges = new Map<number, WizardBadge>();
let profile = loadProfile();
let quality = readQuality();
/** Si se ven los números de daño en las partidas (en el entrenamiento, siempre). */
let damageNumbers = readDamageNumbers();
/** Una invitación que llegó antes de que eligieras nombre: se usa al salir del Vestidor. */
let pendingInvite = '';

// ---------- Piezas ----------

const view = new GameScene(canvas, rules, PLAYER_ID);
view.applyQuality(quality);
// Mientras se está en el menú, se preparan de a poco los hechizos de muestra para compilar
// sus sombreadores al empezar cada partida (ver `render/ShaderWarmup.ts`).
view.warmup.prepare(view.scene, view.camera, () => view.lightKey);
const { renderer, rig, resolution } = view;
/** Pasa solo a Gráficos livianos si el celular sigue lento con la resolución al mínimo. */
const autoQuality = new AutoQuality();

function setQuality(next: QualityName): void {
  quality = next;
  saveQuality(quality);
  view.applyQuality(quality);
  if (match) diagnostics.qualityChanged(quality);
}
const input = new PlayerInput();
const human = new HumanController(
  input,
  (screen) => rig.moveToGround(screen.right, screen.up),
  (screen) => rig.screenToGround(screen.right, screen.up),
  rules,
);
const audio = new GameAudio();
const grimoire = new Grimoire();
const comboLog = new ComboLog();
const playerStats = new PlayerStats();
const pocket = new Pocket();
// El modo Camino ya no existe (lo reemplazó la Historia): su avance guardado se borra, también
// del respaldo, que se sube sin él la próxima vez.
try {
  localStorage.removeItem('crisol.camino');
} catch {
  // Sin almacenamiento no hay nada que borrar.
}
/** Por dónde vas en la Historia de tu Linaje (se arma al elegirlo). */
let storyProgress: StoryProgress | null = null;
const obstacles = new UiObstacles(uiRoot);
const labels = new WorldLabels(uiRoot, obstacles);
const controls = new TouchControls(uiRoot, input);
const minimap = new Minimap(uiRoot, rules);
const menuPortrait = new MenuPortrait(rules);
const diagnostics = new Diagnostics(uiRoot, audio.engine, renderer);
const blindVeil = new BlindVeil(uiRoot);
const hurtEdge = new HurtEdge(uiRoot);
const comboCallouts = new ComboCallouts(uiRoot);
const hitFeedback = new HitFeedback({
  damage: (amount, targetId) => comboCallouts.showDamage(amount, targetId),
  status: (word, targetId) => comboCallouts.showStatus(word, targetId),
});
// Arrastrar para mirar a los lados suelta el duelo: la cámara queda libre.
const cameraDrag = new CameraDrag(
  canvas,
  (radians) => rig.rotate(radians),
  () => {
    if (match && (match.present?.(match.player) ?? match.player).lockTarget !== null) {
      input.push({ type: 'lock', targetId: null });
    }
    tutorialCard.collapse();
    if (tutorial?.signal('look')) {
      stepDone();
      afterTutorialAdvance();
      tutorialCard.render();
    }
  },
);
const screenAwake = new ScreenAwake();
const hud = new Hud(uiRoot, rematch, () => showMenu());
const weaveName = new WeaveName(hud.layer, (weave) => grimoire.has(weave));
const pocketStrip = new PocketStrip(hud.playerColumn, pocket);
const menu = new Menu(
  uiRoot,
  (options) => startMatch(options),
  () => openWardrobe(),
  () => openGrimoire(),
  () => openLobby(),
  () => trainingChooser.show(!comboLog.tutorialDone && tutorialProgress.count === 0),
  () => void quickMatch(),
  audio.engine,
  () => profileScreen.open(profile, playerStats.record),
  (key) => audio.say(key),
);
menu.onStory = () => openStory();
const profileScreen = new ProfileScreen(uiRoot);
const wardrobe = new Wardrobe(
  uiRoot,
  (draft) => view.showPreview(ownLook(draft), rules),
  (done) => {
    profile = done;
    saveProfile(profile);
    closeOverlays();
  },
  profile,
  (restoreOnly) => backupSheet.open(restoreOnly),
);
const backupSheet = new BackupSheet(menu.side, uiRoot, backup);
const grimoireBook = new GrimoireBook(
  uiRoot,
  () => closeOverlays(),
  () => rules,
  pocket,
);
const glyphPicker = new GlyphPicker(uiRoot, (glyph) => match?.chooseGlyph(glyph));
const trainingPanel = new TrainingPanel(
  uiRoot,
  hud.playerColumn,
  (on) => {
    if (match instanceof TrainingMatch) match.restless = on;
  },
  () => showMenu(),
);
const tutorialProgress = new TutorialProgress();
const trainingChooser = new TrainingChooser(
  uiRoot,
  (choice) =>
    choice.kind === 'tutorial'
      ? startTraining({ chapter: choice.chapter, onlyOne: choice.onlyOne })
      : startTraining(),
  (chapterId) => tutorialProgress.has(chapterId),
  () => tutorialChapters(profile.school ?? 'brasa'),
);
const schoolPicker = new SchoolPicker(
  uiRoot,
  (school) => chooseSchool(school),
  (key) => audio.say(key),
);
const tutorialCard = new TutorialCard(
  uiRoot,
  () => freePlay(),
  () => showMenu(),
  () => afterTutorialAdvance(),
);
/** El tutorial en curso, si el entrenamiento es el tutorial. */
let tutorial: Tutorial | null = null;
const lobby = new Lobby(
  uiRoot,
  () => void createRoom(),
  (code) => joinRoom(code),
  () => showMenu(),
  () => net?.begin(),
  (settings) => net?.configure(settings),
);
const matchRenderer = new MatchRenderer(
  uiRoot,
  view,
  {
    hud,
    labels,
    minimap,
    controls,
    blindVeil,
    hurtEdge,
    comboCallouts,
    obstacles,
    weaveName,
    pocketStrip,
  },
  audio,
  input,
);
const flow = new MatchFlow({
  view,
  hud,
  audio,
  minimap,
  controls,
  glyphPicker,
  grimoire,
  comboLog,
  comboCallouts,
  renderer: matchRenderer,
  diagnostics,
  stats: playerStats,
  school: () => profile.school,
  replay: (clip, card) => playReplay(clip, card),
  story: (won) => storyResult(won),
});

// ---------- Repetición ----------

/** La repetición en curso (se dibuja en vez de la partida terminada) y la última, para "Ver". */
let replay: ReplayView | null = null;
let lastReplay: { readonly clip: ReplayClip; readonly card: HighlightView | null } | null = null;
const replayOverlay = new ReplayOverlay(uiRoot, () => stopReplay(true));
hud.onReplay = () => {
  if (lastReplay) playReplay(lastReplay.clip, lastReplay.card);
};

/** Muestra la repetición sobre el resultado, que vuelve al terminar o al tocar Saltar. */
function playReplay(clip: ReplayClip, card: HighlightView | null): void {
  if (!match) return;
  lastReplay = { clip, card };
  replay = new ReplayView(clip, match);
  hud.setResultHidden(true);
  view.clearSpells();
  hitFeedback.reset();
  rig.snap();
  replayOverlay.show(card);
}

/** Termina la repetición; con `toResult`, vuelve el resultado (si no, se sale de la partida). */
function stopReplay(toResult: boolean): void {
  if (!replay) return;
  replay = null;
  replayOverlay.hide();
  view.clearSpells();
  if (toResult) hud.setResultHidden(false);
}

/** Un paso de la repetición: los mismos efectos y sonidos que en la partida. */
function stepReplay(current: ReplayView): void {
  const events = current.step();
  view.effects.onEvents(events, current.state, (id) => view.creatures.positionOf(id));
  audio.onEvents(events, current.state);
  if (damageNumbers) hitFeedback.onStep(events, current.state, current.playerId);
  for (const event of events) {
    if (event.type === 'combo') comboCallouts.show(event.combo, event.targetId);
    if (event.type === 'clash') comboCallouts.showClash(event.pos, event.survivorId !== null);
  }
}
const storyScreen = new StoryScreen(uiRoot, {
  sceneDone: () => {
    storyProgress?.advance();
    playStory();
  },
  fight: (fight) => startStoryFight(fight),
  restart: () => {
    storyProgress?.restart();
    playStory();
  },
  close: () => {
    refreshStory();
    menu.visible = true;
  },
});
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
      diagnostics.enabled = on;
    },
    onDamageNumbers: (on) => {
      damageNumbers = on;
      saveDamageNumbers(on);
    },
    onLightGraphics: (on) => {
      // Lo que elige el jugador manda: no se vuelve a cambiar solo.
      autoQuality.stop();
      setQuality(on ? 'liviana' : 'alta');
    },
  },
  diagnostics.enabled,
  quality === 'liviana',
  damageNumbers,
);
const screens = new Screens({
  view,
  menu,
  menuPortrait,
  wardrobe,
  grimoireBook,
  lobby,
  hud,
  labels,
  controls,
  minimap,
  blindVeil,
  hurtEdge,
  comboCallouts,
  glyphPicker,
  pauseMenu,
  trainingPanel,
  obstacles,
  cameraDrag,
  screenAwake,
  renderer: matchRenderer,
  diagnostics,
  audio,
});
// "Atrás" en plena partida abre la Pausa; en la sala de espera no hace nada.
const backGuard = new BackGuard(
  () => match !== null || net !== null,
  () => {
    if (match && !pauseMenu.isOpen) pauseMenu.open();
  },
);
const tapToLock = new TapToLock(
  canvas,
  view.camera,
  input,
  () =>
    match
      ? { state: match.state, player: match.present?.(match.player) ?? match.player, rules }
      : null,
  () => rig.forward(),
);
controls.onDuelButton = () => tapToLock.cycle();
controls.onTap = (x, y) => tapToLock.tapAt(x, y);

// ---------- Reacciones a lo que toca el jugador ----------

input.onAction((action) => {
  if (!match) return;
  // Tus notas suenan al tocar, con tu tejido tal como lo ves (predicción local incluida).
  const shown = match.present?.(match.player) ?? match.player;
  audio.playerAction(action, shown);
  // En red, el destello de lanzar sale al tocar ✦, sin esperar a la Sala.
  if (match === net && action.type === 'cast' && !shown.channel && shown.hp > 0) {
    view.effects.castFlash(match.interpolated(shown.id, shown.pos, lastAlpha), shown.weave);
  }
});
// Un clic suave en los botones de los menús (los del combate ya suenan con su nota).
uiRoot.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement | null)?.closest('button');
  if (!button || button.closest('.element-button, .cast-button, .cancel-button, .duel-button')) {
    return;
  }
  audio.click();
});
// Si el celular cambia de app en plena partida contra la IA, queda en pausa.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && match && match !== net) pauseMenu.open();
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !match) return;
  if (pauseMenu.isOpen) pauseMenu.close();
  else pauseMenu.open();
});
window.addEventListener('resize', () => view.resize());
// Al cerrar el teclado (el nombre, el código de sala), Safari en iPhone puede dejar la página
// corrida hacia arriba y los menús descuadrados: se vuelve a su lugar.
document.addEventListener('focusout', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    window.scrollTo(0, 0);
  }
});

// ---------- Navegación ----------

/** Cambia el mapa que se dibuja y el que usan el minimapa y la vista. */
function useRules(next: GameRules): void {
  rules = next;
  view.useRules(next);
  minimap.setRules(next);
}

function showMenu(): void {
  // Salir a propósito de una sala: al recargar ya no se vuelve sola.
  if (net) leftRoom();
  net?.close();
  net = null;
  if (location.search) history.replaceState(null, '', location.pathname);
  paused = false;
  stopReplay(false);
  lastReplay = null;
  match = null;
  endTutorial();
  useRules(GAME_RULES);
  screens.menu(profile, grimoire);
  refreshStory();
  // De vuelta en el menú (al terminar una partida o el tutorial): se respalda lo nuevo.
  void backup.sync();
}

/** La Historia de tu Linaje, armada la primera vez que se pide. */
function story(): StoryProgress | null {
  const school = profile.school;
  if (!school) return null;
  storyProgress ??= new StoryProgress(storyFor(school));
  return storyProgress;
}

/** En la tarjeta del menú: por dónde vas. */
function refreshStory(): void {
  const run = story();
  if (!run) {
    menu.setStory(null);
    return;
  }
  const beat = run.current;
  menu.setStory(
    run.finished ? 'Actos 1 y 2' : beat && beat.id !== 'preludio' ? `Acto ${beat.act}` : 'Empezar',
  );
}

/** Abre la Historia donde quedaste. */
function openStory(): void {
  if (!story()) return;
  enterImmersive();
  menu.visible = false;
  playStory();
}

/** Muestra lo que toca: una escena, la tarjeta del combate o el final de lo que hay. */
function playStory(): void {
  const run = story();
  if (!run) return;
  const beat = run.current;
  if (!beat || run.finished) storyScreen.showEnd();
  else if (beat.kind === 'scene') storyScreen.showScene(beat, run.wasSeen(beat.id));
  else storyScreen.showFight(beat, run.continuesLeft, STORY_CONTINUES);
}

/** Un combate de la Historia: contra la IA, con los personajes del guion. */
function startStoryFight(fight: StoryFight): void {
  startMatch({
    mode: fight.mode,
    deathRule: 'out',
    affinity: profile.affinity,
    botLevel: fight.botLevel,
    story: fight,
  });
}

/** Terminó un combate de la Historia: se guarda y se dice cómo sigue. */
function storyResult(won: boolean): ResultPath {
  const run = story();
  const beat = run?.current;
  const title = beat?.kind === 'fight' ? `Combate ${beat.number} · ${beat.title}` : 'Historia';
  if (!run || won) {
    run?.advance();
    return {
      title,
      passed: true,
      status: 'ganado',
      note: 'La historia sigue',
      again: 'Seguir',
      back: 'Menú',
    };
  }
  const loss = run.lose();
  if (loss.kind === 'retry') {
    return {
      title,
      passed: false,
      status: 'perdido',
      note:
        loss.left === 0
          ? 'Era tu última continuación: si vuelves a perder, empiezas el acto de nuevo'
          : `Te quedan ${loss.left} ${loss.left === 1 ? 'continuación' : 'continuaciones'}`,
      again: 'Reintentar',
      back: 'Menú',
    };
  }
  return {
    title,
    passed: false,
    status: 'perdido',
    note: `Se acabaron las continuaciones: vuelves al inicio del acto ${loss.act}`,
    again: 'Volver al acto',
    back: 'Menú',
  };
}

function openWardrobe(): void {
  menu.visible = false;
  wardrobe.show(profile);
  view.showPreview(ownLook(profile), rules);
}

function openGrimoire(): void {
  menu.visible = false;
  grimoireBook.show(grimoire, comboLog, profile.school ? schoolOf(profile.school) : null);
}

function closeOverlays(): void {
  wardrobe.hide();
  grimoireBook.hide();
  view.hidePreview();
  screens.refreshIdentity(profile, grimoire);
  void backup.sync();
  // Recién creado el hechicero (o un perfil de antes): falta elegir linaje.
  if (profile.name && !profile.school) {
    schoolPicker.show();
    return;
  }
  menu.visible = true;
  if (pendingInvite && profile.name) {
    const code = pendingInvite;
    pendingInvite = '';
    joinRoom(code);
  }
}

/**
 * Eligió linaje: queda para siempre y su elemento pasa a ser su Afinidad (en el Vestidor la
 * puede cambiar). Si nunca hizo el tutorial, entra directo; si venía de una invitación, a la sala.
 */
function chooseSchool(school: ElementId): void {
  profile = { ...profile, school, affinity: school };
  saveProfile(profile);
  screens.refreshIdentity(profile, grimoire);
  refreshStory();
  if (pendingInvite) {
    menu.visible = true;
    const code = pendingInvite;
    pendingInvite = '';
    joinRoom(code);
  } else if (tutorialProgress.count === 0 && !comboLog.tutorialDone) {
    startTraining({ chapter: 0, onlyOne: false });
  } else {
    menu.visible = true;
  }
}

function openLobby(): void {
  enterImmersive();
  menu.visible = false;
  lobby.showChoice(recentRoomCode());
}

// ---------- Partidas ----------

/** Contra la IA. */
function startMatch(options: MatchOptions): void {
  enterImmersive();
  const seed = (Math.random() * 2 ** 32) >>> 0;
  // En la Historia, el combate dice si es en la plaza o en la jungla.
  const arena = options.story?.arena;
  useRules(arena ? (arena === 'plaza' ? DUEL_RULES : GAME_RULES) : rulesForMode(options.mode));
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
  // En la Historia, cada personaje con su nombre; los maestros, además, con su cara.
  for (const [id, seat] of current.seats) {
    const before = others.get(id);
    const master = seat.master && seat.school ? masterOf(seat.school) : null;
    const face = master ? ARCHETYPES.find((a) => a.id === master.archetype)?.look : undefined;
    // Un personaje con nombre se ve siempre igual: su aspecto sale de su nombre.
    const look =
      face ?? (seat.name ? randomAppearance(new SeededRng(nameSeed(seat.name))) : undefined);
    others.set(id, {
      name: seat.name || (before?.name ?? 'Hechicero'),
      look: look ?? before?.look ?? profile.look,
    });
  }
  beginMatch(current, (id) => others.get(id) ?? { name: 'Hechicero', look: profile.look });
}

/** Una semilla fija a partir de un nombre. */
function nameSeed(name: string): number {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  return hash >>> 0;
}

/**
 * El modo entrenamiento: tú contra un muñeco, con el panel de lo que estás tejiendo. Con
 * `lesson`, la tarjeta del tutorial guía paso a paso desde ese capítulo (o solo ese) y los
 * elementos descansan.
 */
function startTraining(lesson?: { readonly chapter: number; readonly onlyOne: boolean }): void {
  enterImmersive();
  useRules(rulesForMode({ kind: 'duel' }));
  const current = new TrainingMatch(rules, human, profile.affinity);
  useRules(current.rules);
  beginMatch(current, (id) => ({
    name: id === SECOND_DUMMY_ID ? 'Otro muñeco' : 'Muñeco',
    look: { ...DEFAULT_LOOK, robe: 'hueso', headwear: 'ninguno', face: 'automata' },
  }));
  trainingPanel.visible = true;
  if (lesson) {
    current.restless = false;
    trainingPanel.tutorial = true;
    const school = profile.school ?? 'brasa';
    tutorial = new Tutorial(
      current.playerId,
      DUMMY_ID,
      tutorialChapters(school),
      lesson.chapter,
      lesson.onlyOne,
    );
    current.examSpellbook = schoolSpellbook(examSchool(school).element);
    current.setDummy(tutorial.dummy);
    current.setSecondDummy(tutorial.secondDummy);
    tutorialCard.show(tutorial);
  }
  showTutorialHud();
  obstacles.invalidate();
}

/** Terminado el tutorial, seguir practicando con el mismo muñeco (otra vez quieto). */
function freePlay(): void {
  endTutorial();
  trainingPanel.tutorial = false;
  if (match instanceof TrainingMatch) {
    match.restless = true;
    match.setDummy('idle');
    match.setSecondDummy(false);
  }
}

/**
 * Después de que el tutorial avanzó: guarda los capítulos terminados, entrega los 3 combos al
 * cerrar el capítulo de combos y le dice al muñeco qué hacer ahora.
 */
function afterTutorialAdvance(): void {
  if (!tutorial) return;
  for (const chapterId of tutorial.finished) {
    if (tutorialProgress.has(chapterId)) continue;
    tutorialProgress.add(chapterId);
    const gift = profile.school ? schoolOf(profile.school).combo : null;
    if (chapterId === GIFT_CHAPTER && gift && !comboLog.isGifted(gift)) {
      comboLog.gift(gift);
      audio.discover();
    }
  }
  if (match instanceof TrainingMatch) {
    match.setDummy(tutorial.dummy);
    match.setSecondDummy(tutorial.secondDummy);
  }
  showTutorialHud();
}

/** La barra de botones que deja ver el tutorial y el botón que brilla (sin tutorial: todo). */
function showTutorialHud(): void {
  controls.reveal(tutorial?.hud ?? null, tutorial?.glow ?? null);
}

/** Cumpliste un paso del tutorial jugando: un ✓ y una campanita. */
function stepDone(): void {
  tutorialCard.celebrate();
  audio.stepDone();
}

function endTutorial(): void {
  tutorial = null;
  tutorialCard.hide();
  showTutorialHud();
}

/** Empieza (o reempieza) una partida en red: los nombres y el aspecto vienen de la sala. */
function startNetMatch(current: NetMatch): void {
  useRules(current.rules);
  const info = (id: number): PlayerInfo | undefined => current.roster.find((p) => p.id === id);
  beginMatch(current, (id) => ({
    name: info(id)?.name ?? 'Rival',
    look: info(id)?.look ?? profile.look,
  }));
}

/** Prepara la pantalla para una partida: magos, nombres, colores y HUD. */
function beginMatch(current: MatchView, other: OtherWizard): void {
  backGuard.arm();
  stopReplay(false);
  lastReplay = null;
  match = current;
  matchCount++;
  view.effects.playerId = current.playerId;
  view.effects.ownCastShown = current === net;
  const cast = castOf(current, profile, other);
  badges = cast.badges;
  view.wizardLooks.clear();
  for (const [id, look] of cast.looks) view.wizardLooks.set(id, look);
  matchRenderer.setWizards(cast.looks, rules);
  view.clearSpells();
  labels.reset(badges, current.playerId);
  hitFeedback.reset();
  flow.begin();
  // Una sala sin Presagio no muestra ninguno.
  if (current.omen.id === NO_OMEN.id) hud.setOmen(null);
  else hud.setOmen(current.omen.name, current.omen.description);
  hud.setPlayerName(profile.name);
  screens.match(current instanceof TrainingMatch, current === net);
  // Los sombreadores de todos los hechizos, sin bloquear (si ya estaban, no hace nada).
  void view.warmUp();
  resolution.restart();
  autoQuality.restart();
  diagnostics.matchStarted(resolution.pixelRatio, quality, screenCap.capped);
  capNoticeAt = elapsed + CAP_NOTICE_DELAY_S;
}

/** El botón Revancha del resultado: en red se pide a la sala; contra la IA, empieza otra. */
function rematch(): void {
  if (net) {
    // El resultado queda a la vista con el botón en espera: Menú sigue a mano si el otro se fue.
    net.requestRematch();
  } else if (match?.options.story) {
    // En la Historia, Revancha dice "Seguir" o "Reintentar": se vuelve a la Historia.
    showMenu();
    openStory();
  } else startMatch(match?.options ?? menu.options);
}

/**
 * Entra a una sala (nueva o de un amigo) y espera a que empiece. Los ajustes (modo, tiempo,
 * rondas…) los elige en la sala quien la creó, a la vista de todos.
 */
/**
 * Partida rápida: el servidor de salas dice a qué sala pública ir (una que espera gente, una en
 * su primera ronda con un mago de la IA libre, o una nueva). Si no responde, se juega lo mismo
 * contra la IA.
 */
async function quickMatch(): Promise<void> {
  enterImmersive();
  menu.visible = false;
  lobby.showRoom('', true);
  lobby.setStatus('Buscando partida…');
  try {
    const roomCode = await findQuickRoom();
    // Si volvió al menú mientras se buscaba, no se lo saca de ahí.
    if (!lobby.visible) return;
    joinRoom(roomCode, true);
  } catch {
    if (!lobby.visible) return;
    lobby.hide();
    startMatch({
      mode: QUICK_ROOM_SETTINGS.mode,
      deathRule: 'out',
      affinity: profile.affinity,
      botLevel: QUICK_ROOM_SETTINGS.botLevel,
    });
    hud.announce('No pudimos conectar con el servidor', 'Juegas contra la IA', 3);
  }
}

/**
 * Pide sala de Partida rápida: primero a Santiago y, si no contesta o está lleno, a Cloudflare
 * (ver net/serverUrl.ts).
 */
async function findQuickRoom(): Promise<string> {
  for (const url of await quickMatchUrls()) {
    try {
      const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) });
      const { roomCode } = (await response.json()) as { roomCode?: unknown };
      if (typeof roomCode === 'string' && isValidRoomCode(roomCode)) return roomCode;
    } catch {
      // Se prueba el siguiente.
    }
  }
  throw new Error('Sin sala');
}

/** Crea una sala para invitar amigos, en el servidor que la pueda recibir ahora. */
async function createRoom(): Promise<void> {
  joinRoom(randomRoomCode(Math.random, await newRoomServer()));
}

/** Cuántas veces se pidió entrar a una sala: si pide otra mientras se elige servidor, gana esa. */
let joinAttempt = 0;

function joinRoom(code: string, quick = false): void {
  net?.close();
  net = null;
  menu.visible = false;
  lobby.showRoom(code, quick);
  history.replaceState(null, '', `?sala=${code}`);
  backGuard.arm();
  const attempt = ++joinAttempt;
  void chooseRoomServer(code).then(() => {
    // Volvió al menú o entró a otra sala mientras tanto.
    if (attempt !== joinAttempt || !lobby.visible) return;
    connectRoom(code, quick);
  });
}

function connectRoom(code: string, quick: boolean): void {
  net = openRoom(
    code,
    {
      name: profile.name || 'Hechicero',
      look: profile.look,
      affinity: profile.affinity,
      ...(quick ? { quick: true } : {}),
    },
    {
      lobby,
      hud,
      diagnostics,
      human,
      current: () => net,
      playing: () => match !== null,
      onStart: startNetMatch,
    },
  );
}

/** Qué se está jugando, para el registro de errores ("red #2 · free4 · ronda 3"). */
function describeMatch(): string {
  const current = match;
  if (!current) return net ? 'sala de espera' : 'menú';
  const where = current === net ? 'red' : current instanceof TrainingMatch ? 'entrenamiento' : 'IA';
  const mode = current.options.mode;
  const label =
    mode.kind === 'duel'
      ? '1v1'
      : mode.kind === 'teams'
        ? `${mode.size}v${mode.size}`
        : `libre ${mode.players}`;
  return `${where} #${matchCount} · ${label} · ronda ${current.roundNumber}`;
}

// ---------- Bucle ----------

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
/** Tope de cuadros por segundo: menos calor y batería sin que se note. */
const limiter = new FrameLimiter();
let lastFrame = performance.now();
let elapsed = 0;
let lastAlpha = 1;
/** Si el celular frena la pantalla a 30 cuadros por segundo (Modo de bajo consumo). */
const screenCap = new ScreenCap();
/** El aviso del bajo consumo sale una vez por visita, pasado el anuncio de la ronda. */
const CAP_NOTICE_DELAY_S = 5;
let capNoticeAt = Number.POSITIVE_INFINITY;
let capNoticeShown = false;

/** Dibuja la partida en curso con lo que cambia de partida en partida. */
function renderMatch(current: MatchView, alpha: number, delta: number): void {
  matchRenderer.render(current, alpha, delta, {
    rules,
    badges,
    covered: flow.finished || glyphPicker.isOpen,
  });
}

/** Si lo que mandó tu dedo es jugar: moverte, tejer o lanzar (no quedarse quieto). */
function playing(intent: Intent): boolean {
  return intent.kind === 'move' ? intent.x !== 0 || intent.z !== 0 : intent.kind !== 'lockTarget';
}

/** Avanza la partida un paso fijo y reparte lo que pasó a quien lo muestra o lo hace sonar. */
function stepMatch(current: MatchView): void {
  const events = current.step();
  view.effects.onEvents(events, current.state, (id) => view.creatures.positionOf(id));
  flow.announce(events, current, badges, rules);
  audio.onEvents(events, current.state);
  if (damageNumbers || current instanceof TrainingMatch) {
    hitFeedback.onStep(events, current.state, current.playerId);
  }
  for (const event of events) {
    if (event.type === 'combo') comboCallouts.show(event.combo, event.targetId);
    if (event.type === 'clash') comboCallouts.showClash(event.pos, event.survivorId !== null);
  }
  if (current instanceof TrainingMatch && tutorial && !tutorial.done) {
    // Al empezar a jugar, la guía se recoge a una línea para dejar ver la partida.
    if (current.lastIntents.some(playing)) tutorialCard.collapse();
    if (tutorial.onStep(events, current.state, current.lastIntents)) {
      stepDone();
      afterTutorialAdvance();
      tutorialCard.render();
    } else if (tutorialCard.refreshProgress()) {
      // Te trabaste: brilla el botón que toca.
      showTutorialHud();
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

renderer.setAnimationLoop((now) => {
  // Fuera de la partida en vivo (menús, pausa contra la IA, resultado) basta la mitad.
  // La repetición se ve como la partida: a cuadros completos.
  const live = match !== null && !(paused && match !== net) && (!flow.finished || replay !== null);
  const due = limiter.ready(now, live ? PLAY_FPS : CALM_FPS);
  // En los menús el juego casi no trabaja: si la pantalla igual llama cada 33 ms, la frena el
  // celular (ver render/ScreenCap.ts).
  if (match === null) screenCap.sample(limiter.screenIntervalMs);
  if (!due) return;
  let simMs = 0;
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  diagnostics.beginFrame(frameMs);
  // Con el tope de los menús los cuadros son largos a propósito: no cuentan como lentitud.
  // Con el celular frenado a 30, ir a 30 es ir a tope: no se baja nitidez por eso.
  const judgedMs = screenCap.judged(frameMs);
  const newRatio = live ? resolution.sample(judgedMs) : null;
  if (newRatio !== null) {
    view.resize();
    diagnostics.resolutionChanged(newRatio);
  }
  if (live && quality === 'alta' && autoQuality.sample(judgedMs, resolution.canLower)) {
    setQuality('liviana');
    pauseMenu.setLightGraphics(true);
    hud.announce('Gráficos livianos', 'Tu celular iba lento: se cambia en Pausa', 2.6);
  }
  const delta = frameMs / 1000;
  elapsed += delta;
  if (live && screenCap.capped && !capNoticeShown && elapsed >= capNoticeAt) {
    capNoticeShown = true;
    hud.announce(
      'Tu celular va a 30 cuadros',
      '¿Modo de bajo consumo? Apágalo para ir más fluido',
      4,
    );
  }

  const current = match;
  // En red, entre el aviso de partida nueva (una revancha) y su primer estado no hay magos:
  // no hay nada que anunciar ni dibujar todavía. Un Samsung se caía justo ahí.
  const ready = current !== null && current.state.wizards.length > 0;
  const pausedHere = paused && current !== null && current !== net;
  if (current && pausedHere) {
    if (ready) renderMatch(current, lastAlpha, 0);
  } else if (current) {
    const { steps, alpha } = clock.advance(frameMs);
    const simStart = performance.now();
    lastAlpha = alpha;
    for (let i = 0; i < steps; i++) {
      stepMatch(current);
      if (replay) stepReplay(replay);
    }
    simMs = performance.now() - simStart;
    if (current.state.wizards.length > 0) {
      flow.update(current, badges, rules);
      renderMatch(replay ?? current, alpha, delta);
    }
    if (replay) {
      replayOverlay.setProgress(replay.progress);
      if (replay.done) stopReplay(true);
    }
  } else if (view.previewing) {
    view.updatePreview(elapsed, delta, rules, wardrobe.stageWidth);
    view.zone.update(rules.arenaRadius, elapsed);
  } else {
    rig.orbit(elapsed, delta);
    view.zone.update(rules.arenaRadius, elapsed);
  }

  view.render(
    elapsed,
    delta,
    pausedHere ? 0 : delta,
    current && current.state.wizards.length > 0 ? (replay ?? current).player.pos : null,
  );
  if (current && !pausedHere && !flow.finished) {
    const moment =
      current.stage.kind === 'playing'
        ? PHASE_NAMES[roundPhase(current.state.tick, rules)]
        : 'Entre rondas';
    diagnostics.matchFrame(frameMs, simMs, view.load, moment);
    diagnostics.screenRate(limiter.screenIntervalMs);
  }
  // Tu mago en la tarjeta del menú, encima de la arena, solo mientras el menú está a la vista.
  const portraitRect = menu.portraitRect;
  if (portraitRect) menuPortrait.render(renderer, portraitRect, elapsed, delta);
});

// ---------- Inicio ----------

// Un enlace de invitación (…?sala=K7QF) entra directo a la sala del amigo. Se lee antes de
// mostrar el menú, que limpia la dirección: antes se leía después y el enlace no servía.
// Sin invitación, si la página se recargó o cerró en plena partida, se vuelve a esa sala.
const invited =
  new URLSearchParams(location.search).get('sala')?.toUpperCase() || roomToRejoin() || '';
warmUpRooms();
showMenu();
// La primera vez eliges nombre y personaje, y después tu linaje (también los perfiles de antes).
if (!profile.name) openWardrobe();
else if (!profile.school) {
  menu.visible = false;
  schoolPicker.show();
}
if (isValidRoomCode(invited)) {
  if (profile.name && profile.school) joinRoom(invited);
  else pendingInvite = invited;
}

// Solo en desarrollo: acceso a la partida desde la consola para probar pantallas.
if (import.meta.env.DEV) {
  Object.assign(window, { crisol: { match: () => match, replay: () => replay, view } });
}
