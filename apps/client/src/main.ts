import {
  DEFAULT_LOOK,
  GAME_RULES,
  NO_OMEN,
  ROBE_COLORS,
  rulesForMode,
  SKIN_TONES,
  TRIM_COLORS,
  WIZARD_NAMES,
} from '@crisol/content';
import { type ElementId, FixedStepClock, type GameRules, SeededRng } from '@crisol/core';
import { isValidRoomCode, type PlayerInfo, randomRoomCode } from '@crisol/protocol';
import { GameAudio } from './audio/GameAudio';
import { type CameraMode, readCameraMode, saveCameraMode } from './camera/CameraMode';
import { Diagnostics } from './game/Diagnostics';
import { Grimoire } from './game/Grimoire';
import { LocalMatch, type MatchOptions, PLAYER_ID } from './game/LocalMatch';
import { MatchFlow } from './game/MatchFlow';
import { MatchRenderer } from './game/MatchRenderer';
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
import { TapToLock } from './input/TapToLock';
import { TouchControls } from './input/TouchControls';
import { leftRoom, recentRoomCode, rememberRoom, roomToRejoin } from './net/lastRoom';
import { NetMatch } from './net/NetMatch';
import { enterImmersive, ScreenAwake } from './platform/mobile';
import { GameScene } from './render/GameScene';
import { MenuPortrait } from './render/MenuPortrait';
import { teamColorHex } from './render/palette';
import { readQuality, saveQuality } from './render/Quality';
import type { WizardLook } from './render/WizardView';
import { BlindVeil } from './ui/BlindVeil';
import { ComboCallouts } from './ui/ComboCallouts';
import { GlyphPicker } from './ui/GlyphPicker';
import { GrimoireBook } from './ui/GrimoireBook';
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

const view = new GameScene(canvas, rules, PLAYER_ID);
const { renderer, zone, camera, rig, creatures, effects, resolution, wizardLooks } = view;

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
const diagnostics = new Diagnostics(uiRoot, audio.engine, renderer);
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

let match: MatchView | null = null;
/** El duelo en red, si estás jugando con un amigo. */
let net: NetMatch | null = null;
/** Con la pausa abierta contra la IA, la partida se detiene; en red sigue corriendo. */
let paused = false;
let lastAlpha = 1;
let quality = readQuality();
view.applyQuality(quality);

// ---------- Modos de cámara (de prueba, se eligen en Pausa) ----------

