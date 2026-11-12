import { TUTORIAL_CHAPTERS } from '../game/Tutorial';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';

/** Qué eligió: el tutorial desde un capítulo (entero o solo ese) o la práctica libre. */
export type TrainingChoice =
  | { readonly kind: 'tutorial'; readonly chapter: number; readonly onlyOne: boolean }
  | { readonly kind: 'free' };

/**
 * Al tocar Entrenamiento: el tutorial o la práctica libre. Quien ya hizo el tutorial ve los
 * capítulos para repetir el que quiera; la primera vez, el tutorial parte del principio.
 */
export class TrainingChooser {
  private readonly root: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly options: HTMLElement;
  private readonly chapters: HTMLElement;
  private readonly chapterList: HTMLElement;
  private showChapters = false;

  constructor(
    parent: HTMLElement,
    private readonly onChoose: (choice: TrainingChoice) => void,
    /** Si ese capítulo ya está hecho (lleva ✓). */
    private readonly isDone: (chapterId: string) => boolean,
  ) {
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
            <span>Todo lo básico, por capítulos, y un examen al final</span>
          </button>
          <button type="button" class="training-option" data-kind="free">
            ${MENU_ICONS.training}
            <strong>Práctica libre</strong>
            <span>Tú y el muñeco, sin cansancio</span>
          </button>
        </div>
        <div class="training-chapters" hidden>
          <button type="button" class="primary training-chapters-all">Todo desde el principio</button>
          <div class="training-chapter-list"></div>
        </div>
      </div>`;
    parent.append(this.root);
    this.badge = query(this.root, '.training-option-badge');
    this.options = query(this.root, '.training-chooser-options');
    this.chapters = query(this.root, '.training-chapters');
    this.chapterList = query(this.root, '.training-chapter-list');
    query(this.root, '[data-kind="tutorial"]').addEventListener('click', () => {
      if (this.showChapters) this.openChapters();
      else this.choose({ kind: 'tutorial', chapter: 0, onlyOne: false });
    });
    query(this.root, '[data-kind="free"]').addEventListener('click', () =>
      this.choose({ kind: 'free' }),
    );
    query(this.root, '.training-chapters-all').addEventListener('click', () =>
      this.choose({ kind: 'tutorial', chapter: 0, onlyOne: false }),
    );
    query(this.root, '.grimoire-card-close').addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.hide();
    });
  }

  /**
   * `firstTime`: si todavía no hace el tutorial, lleva la marca de recomendado y parte del
   * principio; si ya lo hizo, tocarlo muestra los capítulos.
   */
  show(firstTime: boolean): void {
    this.badge.hidden = !firstTime;
    this.showChapters = !firstTime;
    this.options.hidden = false;
    this.chapters.hidden = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private openChapters(): void {
    this.chapterList.replaceChildren(
      ...TUTORIAL_CHAPTERS.map((chapter, i) => {
        const button = el('button', 'training-chapter');
        button.type = 'button';
        const done = this.isDone(chapter.id);
        button.classList.toggle('done', done);
        button.append(
          el('span', 'training-chapter-number', done ? '✓' : String(i + 1)),
          el('span', 'training-chapter-title', chapter.title),
        );
        button.addEventListener('click', () =>
          this.choose({ kind: 'tutorial', chapter: i, onlyOne: true }),
        );
        return button;
      }),
    );
    this.options.hidden = true;
    this.chapters.hidden = false;
  }

  private choose(choice: TrainingChoice): void {
    this.hide();
    this.onChoose(choice);
  }
}
