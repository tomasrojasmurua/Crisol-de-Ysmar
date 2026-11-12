import type { Tutorial } from '../game/Tutorial';
import { comboStepsView } from './comboSteps';
import { el, query } from './dom';

/**
 * La tarjeta del tutorial, arriba al centro: qué paso vas, qué hacer y, en los combos, sus
 * signos igual que en el Grimorio. Es angosta para no tapar el muñeco ni los botones.
 */
export class TutorialCard {
  private readonly root: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly title: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly text: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly finish: HTMLElement;
  private tutorial: Tutorial | null = null;

  constructor(parent: HTMLElement, onFreePlay: () => void, onMenu: () => void) {
    this.root = el('section', 'tutorial-card');
    this.root.hidden = true;
    this.root.innerHTML = `
      <span class="tutorial-kicker"></span>
      <h3 class="tutorial-title"></h3>
      <div class="tutorial-steps"></div>
      <p class="tutorial-text"></p>
      <button type="button" class="primary tutorial-next">Siguiente</button>
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
    this.finish = query(this.root, '.tutorial-finish');
    this.next.addEventListener('click', () => {
      this.tutorial?.next();
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
    if (!step) {
      this.kicker.textContent = 'Tutorial completo';
      this.title.textContent = '¡Listo!';
      this.steps.replaceChildren();
      this.text.textContent =
        'Brasa maldita, Quiebre y Amarre quedan en tu Grimorio. Los demás combos se descubren jugando.';
      this.next.hidden = true;
      this.finish.hidden = false;
      return;
    }
    this.kicker.textContent = `Tutorial · ${tutorial.stepNumber} de ${tutorial.total}`;
    this.title.textContent = step.title;
    this.steps.replaceChildren(...(step.combo ? [comboStepsView(step.combo)] : []));
    this.text.textContent = step.text;
    this.next.hidden = step.goal.kind !== 'read';
    this.finish.hidden = true;
  }
}
