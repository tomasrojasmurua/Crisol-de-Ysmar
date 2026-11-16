import { BOT_LEVEL_NAMES, ELEMENTS, goalText, omenById, type PathStep } from '@crisol/content';
import type { GameMode } from '@crisol/core';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

const elementName = (id: string): string => ELEMENTS.find((e) => e.id === id)?.name ?? id;

/** "Marea, Tormenta y Raíz". */
function listNames(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

function modeText(mode: GameMode): string {
  switch (mode.kind) {
    case 'duel':
      return '1 contra 1';
    case 'teams':
      return `${mode.size} contra ${mode.size}, con aliados de la IA`;
    case 'ffa':
      return `Todos contra todos, de ${mode.players}`;
  }
}

/** Lo que el paso cambia del duelo de siempre, una cosa por línea. */
export function stepRules(step: PathStep, masterName: string): string[] {
  const rules = [
    step.master
      ? `1 contra 1 contra ${masterName}, que juega como ${BOT_LEVEL_NAMES.master}`
      : `${modeText(step.mode)} · IA ${BOT_LEVEL_NAMES[step.botLevel]}`,
  ];
  if (step.rivalSchool)
    rules.push(`Tu rival solo teje el Linaje de ${elementName(step.rivalSchool)}`);
  if (step.omenId) {
    const omen = omenById(step.omenId);
    const text = omen.description;
    rules.push(`Presagio ${omen.name}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
  }
  if (step.elements) rules.push(`Solo puedes tejer ${listNames(step.elements.map(elementName))}`);
  rules.push(goalText(step.goal, step.school));
  return rules;
}

/** Lo que la pantalla necesita para dibujar el Camino. */
export interface PathScreenView {
  readonly steps: readonly PathStep[];
  readonly isDone: (stepId: string) => boolean;
  /** El paso que toca (índice). */
  readonly current: number;
  readonly master: {
    readonly name: string;
    /** Sin el apodo ("Dorn"), para las reglas. */
    readonly short: string;
    readonly color: string;
  };
}

/**
 * El Camino de tu Linaje: diez pasos en fila, tu maestro presentando el elegido y el botón para
 * ir al duelo. Se avanza en orden; los pasos superados se pueden repetir.
 */
export class PathScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly quote: HTMLElement;
  private readonly masterName: HTMLElement;
  private readonly stepTitle: HTMLElement;
  private readonly rules: HTMLElement;
  private readonly go: HTMLButtonElement;
  private view: PathScreenView | null = null;
  private selected = 0;

  constructor(
    parent: HTMLElement,
    private readonly onPlay: (step: PathStep) => void,
    private readonly onClose: () => void,
    /** Dice la frase del maestro si existe su voz. */
    private readonly onVoice: (key: string) => void = () => {},
  ) {
    this.root = el('div', 'training-chooser path-screen');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="training-chooser-card path-card">
        <header class="training-chooser-head">
          <h2></h2>
          <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
        </header>
        <ol class="path-steps" aria-label="Pasos"></ol>
        <div class="path-detail">
          <figure class="path-master">
            <blockquote></blockquote>
            <figcaption></figcaption>
          </figure>
          <div class="path-info">
            <strong class="path-step-title"></strong>
            <ul class="path-rules"></ul>
            <button type="button" class="primary path-go">${MENU_ICONS.duel}<span>Al duelo</span></button>
          </div>
        </div>
      </div>`;
    parent.append(this.root);
    this.title = query(this.root, 'h2');
    this.steps = query(this.root, '.path-steps');
    this.quote = query(this.root, '.path-master blockquote');
    this.masterName = query(this.root, '.path-master figcaption');
    this.stepTitle = query(this.root, '.path-step-title');
    this.rules = query(this.root, '.path-rules');
    this.go = query(this.root, '.path-go');
    this.go.addEventListener('click', () => {
      const step = this.view?.steps[this.selected];
      if (!step) return;
      this.hide();
      this.onPlay(step);
    });
    query(this.root, '.grimoire-card-close').addEventListener('click', () => this.close());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Abre el Camino en el paso que toca, y el maestro lo presenta. */
  show(title: string, view: PathScreenView): void {
    this.view = view;
    this.title.textContent = title;
    this.root.style.setProperty('--master', view.master.color);
    this.masterName.textContent = view.master.name;
    this.root.hidden = false;
    this.select(view.current, true);
  }

  hide(): void {
    this.root.hidden = true;
  }

  private close(): void {
    this.hide();
    this.onClose();
  }

  private select(index: number, aloud: boolean): void {
    const view = this.view;
    const step = view?.steps[index];
    if (!view || !step) return;
    this.selected = index;
    this.steps.replaceChildren(
      ...view.steps.map((s, i) => {
        const done = view.isDone(s.id);
        const open = done || i <= view.current;
        const item = el('li', 'path-step-item');
        const button = el('button', 'path-step');
        button.type = 'button';
        button.classList.toggle('done', done);
        button.classList.toggle('current', i === view.current && !done);
        button.classList.toggle('selected', i === index);
        button.classList.toggle('final', s.master);
        button.disabled = !open;
        button.textContent = done ? '✓' : String(s.number);
        button.setAttribute(
          'aria-label',
          `Paso ${s.number}: ${s.title}${open ? '' : ' (cerrado)'}`,
        );
        button.addEventListener('click', () => this.select(i, true));
        item.append(button);
        return item;
      }),
    );
    this.quote.textContent = step.line;
    this.stepTitle.textContent = `Paso ${step.number} · ${step.title}`;
    this.rules.replaceChildren(
      ...stepRules(step, view.master.short).map((rule, i, all) =>
        el('li', i === all.length - 1 ? 'path-goal' : '', rule),
      ),
    );
    this.go.querySelector('span')?.replaceChildren(view.isDone(step.id) ? 'Repetir' : 'Al duelo');
    if (aloud) this.onVoice(step.voice);
  }
}
