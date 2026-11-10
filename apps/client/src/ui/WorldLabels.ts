import { ELEMENTS } from '@crisol/content';
import {
  type Beast,
  ELEMENT_IDS,
  type GameRules,
  isSpectre,
  type MatchState,
  TICK_RATE,
  type Vec2,
} from '@crisol/core';
import * as THREE from 'three';
import { el } from './dom';
import type { WizardBadge } from './Hud';
import type { UiObstacles } from './UiObstacles';

const elementHex = (id: string): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

const LABEL_HEIGHT = 2.55;
const BEAST_LABEL_RANGE = 26;
const EDGE_MARGIN = 28;
/** Medida aproximada de una etiqueta (nombre y barra), para esquivar la interfaz. */
const LABEL_WIDTH = 96;
const LABEL_HEIGHT_PX = 30;

interface Label {
  readonly root: HTMLElement;
  readonly name: HTMLElement;
  readonly fill: HTMLElement;
  readonly arrow: HTMLElement;
  /** Barómetro: cuánto le falta a cada elemento para descansar. */
  readonly fatigue?: HTMLElement;
  readonly fatigueBars?: readonly HTMLElement[];
}

/**
 * Nombre y vida sobre la cabeza de cada mago, y flechas en el borde de la pantalla
 * para los rivales que quedan fuera de vista.
 */
export class WorldLabels {
  private readonly layer: HTMLElement;
  private readonly labels = new Map<number, Label>();
  private readonly beastLabels = new Map<number, Label>();
  private readonly projected = new THREE.Vector3();

  constructor(
    parent: HTMLElement,
    private readonly obstacles: UiObstacles,
  ) {
    this.layer = el('div', 'world-labels');
    parent.append(this.layer);
  }

  reset(badges: ReadonlyMap<number, WizardBadge>, playerId: number): void {
    this.layer.replaceChildren();
    this.labels.clear();
    this.beastLabels.clear();
    for (const [id, badge] of badges) {
      if (id === playerId) continue;
      const root = el('div', 'world-label');
      root.style.setProperty('--team', badge.color);
      const name = el('span', 'world-label-name', badge.name);
      const bar = el('div', 'world-label-bar');
      const fill = el('div', 'world-label-fill');
      bar.append(fill);
      const fatigue = el('div', 'world-label-fatigue');
      const fatigueBars = ELEMENT_IDS.map((element) => {
        const slot = el('span', 'world-label-fatigue-slot');
        slot.style.setProperty('--element', elementHex(element));
        const level = el('span', 'world-label-fatigue-fill');
        slot.append(level);
        fatigue.append(slot);
        return level;
      });
      fatigue.hidden = true;
      root.append(name, bar, fatigue);
      const arrow = el('div', 'edge-arrow');
      arrow.style.setProperty('--team', badge.color);
      this.layer.append(root, arrow);
      this.labels.set(id, { root, name, fill, arrow, fatigue, fatigueBars });
    }
  }

  set visible(value: boolean) {
    this.layer.hidden = !value;
  }