let cameraMode: CameraMode = readCameraMode();
const matchRenderer = new MatchRenderer(
  uiRoot,
  view,
  { hud, labels, minimap, controls, blindVeil, comboCallouts, obstacles },
  audio,
  input,
);
matchRenderer.cameraMode = cameraMode;
const flow = new MatchFlow({
  view,
  hud,
  audio,
  minimap,
  controls,
  glyphPicker,
  grimoire,
  renderer: matchRenderer,
  diagnostics,
});
// Cámara asistida: disparar sin arrastrar centra la cámara un rato en el blanco.
input.onAction((action) => {
  if (action.type === 'cast' && !action.aim && match) matchRenderer.autoCast(match, rules);
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
    onCameraMode: (mode) => {
      cameraMode = mode;
      saveCameraMode(mode);
      matchRenderer.cameraMode = mode;
    },
    onLightGraphics: (on) => {
      quality = on ? 'liviana' : 'alta';
      saveQuality(quality);
      view.applyQuality(quality);
      if (match) diagnostics.qualityChanged(quality);
    },
  },
  diagnostics.enabled,
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
let badges = new Map<number, WizardBadge>();

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

function showPreview(draft: Profile): void {
  view.showPreview(lookOf(draft.look, draft.affinity, '#e8d7a8', true), rules);
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
  view.hidePreview();
  menu.setIdentity(profile, grimoire.count, grimoire.total);
  menuPortrait.setLook(lookOf(profile.look, profile.affinity, '#e8d7a8', true));
  menu.visible = true;
  if (pendingInvite && profile.name) {
    const code = pendingInvite;
    pendingInvite = '';
    joinRoom(code);
  }
}

/** Cambia el mapa que se dibuja y el que usan el minimapa y la vista. */
function useRules(next: GameRules): void {
  rules = next;
  view.useRules(next);
  minimap.setRules(next);
}

function showMenu(): void {
  trainingPanel.visible = false;
  hud.training = false;
  screenAwake.active = false;
  // Salir a propósito de una sala: al recargar ya no se vuelve sola.
  if (net) leftRoom();
  net?.close();
  net = null;
  if (location.search) history.replaceState(null, '', location.pathname);
  lobby.hide();
  diagnostics.net = false;
  pauseMenu.setAvailable(false, false);
  paused = false;
  match = null;
  useRules(GAME_RULES);
  view.clearMatch();
  glyphPicker.hide();
  matchRenderer.clear();
  menu.visible = true;
  audio.setMood('menu');
  hud.visible = false;
  labels.visible = false;
  controls.visible = false;
  minimap.show(false);
  blindVeil.reset();
  comboCallouts.clear();
  cameraDrag.enabled = false;
  view.setLantern(false);
  hud.hideResult();
  wardrobe.hide();
  grimoireBook.hide();
  view.hidePreview();
  menu.setIdentity(profile, grimoire.count, grimoire.total);
  menuPortrait.setLook(lookOf(profile.look, profile.affinity, '#e8d7a8', true));
}

// ---------- El botón o gesto "atrás" del celular ----------

/**
 * En Android (y deslizando desde el borde en iPhone) "atrás" sacaba de la página en plena
 * partida. Mientras juegas o esperas en una sala hay una entrada de más en el historial: "atrás"
 * la gasta y abre la Pausa (en la sala de espera no hace nada). Para salir está el menú.
 */
let backGuard = false;
function guardBack(): void {
  if (backGuard) return;
  history.pushState({ crisol: 'juego' }, '');
  backGuard = true;
}
window.addEventListener('popstate', () => {
  if (!backGuard) return;
  backGuard = false;
  if (!match && !net) return;
  if (match && !pauseMenu.isOpen) pauseMenu.open();
  guardBack();
});

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
  diagnostics.net = true;
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
  guardBack();
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
  }
  matchRenderer.setWizards(wizardLooks, rules);
  view.clearSpells();
  labels.reset(badges, current.playerId);
  menu.visible = false;
  hud.visible = true;
  hud.hideResult();
  labels.visible = true;
  controls.visible = true;
  minimap.show(true);
  cameraDrag.enabled = true;
  view.setLantern(true);
  minimap.reset();
  flow.begin();
  // Una sala sin Presagio no muestra ninguno.
  if (current.omen.id === NO_OMEN.id) hud.setOmen(null);
  else hud.setOmen(current.omen.name, current.omen.description);
  hud.setPlayerName(profile.name);
  hud.training = current instanceof TrainingMatch;
  pauseMenu.training = current instanceof TrainingMatch;
  pauseMenu.setAvailable(true, current === net);
  screenAwake.active = true;
  resolution.restart();
  diagnostics.matchStarted(resolution.pixelRatio, quality);
  obstacles.invalidate();
  rig.snap();
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
  lobby.showChoice(recentRoomCode());
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
  rememberRoom(code);
  guardBack();
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
        startNetMatch(started);
      },
      problem: (reason, fatal) => {
        if (current !== net) return;
        if (fatal) leftRoom();
        if (lobby.visible) lobby.setStatus(reason);
        else hud.announce(reason, fatal ? '' : 'Tu mago sigue en manos de la IA', 3);
        if (fatal && !match) lobby.setStatus(reason);
      },
      notice: (text) => {
        if (current !== net) return;
        if (!lobby.visible) hud.announce(text, '', 1.6);
      },
      stats: (stats) => {
        // Sigues en la sala: si la página se cierra sin querer, se vuelve sola.
        if (current === net) rememberRoom(code);
        const simulated = stats.simulated ? ` · ${stats.simulated}` : '';
        diagnostics.netStats(
          `${stats.ping} ms · colchón ${stats.buffer}/${stats.target} · cortes ${stats.stalls} · ${stats.kbps} kB/s · máx ${stats.biggest} B${simulated}`,
        );
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

new TapToLock(canvas, camera, input, () => match);

// ---------- Tamaño ----------

window.addEventListener('resize', () => view.resize());

// ---------- Bucle ----------

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
let lastFrame = performance.now();
let elapsed = 0;

/** Dibuja la partida en curso con lo que cambia de partida en partida. */
function renderMatch(current: MatchView, alpha: number, delta: number): void {
  matchRenderer.render(current, alpha, delta, {
    rules,
    badges,
    covered: flow.finished || glyphPicker.isOpen,
  });
}

renderer.setAnimationLoop((now) => {
  let simMs = 0;
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  diagnostics.beginFrame(frameMs);
  const newRatio = resolution.sample(frameMs);
  if (newRatio !== null) {
    view.resize();
    diagnostics.resolutionChanged(newRatio);
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
      flow.announce(events, current, badges, rules);
      audio.onEvents(events, current.state);
      for (const event of events) {
        if (event.type === 'combo') comboCallouts.show(event.combo, event.targetId);
      }
      matchRenderer.onEvents(events, current);
      if (current instanceof TrainingMatch) {
        for (const event of events) {
          if (event.type === 'release' && event.wizardId === current.playerId) {
            trainingPanel.cast(event.spell, rules);
          }
        }
      }
    }
    simMs = performance.now() - simStart;
    flow.update(current, badges);
    renderMatch(current, alpha, delta);
  } else if (view.previewing) {
    view.updatePreview(elapsed, delta, rules);
    zone.update(rules.arenaRadius, elapsed);
  } else {
    rig.orbit(elapsed, delta);
    zone.update(rules.arenaRadius, elapsed);
  }

  view.render(elapsed, delta, simDelta, current ? current.player.pos : null);
  if (current && !pausedHere && !flow.finished) diagnostics.matchFrame(frameMs, simMs);
  // Tu mago en la tarjeta del menú, encima de la arena, solo mientras el menú está a la vista.
  const portraitRect = menu.portraitRect;
  if (portraitRect) menuPortrait.render(renderer, portraitRect, elapsed, delta);
});

// Un enlace de invitación (…?sala=K7QF) entra directo a la sala del amigo. Se lee antes de
// mostrar el menú, que limpia la dirección: antes se leía después y el enlace no servía.
// Sin invitación, si la página se recargó o cerró en plena partida, se vuelve a esa sala.
const invited =
  new URLSearchParams(location.search).get('sala')?.toUpperCase() || roomToRejoin() || '';
showMenu();
// La primera vez eliges nombre y personaje.
if (!profile.name) openWardrobe();
if (isValidRoomCode(invited)) {
  if (profile.name) joinRoom(invited);
  else pendingInvite = invited;
}

// Solo en desarrollo: acceso a la partida desde la consola para probar pantallas.
if (import.meta.env.DEV) {
  Object.assign(window, { crisol: { match: () => match } });
}
