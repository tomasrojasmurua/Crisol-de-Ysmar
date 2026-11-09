import { GAME_RULES, WIZARD_NAMES } from '@crisol/content';
import {
  currentTarget,
  FixedStepClock,
  type GameEvent,
  isSpectre,
  SeededRng,
  TICK_MS,
} from '@crisol/core';
import * as THREE from 'three';
import { CameraRig } from './camera/CameraRig';
import { LocalMatch, type MatchOptions, PLAYER_ID } from './game/LocalMatch';
import { blockBrowserGestures } from './input/blockBrowserGestures';
import { HumanController } from './input/HumanController';
import { PlayerInput } from './input/PlayerInput';
import { TouchControls } from './input/TouchControls';
import { AimGuide } from './render/AimGuide';
import { ArenaView } from './render/arena/ArenaView';
import { ZoneView } from './render/arena/ZoneView';
import { EffectsView } from './render/EffectsView';
import { Particles } from './render/Particles';
import { teamColorHex } from './render/palette';
import { PostProcessing } from './render/postprocessing';
import { SpellViews } from './render/SpellViews';
import { TargetMarker } from './render/TargetMarker';
import { WizardView } from './render/WizardView';
import { Hud, type WizardBadge } from './ui/Hud';
import { Menu } from './ui/Menu';
import { WorldLabels } from './ui/WorldLabels';

const rules = GAME_RULES;
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
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const particles = new Particles();
const arena = new ArenaView(rules.arenaRadius, particles);
const scene = arena.scene;
scene.add(particles.points);
const zone = new ZoneView(rules.arenaRadius);
scene.add(zone.group);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
const rig = new CameraRig(camera);
const post = new PostProcessing(renderer, scene, camera);
const spells = new SpellViews(scene, rules, particles);
const effects = new EffectsView(scene, particles, PLAYER_ID);
const aimGuide = new AimGuide();
scene.add(aimGuide.mesh);
const targetMarker = new TargetMarker('#f3dfb0');
scene.add(targetMarker.group);

// ---------- Interfaz ----------

const input = new PlayerInput();
const human = new HumanController(input, (screen) => rig.screenToGround(screen.right, screen.up));
const labels = new WorldLabels(uiRoot);
const controls = new TouchControls(uiRoot, input);
const hud = new Hud(
  uiRoot,
  () => startMatch(match?.options ?? menu.options),
  () => showMenu(),
);
const menu = new Menu(uiRoot, (options) => startMatch(options));

const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
let match: LocalMatch | null = null;
const wizardViews = new Map<number, WizardView>();
let badges = new Map<number, WizardBadge>();
let shownRound = 0;
let resultShown = false;

function showMenu(): void {
  match = null;
  targetMarker.update(null, 0);
  clearWizards();
  spells.sync([], () => ({ x: 0, z: 0 }), 0);
  menu.visible = true;
  hud.visible = false;
  labels.visible = false;
  controls.visible = false;
  hud.hideResult();
}

function startMatch(options: MatchOptions): void {
  const seed = (Math.random() * 2 ** 32) >>> 0;
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
      ? 'Tú'
      : (names.splice(rng.int(0, names.length - 1), 1)[0] ?? 'Hechicero');
    badges.set(wizard.id, { name, color: teamColorHex(wizard.team, player.team, isPlayer, ffa) });
  }

  clearWizards();
  for (const wizard of current.state.wizards) {
    const view = new WizardView(
      { teamColor: badges.get(wizard.id)?.color ?? '#ffffff', isPlayer: wizard.id === PLAYER_ID },
      rules,
    );
    scene.add(view.group);
    wizardViews.set(wizard.id, view);
  }
  spells.sync([], () => ({ x: 0, z: 0 }), 0);
  labels.reset(badges, PLAYER_ID);
  menu.visible = false;
  hud.visible = true;
  hud.hideResult();
  labels.visible = true;
  controls.visible = true;
  shownRound = 0;
  resultShown = false;
  rig.snap();
}

function clearWizards(): void {
  for (const view of wizardViews.values()) view.dispose();
  wizardViews.clear();
}

/** Avisos de la partida según lo que pasó en el paso. */
function announceEvents(events: readonly GameEvent[], current: LocalMatch): void {
  for (const event of events) {
    if (event.type === 'phase') {
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

function updateMatchFlow(current: LocalMatch): void {
  const playerTeam = current.player.team;
  const stage = current.stage;
  if (stage.kind === 'playing' && current.roundNumber !== shownRound) {
    shownRound = current.roundNumber;
    hud.reset(current.state, current.player, badges);
    rig.snap();
    hud.announce(`Ronda ${shownRound}`, 'Caza: la arena está abierta');
  }
  if (stage.kind === 'intermission' && stage.ticksLeft === INTERMISSION_ANNOUNCE_TICK) {
    const winner = stage.roundWinner;
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
      effects.onEvents(events, current.state);
      announceEvents(events, current);
    }
    updateMatchFlow(current);
    renderMatch(current, alpha, delta);
  } else {
    rig.orbit(elapsed, delta);
    zone.update(rules.arenaRadius, elapsed);
  }

  arena.update(elapsed, delta);
  effects.update(delta);
  particles.update(delta);
  post.render();
});

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
    view.update(wizard, pos.x, pos.z, time, delta, spectre, rules);
    effects.aura(wizard, pos.x, pos.z, spectre, delta);
  }
  spells.sync(
    state.spells,
    (spell) =>
      spell.kind === 'projectile'
        ? current.interpolated(spell.id, spell.pos, alpha)
        : { x: 0, z: 0 },
    time,
  );
  zone.update(state.zoneRadius, time);

  const target = currentTarget(state, player);
  const targetPos = target ? current.interpolated(target.id, target.pos, alpha) : null;
  rig.update(playerPos, targetPos, delta, effects.shake);
  targetMarker.update(player.hp > 0 ? targetPos : null, time);
  const aim = input.aimPreview;
  aimGuide.update(playerPos, aim && player.hp > 0 ? rig.screenToGround(aim.right, aim.up) : null);

  controls.render(player, rules, isSpectre(state, player));
  hud.update(state, player, current.series, current.roundNumber, badges, rules);
  labels.update(
    state,
    (id, pos) => current.interpolated(id, pos, alpha),
    camera,
    player.team,
    badges,
    rules,
  );
}

showMenu();
