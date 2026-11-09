import { type GameRules, isSpectre, type MatchState, TICK_RATE, type Vec2 } from '@crisol/core';
import * as THREE from 'three';
import { el } from './dom';
import type { WizardBadge } from './Hud';

const LABEL_HEIGHT = 2.55;
const EDGE_MARGIN = 28;

interface Label {
  readonly root: HTMLElement;
  readonly name: HTMLElement;
  readonly fill: HTMLElement;
  readonly arrow: HTMLElement;
}

/**
 * Nombre y vida sobre la cabeza de cada mago, y flechas en el borde de la pantalla
 * para los rivales que quedan fuera de vista.
 */
export class WorldLabels {
  private readonly layer: HTMLElement;
  private readonly labels = new Map<number, Label>();
  private readonly projected = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.layer = el('div', 'world-labels');
    parent.append(this.layer);
  }

  reset(badges: ReadonlyMap<number, WizardBadge>, playerId: number): void {
    this.layer.replaceChildren();
    this.labels.clear();
    for (const [id, badge] of badges) {
      if (id === playerId) continue;
      const root = el('div', 'world-label');
      root.style.setProperty('--team', badge.color);
      const name = el('span', 'world-label-name', badge.name);
      const bar = el('div', 'world-label-bar');
      const fill = el('div', 'world-label-fill');
      bar.append(fill);
      root.append(name, bar);
      const arrow = el('div', 'edge-arrow');
      arrow.style.setProperty('--team', badge.color);
      this.layer.append(root, arrow);
      this.labels.set(id, { root, name, fill, arrow });
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

      label.root.hidden = !onScreen;
      if (onScreen) {
        label.root.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        label.fill.style.width = `${(wizard.hp / rules.wizard.maxHp) * 100}%`;
        label.root.classList.toggle('fallen', wizard.hp <= 0);
        const respawn = wizard.fallen?.respawnTicks;
        const badgeName = badges.get(wizard.id)?.name ?? '';
        label.name.textContent =
          respawn != null
            ? `${badgeName} · ${Math.ceil(respawn / TICK_RATE)}`
            : spectre
              ? `${badgeName} · espectro`
              : badgeName;
      }

      // Flecha en el borde para rivales vivos fuera de la pantalla.
      const showArrow = !onScreen && wizard.team !== playerTeam && wizard.hp > 0;
      label.arrow.hidden = !showArrow;
      if (showArrow) {
        let dx = this.projected.x * (behind ? -1 : 1);
        let dy = this.projected.y * (behind ? -1 : 1);
        if (behind && Math.abs(dy) < 0.2) dy = -1;
        const scale = 1 / Math.max(Math.abs(dx), Math.abs(dy), 1e-3);
        dx *= scale;
        dy *= scale;
        const ax = Math.min(width - EDGE_MARGIN, Math.max(EDGE_MARGIN, ((dx + 1) / 2) * width));
        const ay = Math.min(height - EDGE_MARGIN, Math.max(EDGE_MARGIN, ((1 - dy) / 2) * height));
        const angle = Math.atan2(-dy, dx);
        label.arrow.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -50%) rotate(${angle}rad)`;
      }
    }
  }
}
