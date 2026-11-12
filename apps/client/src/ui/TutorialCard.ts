import { TUTORIAL_CHAPTERS, type Tutorial } from '../game/Tutorial';
import { comboStepsView } from './comboSteps';
import { el, query } from './dom';

/**
 * La tarjeta del tutorial, arriba al centro: capítulo y paso, qué hacer, cuánto llevas y, en
 * los combos, sus signos igual que en el Grimorio. Se puede saltar un capítulo. Es angosta para no tapar el muñeco ni los botones.
 */
export class TutorialCard {
  private readonly root: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly title: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly text: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly progress: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly finish: HTMLElement;
  private tutorial: Tutorial | null = null;

  constructor(
    parent: HTMLElement,
    onFreePlay: () => void,
    onMenu: () => void,
    /** Avisa que el tutorial avanzó con un botón (Siguiente o Saltar). */
    private readonly onAdvance: () => void = () => {},
  ) {
    this.root = el('section', 'tutorial-card');
    this.root.hidden = true;
    this.root.innerHTML = `
      <span class="tutorial-kicker"></span>
      <h3 class="tutorial-title"></h3>
      <div class="tutorial-steps"></div>
      <p class="tutorial-text"></p>
      <span class="tutorial-progress" hidden></span>
      <div class="tutorial-actions">
        <button type="button" class="primary tutorial-next">Siguiente</button>
        <button type="button" class="secondary tutorial-skip">Saltar capítulo</button>
      </div>
      <div class="tutorial-finish" hidden>
        <button type="button" class="secondary tutorial-free">Práctica libre</button>
        <button type="button" class="primary tutorial-menu">Menú</button>
      </div>`;
    parent.append(this.root);
    this.kicker = query(this.root, '.tutorial-kicker');
    this.title = query(this.root, '.tutorial-title');
    this.steps = query(this.root, '.tutorial-steps');
    this.text = query(this.root, '.tutorial-text');
    this.next = query(this.root, '.tutorial-next');
    this.progress = query(this.root, '.tutorial-progress');
    this.actions = query(this.root, '.tutorial-actions');
    this.finish = query(this.root, '.tutorial-finish');
    this.next.addEventListener('click', () => {
      this.tutorial?.next();
      this.onAdvance();
      this.render();
    });
    query(this.root, '.tutorial-skip').addEventListener('click', () => {
      this.tutorial?.skipChapter();
      this.onAdvance();
      this.render();
    });
    query(this.root, '.tutorial-free').addEventListener('click', onFreePlay);
    query(this.root, '.tutorial-menu').addEventListener('click', onMenu);
  }

  show(tutorial: Tutorial): void {
    this.tutorial = tutorial;
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.tutorial = null;
    this.root.hidden = true;
  }

  /** Vuelve a dibujar el paso actual (al avanzar). */
  render(): void {
    const tutorial = this.tutorial;
    if (!tutorial) return;
    const step = tutorial.step;
    this.root.classList.remove('advance');
    void this.root.offsetWidth;
    this.root.classList.add('advance');
    const chapter = tutorial.chapter;
    if (!step || !chapter) {
      this.kicker.textContent = 'Tutorial';
      this.title.textContent = '¡Listo!';
      this.steps.replaceChildren();
      this.text.textContent =
        'Puedes repetir cualquier capítulo desde Entrenamiento. Los combos que faltan se descubren jugando.';
      this.progress.hidden = true;
      this.actions.hidden = true;
      this.finish.hidden = false;
      return;
    }
    this.kicker.textContent = `Capítulo ${tutorial.chapterNumber} de ${TUTORIAL_CHAPTERS.length} · ${chapter.title} · ${tutorial.stepNumber}/${chapter.steps.length}`;
    this.title.textContent = step.title;
    this.steps.replaceChildren(...(step.combo ? [comboStepsView(step.combo)] : []));
    this.text.textContent = step.text;
    this.refreshProgress();
    this.actions.hidden = false;
    this.next.hidden = step.goal.kind !== 'read';
    this.finish.hidden = true;
  }

  /** La cuenta del paso ("3 de 5"), sin volver a animar la tarjeta. */
  refreshProgress(): void {
    const progress = this.tutorial?.progress ?? '';
    this.progress.textContent = progress;
    this.progress.hidden = progress === '';
  }
}
