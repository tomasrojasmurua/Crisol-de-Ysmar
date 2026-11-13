import type { TutorialChapter } from '../game/Tutorial';
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
    /** Los capítulos del tutorial de tu escuela. */
    private readonly schoolChapters: () => readonly TutorialChapter[],
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
            <span>Lo básico y tu escuela, por capítulos, y un examen al final</span>
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
    const chapters = this.schoolChapters();
    const button = (chapter: TutorialChapter, index: number, label: string): HTMLElement => {
      const item = el('button', 'training-chapter');
      item.type = 'button';
      const done = this.isDone(chapter.id);
      item.classList.toggle('done', done);
      item.append(
        el('span', 'training-chapter-number', done ? '✓' : label),
        el('span', 'training-chapter-title', chapter.title),
      );
      item.addEventListener('click', () =>
        this.choose({ kind: 'tutorial', chapter: index, onlyOne: true }),
      );
      return item;
    };
    const main = chapters.flatMap((chapter, i) =>
      chapter.extra ? [] : [button(chapter, i, String(i + 1))],
    );
    const extra = chapters.flatMap((chapter, i) =>
      chapter.extra ? [button(chapter, i, '✦')] : [],
    );
    this.chapterList.replaceChildren(
      ...main,
      ...(extra.length > 0 ? [el('h3', 'training-chapter-group', 'Más técnicas'), ...extra] : []),
    );
    this.options.hidden = true;
    this.chapters.hidden = false;
  }

  private choose(choice: TrainingChoice): void {
    this.hide();
    this.onChoose(choice);
  }
}
