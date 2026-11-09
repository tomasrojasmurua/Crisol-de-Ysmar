import { ELEMENTS } from '@crisol/content';
import { FixedStepClock, TICK_MS } from '@crisol/core';
import * as THREE from 'three';
import { createArenaScene } from './render/createArenaScene';
import { WeaveOrbs } from './render/weaveOrbs';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) {
  throw new Error('No se encontró el canvas del juego');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const { scene, wizard } = createArenaScene();
const orbs = new WeaveOrbs(ELEMENTS);
wizard.add(orbs.group);
orbs.group.position.y = -1;

// Cámara en tercera persona elevada, detrás del mago.
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 4.5, 6.5);
camera.lookAt(0, 1.2, 0);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// La simulación avanza en pasos fijos; el dibujo interpola entre ellos.
const clock = new FixedStepClock();
let tick = 0;
let lastFrame = performance.now();

renderer.setAnimationLoop((now) => {
  const { steps, alpha } = clock.advance(now - lastFrame);
  lastFrame = now;
  tick += steps;
  orbs.update(((tick + alpha) * TICK_MS) / 1000);
  renderer.render(scene, camera);
});
