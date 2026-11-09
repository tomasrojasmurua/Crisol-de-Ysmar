import type { DeathRule, GameMode } from '@crisol/core';
import type { MatchOptions } from '../game/LocalMatch';
import { el, query } from './dom';

interface ModeChoice {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly mode: GameMode;
}

const MODES: readonly ModeChoice[] = [
  { id: 'duel', title: 'Duelo', detail: '1 contra 1', mode: { kind: 'duel' } },
  { id: 'teams2', title: '2 contra 2', detail: 'Equipos', mode: { kind: 'teams', size: 2 } },
  { id: 'teams3', title: '3 contra 3', detail: 'Equipos', mode: { kind: 'teams', size: 3 } },
  {
    id: 'ffa4',
    title: 'Libre de 4',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 4 },
  },
  {
    id: 'ffa6',
    title: 'Libre de 6',
    detail: 'Todos contra todos',
    mode: { kind: 'ffa', players: 6 },
  },
];

const DEATH_RULES: readonly { id: DeathRule; title: string; detail: string }[] = [
  { id: 'spectre', title: 'Espectro', detail: 'Sigues como espíritu' },
  { id: 'lives', title: 'Vidas', detail: '3 vidas por ronda' },
];

const STORAGE_KEY = 'crisol.menu';

/**
 * La portada: el título sobre el Crisol que gira de fondo, y la elección de modo
 * y de regla de muerte. Recuerda la última elección en este celular.
 */
export class Menu {
  private readonly root: HTMLElement;
  private modeId = 'duel';
  private deathRule: DeathRule = 'spectre';

  constructor(parent: HTMLElement, onPlay: (options: MatchOptions) => void) {
    this.restore();
    this.root = el('div', 'menu');
    this.root.innerHTML = `
      <div class="menu-veil"></div>
      <header class="menu-title">
        <p class="menu-kicker">Un duelo de hechiceros</p>
        <h1>Crisol de Ysmar</h1>
        <p class="menu-tagline">Teje la magia. Lee al rival. Sobrevive al Crisol.</p>
      </header>
      <section class="menu-panel">
        <h2>Modo</h2>
        <div class="menu-modes"></div>
        <h2>Al caer</h2>
        <div class="menu-rules"></div>
        <button type="button" class="primary menu-play">Entrar al Crisol</button>
      </section>`;
    parent.append(this.root);

    const modes = query(this.root, '.menu-modes');
    for (const choice of MODES) {
      const button = el('button', 'menu-choice');
      button.type = 'button';
      button.dataset.id = choice.id;
      button.append(el('strong', '', choice.title), el('span', '', choice.detail));
      button.addEventListener('click', () => {
        this.modeId = choice.id;
        this.refresh();
      });
      modes.append(button);
    }
    const rules = query(this.root, '.menu-rules');
    for (const rule of DEATH_RULES) {
      const button = el('button', 'menu-choice');
      button.type = 'button';
      button.dataset.id = rule.id;
      button.append(el('strong', '', rule.title), el('span', '', rule.detail));
      button.addEventListener('click', () => {
        this.deathRule = rule.id;
        this.refresh();
      });
      rules.append(button);
    }
    query(this.root, '.menu-play').addEventListener('click', () => {
      this.save();
      onPlay(this.options);
    });
    this.refresh();
  }

  get options(): MatchOptions {
    const choice = MODES.find((m) => m.id === this.modeId) ?? MODES[0];
    return { mode: choice?.mode ?? { kind: 'duel' }, deathRule: this.deathRule };
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  private refresh(): void {
    for (const button of this.root.querySelectorAll<HTMLElement>('.menu-modes .menu-choice')) {
      button.classList.toggle('selected', button.dataset.id === this.modeId);
    }
    for (const button of this.root.querySelectorAll<HTMLElement>('.menu-rules .menu-choice')) {
      button.classList.toggle('selected', button.dataset.id === this.deathRule);
    }
  }

  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        modeId?: string;
        deathRule?: string;
      };
      if (MODES.some((m) => m.id === saved.modeId) && saved.modeId) this.modeId = saved.modeId;
      if (saved.deathRule === 'spectre' || saved.deathRule === 'lives') {
        this.deathRule = saved.deathRule;
      }
    } catch {
      // Sin almacenamiento (modo privado): se usan los valores por defecto.
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ modeId: this.modeId, deathRule: this.deathRule }),
      );
    } catch {
      // No es grave: solo se pierde el recuerdo de la elección.
    }
  }
}
