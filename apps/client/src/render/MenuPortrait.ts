import { createMatch, type GameRules, type Wizard } from '@crisol/core';
import * as THREE from 'three';
import { type WizardLook, WizardView } from './WizardView';

/**
 * Tu mago en la tarjeta del menú: una escena aparte, con su propia luz de estudio, que se
 * dibuja encima de la arena solo en el recuadro de la tarjeta. Así se ve exactamente como
 * lo vestiste, sin un retrato pintado aparte.
 */
export class MenuPortrait {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 0.7, 0.1, 30);
  private view: WizardView | null = null;
  private wizard: Wizard | null = null;
  private lookKey = '';
  private readonly backdrop = new THREE.Color('#0d0b14');

  constructor(private readonly rules: GameRules) {
    this.scene.add(new THREE.HemisphereLight('#a9b2e0', '#2a2018', 2.4));
    const key = new THREE.DirectionalLight('#ffe2bd', 3.6);
    key.position.set(-2, 3, 3);
    const rim = new THREE.DirectionalLight('#9fb6ff', 2.2);
    rim.position.set(2, 2.5, -3);
    this.scene.add(key, rim);
    this.camera.position.set(0, 1.25, 5.4);
    this.camera.lookAt(0, 1.0, 0);
  }

  setLook(look: WizardLook): void {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.view?.dispose();
    const state = createMatch(
      { seed: 1, deathRule: 'out', wizards: [{ team: 0, spawn: { x: 0, z: 0 } }] },
      this.rules,
    );
    this.wizard = state.wizards[0] ?? null;
    this.view = new WizardView(look, this.rules, null);
    this.scene.add(this.view.group);
  }

  /** Dibuja el mago en el recuadro `rect` (en píxeles CSS de la ventana). */
  render(
    renderer: THREE.WebGLRenderer,
    rect: DOMRect,
    timeSeconds: number,
    deltaSeconds: number,
  ): void {
    const view = this.view;
    const wizard = this.wizard;
    if (!view || !wizard || rect.width < 2 || rect.height < 2) return;
    view.update(wizard, 0, 0, timeSeconds, deltaSeconds, false, this.rules);
    // Gira despacio para lucir la ropa por todos lados.
    view.group.rotation.y = Math.sin(timeSeconds * 0.35) * 0.9;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();

    const height = renderer.domElement.clientHeight;
    const y = height - rect.bottom;
    const previousClear = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setScissorTest(true);
    renderer.setScissor(rect.left, y, rect.width, rect.height);
    renderer.setViewport(rect.left, y, rect.width, rect.height);
    renderer.setClearColor(this.backdrop, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, renderer.domElement.clientWidth, height);
    renderer.setClearColor(previousClear, previousAlpha);
  }
}
