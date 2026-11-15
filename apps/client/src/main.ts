import {
  DEFAULT_LOOK,
  GAME_RULES,
  NO_OMEN,
  rulesForMode,
  schoolOf,
  schoolSpellbook,
  WIZARD_NAMES,
} from '@crisol/content';
import {
  type ElementId,
  FixedStepClock,
  type GameRules,
  type Intent,
  SeededRng,
} from '@crisol/core';
import { isValidRoomCode, type PlayerInfo, randomRoomCode } from '@crisol/protocol';
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
import { Pocket } from './game/Pocket';
import { loadProfile, randomAppearance, saveProfile } from './game/Profile';
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
import { BackGuard } from './platform/BackGuard';
import { startErrorReports } from './platform/ErrorReporter';
import { adoptCarriedProgress } from './platform/homeScreen';
import { enterImmersive, ScreenAwake } from './platform/mobile';
import { AutoQuality } from './render/AutoQuality';
import { CALM_FPS, FrameLimiter, PLAY_FPS } from './render/FrameLimiter';
import { GameScene } from './render/GameScene';
import { MenuPortrait } from './render/MenuPortrait';
import { readQuality, saveQuality } from './render/Quality';
import { BlindVeil } from './ui/BlindVeil';
import { ComboCallouts } from './ui/ComboCallouts';
import { GlyphPicker } from './ui/GlyphPicker';
import { GrimoireBook } from './ui/GrimoireBook';
import { Hud, type WizardBadge } from './ui/Hud';
import { Lobby } from './ui/Lobby';
import { Menu } from './ui/Menu';
import { Minimap } from './ui/Minimap';
import { PauseMenu } from './ui/PauseMenu';
import { PocketStrip } from './ui/PocketStrip';
import { SchoolPicker } from './ui/SchoolPicker';
import { Screens } from './ui/Screens';
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
const pocket = new Pocket();
const obstacles = new UiObstacles(uiRoot);
const labels = new WorldLabels(uiRoot, obstacles);
const controls = new TouchControls(uiRoot, input);
const minimap = new Minimap(uiRoot, rules);
const menuPortrait = new MenuPortrait(rules);
const diagnostics = new Diagnostics(uiRoot, audio.engine, renderer);
const blindVeil = new BlindVeil(uiRoot);
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
  audio.engine,
);
const wardrobe = new Wardrobe(
  uiRoot,
  (draft) => view.showPreview(ownLook(draft), rules),
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
const schoolPicker = new SchoolPicker(uiRoot, (school) => chooseSchool(school));
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
  () => joinRoom(randomRoomCode(Math.random)),
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
  school: () => profile.school,
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
  match = null;
  endTutorial();
  useRules(GAME_RULES);
  screens.menu(profile, grimoire);
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
  resolution.restart();
  autoQuality.restart();
  diagnostics.matchStarted(resolution.pixelRatio, quality);
}

/** El botón Revancha del resultado: en red se pide a la sala; contra la IA, empieza otra. */
function rematch(): void {
  if (net) {
    // El resultado queda a la vista con el botón en espera: Menú sigue a mano si el otro se fue.
    net.requestRematch();
  } else startMatch(match?.options ?? menu.options);
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
  backGuard.arm();
  net = openRoom(
    code,
    { name: profile.name || 'Hechicero', look: profile.look, affinity: profile.affinity },
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
  const live = match !== null && !(paused && match !== net) && !flow.finished;
  if (!limiter.ready(now, live ? PLAY_FPS : CALM_FPS)) return;
  let simMs = 0;
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  diagnostics.beginFrame(frameMs);
  // Con el tope de los menús los cuadros son largos a propósito: no cuentan como lentitud.
  const newRatio = live ? resolution.sample(frameMs) : null;
  if (newRatio !== null) {
    view.resize();
    diagnostics.resolutionChanged(newRatio);
  }
  if (live && quality === 'alta' && autoQuality.sample(frameMs, resolution.canLower)) {
    setQuality('liviana');
    pauseMenu.setLightGraphics(true);
    hud.announce('Gráficos livianos', 'Tu celular iba lento: se cambia en Pausa', 2.6);
  }
  const delta = frameMs / 1000;
  elapsed += delta;

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
    for (let i = 0; i < steps; i++) stepMatch(current);
    simMs = performance.now() - simStart;
    if (current.state.wizards.length > 0) {
      flow.update(current, badges, rules);
      renderMatch(current, alpha, delta);
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
    current && current.state.wizards.length > 0 ? current.player.pos : null,
  );
  if (current && !pausedHere && !flow.finished) diagnostics.matchFrame(frameMs, simMs, view.load);
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
  Object.assign(window, { crisol: { match: () => match } });
}
