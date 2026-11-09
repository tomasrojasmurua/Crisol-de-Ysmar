import { ELEMENTS, FEATURES } from '@crisol/content';
import type { DeathRule, ElementId, GameMode } from '@crisol/core';
import type { MatchOptions } from '../game/LocalMatch';
import type { Profile } from '../game/Profile';
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

const ALL_DEATH_RULES: readonly { id: DeathRule; title: string; detail: string }[] = [
  { id: 'spectre', title: 'Espectro', detail: 'Sigues como espíritu' },
  { id: 'lives', title: 'Vidas', detail: '3 vidas por ronda' },
];
/** Con 3 Vidas en pausa, Espectro es la única regla y el menú no pregunta. */
const DEATH_RULES = ALL_DEATH_RULES.filter((rule) => rule.id !== 'lives' || FEATURES.livesRule);

const STORAGE_KEY = 'crisol.menu';

/**
 * La portada: el título sobre el Crisol que gira de fondo, y la elección de modo
 * y de regla de muerte. Recuerda la última elección en este celular.
 */
export class Menu {
  private readonly root: HTMLElement;
  private modeId = 'duel';
  private deathRule: DeathRule = 'spectre';
  private affinity: ElementId | null = null;
  private readonly wizardName: HTMLElement;
  private readonly wizardAffinity: HTMLElement;
  private readonly wizardButton: HTMLElement;
  private readonly grimoireCount: HTMLElement;

  constructor(
    parent: HTMLElement,
    onPlay: (options: MatchOptions) => void,
    onWardrobe: () => void,
    onGrimoire: () => void,
  ) {
    this.restore();
    this.root = el('div', 'menu');
    this.root.innerHTML = `
      <div class="menu-veil"></div>
      <header class="menu-title">
        <p class="menu-kicker">Un duelo de hechiceros</p>
        <h1>Crisol de Ysmar</h1>
        <p class="menu-tagline">Teje la magia. Lee al rival. Sobrevive al Crisol.</p>
        <div class="menu-identity">
          <button type="button" class="menu-wizard">
            <span class="menu-wizard-sigil"></span>
            <span class="menu-wizard-text">
              <strong class="menu-wizard-name"></strong>
              <span class="menu-wizard-affinity"></span>
            </span>
            <span class="menu-wizard-edit">Vestidor</span>
          </button>
          <button type="button" class="menu-grimoire">
            <strong>Grimorio</strong>
            <span class="menu-grimoire-count"></span>
          </button>
        </div>
      </header>
      <section class="menu-panel">
        <h2>Modo</h2>
        <div class="menu-modes"></div>
        <h2 class="menu-rules-title">Al caer</h2>
        <div class="menu-rules"></div>
        <button type="button" class="primary menu-play">Entrar al Crisol</button>
      </section>`;
    parent.append(this.root);
    this.wizardName = query(this.root, '.menu-wizard-name');
    this.wizardAffinity = query(this.root, '.menu-wizard-affinity');
    this.wizardButton = query(this.root, '.menu-wizard');
    this.grimoireCount = query(this.root, '.menu-grimoire-count');
    this.wizardButton.addEventListener('click', onWardrobe);
    query(this.root, '.menu-grimoire').addEventListener('click', onGrimoire);

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
    const askDeathRule = DEATH_RULES.length > 1;
    rules.hidden = !askDeathRule;
    query(this.root, '.menu-rules-title').hidden = !askDeathRule;
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
    return {
      mode: choice?.mode ?? { kind: 'duel' },
      deathRule: this.deathRule,
      affinity: this.affinity,
    };
  }

  /** Muestra quién eres, tu Afinidad y cuánto llevas del Grimorio. */
  setIdentity(profile: Profile, known: number, total: number): void {
    this.affinity = profile.affinity;
    const element = ELEMENTS.find((e) => e.id === profile.affinity);
    this.wizardName.textContent = profile.name || 'Hechicero sin nombre';
    this.wizardAffinity.textContent = element ? `Afinidad: ${element.name}` : 'Sin Afinidad';
    this.wizardButton.style.setProperty('--element', element?.color ?? '#d8bf8a');
    this.grimoireCount.textContent = `${known} de ${total}`;
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
      const rule = DEATH_RULES.find((r) => r.id === saved.deathRule);
      if (rule) this.deathRule = rule.id;
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
