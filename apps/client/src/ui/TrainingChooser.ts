import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

export type TrainingKind = 'tutorial' | 'free';

/** Al tocar Entrenamiento: el tutorial (lo básico y tus primeros 3 combos) o la práctica libre. */
export class TrainingChooser {
  private readonly root: HTMLElement;
  private readonly badge: HTMLElement;

  constructor(parent: HTMLElement, onChoose: (kind: TrainingKind) => void) {
    this.root = el('div', 'training-chooser');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="training-chooser-card">
        <header class="training-chooser-head">
          <h2>Entrenamiento</h2>
          <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
        </header>
        <div class="training-chooser-options">
          <button type="button" class="training-option" data-kind="tutorial">
            <span class="training-option-badge">Recomendado</span>
            <strong>Tutorial</strong>
            <span>Moverte, tejer y tus primeros 3 combos</span>
          </button>
          <button type="button" class="training-option" data-kind="free">
            ${MENU_ICONS.training}
            <strong>Práctica libre</strong>
            <span>Tú y el muñeco, sin cansancio</span>
          </button>
        </div>
      </div>`;
    parent.append(this.root);
    this.badge = query(this.root, '.training-option-badge');
    for (const button of this.root.querySelectorAll<HTMLElement>('.training-option')) {
      button.addEventListener('click', () => {
        this.hide();
        onChoose(button.dataset.kind as TrainingKind);
      });
    }
    query(this.root, '.grimoire-card-close').addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.hide();
    });
  }

  /** `recommendTutorial`: si todavía no lo termina, el tutorial lleva la marca de recomendado. */
  show(recommendTutorial: boolean): void {
    this.badge.hidden = !recommendTutorial;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
