import { GAME_RULES } from '@crisol/content';
import { FixedStepClock, TICK_MS } from '@crisol/core';
import * as THREE from 'three';
import { CameraRig } from './camera/cameraRigs';
import { LocalDuel } from './game/LocalDuel';
import { blockBrowserGestures } from './input/blockBrowserGestures';
import { HumanController } from './input/HumanController';
import { PlayerInput } from './input/PlayerInput';
import { TouchControls } from './input/TouchControls';
import { AimGuide } from './render/AimGuide';
import { createArenaScene } from './render/createArenaScene';
import { EffectsView } from './render/EffectsView';
import { SpellViews } from './render/SpellViews';
import { WizardView } from './render/WizardView';
import { Hud } from './ui/Hud';

const rules = GAME_RULES;
const canvas = document.querySelector<HTMLCanvasElement>('#game');
blockBrowserGestures();

const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) {
  throw new Error('Faltan el canvas o la capa de interfaz');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = createArenaScene(rules.arenaRadius);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
const rig = new CameraRig(camera);

const input = new PlayerInput();
const human = new HumanController(input, (screen) => rig.screenToGround(screen.right, screen.up));
const newSeed = (): number => (Math.random() * 2 ** 32) >>> 0;
const duel = new LocalDuel(rules, human, newSeed());

const toggleCamera = (): void => hud.setCamera(rig.toggle());
const hud = new Hud(uiRoot, toggleCamera, () => {
  duel.restart(newSeed());
  hud.hideResult();
});
hud.setCamera(rig.mode);
const controls = new TouchControls(uiRoot, input, toggleCamera);

const playerView = new WizardView(true, rules);
const rivalView = new WizardView(false, rules);
scene.add(playerView.group, rivalView.group);
const spells = new SpellViews(scene, rules);
const effects = new EffectsView(scene);
const aimGuide = new AimGuide();
scene.add(aimGuide.mesh);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // En vertical se abre el ángulo para no perder de vista al rival.
  camera.fov = width < height ? 75 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
let lastFrame = performance.now();
let resultShown = false;

renderer.setAnimationLoop((now) => {
  const frameMs = Math.min(now - lastFrame, 250);
  lastFrame = now;
  const { steps, alpha } = clock.advance(frameMs);
  for (let i = 0; i < steps; i++) {
    const events = duel.step();
    effects.onEvents(events, duel.state);
    if (events.some((e) => e.type === 'cast' && e.wizardId === duel.player.id)) hud.hideHint();
  }

  const state = duel.state;
  if (state.winnerTeam === null) {
    resultShown = false;
  } else if (!resultShown) {
    resultShown = true;
    hud.showResult(state.winnerTeam, duel.player.team);
  }

  const time = ((state.tick + alpha) * TICK_MS) / 1000;
  const player = duel.player;
  const rival = duel.rival;
  const playerPos = duel.interpolated(player.id, player.pos, alpha);
  const rivalPos = duel.interpolated(rival.id, rival.pos, alpha);
  playerView.update(player, playerPos.x, playerPos.z, time, rules);
  rivalView.update(rival, rivalPos.x, rivalPos.z, time, rules);
  spells.sync(
    state.spells,
    (spell) =>
      spell.kind === 'projectile' ? duel.interpolated(spell.id, spell.pos, alpha) : { x: 0, z: 0 },
    time,
  );
  effects.update(frameMs / 1000);

  rig.update(playerPos, rival.hp > 0 ? rivalPos : null, frameMs / 1000);
  const aim = input.aimPreview;
  aimGuide.update(playerPos, aim ? rig.screenToGround(aim.right, aim.up) : null);

  controls.render(player, rules);
  hud.update(player, rival, rules);
  renderer.render(scene, camera);
});