  update(
    state: MatchState,
    positionOf: (id: number, current: Vec2) => Vec2,
    camera: THREE.Camera,
    playerTeam: number,
    badges: ReadonlyMap<number, WizardBadge>,
    rules: GameRules,
    seen: ReadonlySet<number>,
    /** Con el Barómetro se ve el cansancio de los rivales. */
    insight = false,
  ): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const wizard of state.wizards) {
      const label = this.labels.get(wizard.id);
      if (!label) continue;
      const pos = positionOf(wizard.id, wizard.pos);
      const spectre = isSpectre(state, wizard);
      const lift = spectre ? 0.4 : 0;
      this.projected.set(pos.x, LABEL_HEIGHT + lift, pos.z).project(camera);
      const behind = this.projected.z > 1;
      const x = ((this.projected.x + 1) / 2) * width;
      const y = ((1 - this.projected.y) / 2) * height;
      const onScreen = !behind && x > 0 && x < width && y > 0 && y < height;
      // A un rival escondido en la jungla no se le ve el nombre a través de los árboles.
      const hidden = wizard.team !== playerTeam && !seen.has(wizard.id);

      label.root.hidden = !onScreen || hidden;
      if (onScreen) {
        // Si el rival queda detrás del reloj, su nombre baja; si queda tras un botón, se aclara.
        const ly = this.obstacles.clearOfTop(x, y, LABEL_WIDTH, LABEL_HEIGHT_PX);
        label.root.style.transform = `translate(${x}px, ${ly}px) translate(-50%, -100%)`;
        label.root.classList.toggle(
          'under-controls',
          this.obstacles.coversControl(x, ly, LABEL_WIDTH, LABEL_HEIGHT_PX),
        );
        label.fill.style.width = `${(wizard.hp / wizard.maxHp) * 100}%`;
        label.root.classList.toggle('fallen', wizard.hp <= 0);
        const showFatigue = insight && wizard.team !== playerTeam && wizard.hp > 0;
        if (label.fatigue) label.fatigue.hidden = !showFatigue;
        const bars = label.fatigueBars;
        if (showFatigue && bars) {
          ELEMENT_IDS.forEach((element, i) => {
            const left = wizard.fatigue[element] / rules.weave.fatigueTicks;
            const bar = bars[i];
            if (bar) bar.style.height = `${Math.round((1 - Math.min(1, left)) * 100)}%`;
          });
        }
        const respawn = wizard.fallen?.respawnTicks;
        const badgeName = badges.get(wizard.id)?.name ?? '';
        label.name.textContent =
          respawn != null
            ? `${badgeName} · ${Math.ceil(respawn / TICK_RATE)}`
            : spectre
              ? `${badgeName} · espectro`
              : badgeName;
      }

      // Flecha en el borde para rivales vivos a la vista pero fuera de la pantalla.
      const showArrow = !onScreen && !hidden && wizard.team !== playerTeam && wizard.hp > 0;
      label.arrow.hidden = !showArrow;
      if (showArrow) {
        let dx = this.projected.x * (behind ? -1 : 1);
        let dy = this.projected.y * (behind ? -1 : 1);
        if (behind && Math.abs(dy) < 0.2) dy = -1;
        const scale = 1 / Math.max(Math.abs(dx), Math.abs(dy), 1e-3);
        dx *= scale;
        dy *= scale;
        const edgeX = Math.min(width - EDGE_MARGIN, Math.max(EDGE_MARGIN, ((dx + 1) / 2) * width));
        const edgeY = Math.min(
          height - EDGE_MARGIN,
          Math.max(EDGE_MARGIN, ((1 - dy) / 2) * height),
        );
        // La flecha se corre por el borde para no quedar bajo el minimapa ni bajo los botones.
        const clear = this.obstacles.clearPoint(edgeX, edgeY, EDGE_MARGIN / 2);
        const ax = clear.x;
        const ay = Math.min(height - EDGE_MARGIN, Math.max(EDGE_MARGIN, clear.y));
        const angle = Math.atan2(-dy, dx);
        label.arrow.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -50%) rotate(${angle}rad)`;
      }
    }
  }

  /** Nombre y vida de las bestias; solo se muestran cuando están heridas o persiguen a alguien. */
  updateBeasts(
    state: MatchState,
    camera: THREE.Camera,
    beastName: (beast: Beast) => string,
    beastColor: (element: string) => string,
  ): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const present = new Set<number>();
    for (const beast of state.beasts) {
      present.add(beast.id);
      let label = this.beastLabels.get(beast.id);
      if (!label) {
        const root = el('div', `world-label beast${beast.guardian ? ' guardian' : ''}`);
        root.style.setProperty('--team', beastColor(beast.element));
        const name = el('span', 'world-label-name', beastName(beast));
        const bar = el('div', 'world-label-bar');
        const fill = el('div', 'world-label-fill');
        bar.append(fill);
        root.append(name, bar);
        this.layer.append(root);
        label = { root, name, fill, arrow: root };
        this.beastLabels.set(beast.id, label);
      }
      this.projected.set(beast.pos.x, beast.guardian ? 3.6 : 1.7, beast.pos.z).project(camera);
      const x = ((this.projected.x + 1) / 2) * width;
      const y = ((1 - this.projected.y) / 2) * height;
      const onScreen = this.projected.z < 1 && x > 0 && x < width && y > 0 && y < height;
      const interesting = beast.hp < beast.maxHp || beast.targetId !== null;
      // Las bestias de campamentos lejanos no llenan la pantalla de nombres.
      const near =
        Math.hypot(camera.position.x - beast.pos.x, camera.position.z - beast.pos.z) <
        BEAST_LABEL_RANGE;
      // Bajo el reloj o la vida, el nombre de una bestia estorbaría: se esconde.
      const underHud = this.obstacles.clearOfTop(x, y, LABEL_WIDTH, LABEL_HEIGHT_PX) !== y;
      label.root.hidden = !onScreen || !near || underHud;
      label.root.classList.toggle('calm', !interesting);
      if (onScreen) {
        label.root.classList.toggle(
          'under-controls',
          this.obstacles.coversControl(x, y, LABEL_WIDTH, LABEL_HEIGHT_PX),
        );
        label.root.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        label.fill.style.width = `${(beast.hp / beast.maxHp) * 100}%`;
      }
    }
    for (const [id, label] of this.beastLabels) {
      if (!present.has(id)) {
        label.root.remove();
        this.beastLabels.delete(id);
      }
    }
  }
}
