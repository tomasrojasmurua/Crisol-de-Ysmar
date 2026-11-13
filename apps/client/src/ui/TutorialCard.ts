import type { Tutorial } from '../game/Tutorial';
import { comboStepsView, spellStepsView } from './comboSteps';
import { el, query } from './dom';
import { richText } from './richText';

/** Lo que dura desplegado un paso nuevo antes de recogerse solo. */
const AUTO_COLLAPSE_MS = 6000;
/** Recién aparecido un paso, jugar todavía no lo recoge: alcanza a leerse. */
const READ_GRACE_MS = 1500;

/**
 * La guía del tutorial, arriba al centro, en dos tamaños:
 *
 * - Recogida: una sola línea con el capítulo, la orden corta, los signos del hechizo o combo y
 *   cuánto llevas. Es lo que queda mientras juegas, para no tapar el muñeco ni los botones.
 * - Desplegada: además, la explicación completa y los botones (Siguiente, Saltar capítulo).
 *
 * Cada paso nuevo aparece desplegado y se recoge solo al empezar a jugar (moverte, tejer o
 * girar la cámara) o a los pocos segundos. Tocar la línea la despliega o la recoge. Los pasos
 * que solo se leen quedan desplegados: ahí no hay nada que hacer en la partida.
 */
export class TutorialCard {
  private readonly root: HTMLElement;
  private readonly bar: HTMLButtonElement;
  private readonly chapterBadge: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly signs: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly text: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly actions: HTMLElement;
  private readonly finish: HTMLElement;
  /** La marca de dónde arrastrar para girar la cámara (solo en ese paso). */
  private readonly lookHint: HTMLElement;
  private tutorial: Tutorial | null = null;
  private expanded = true;
  private shownAt = 0;
  private collapseTimer = 0;

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
      <button type="button" class="tutorial-bar" aria-expanded="true">
        <span class="tutorial-chapter"></span>
        <span class="tutorial-goal"></span>
        <span class="tutorial-signs"></span>
        <span class="tutorial-progress" hidden></span>
        <span class="tutorial-toggle" aria-hidden="true"></span>
      </button>
      <div class="tutorial-more">
        <span class="tutorial-kicker"></span>
        <p class="tutorial-text"></p>
        <div class="tutorial-actions">
          <button type="button" class="primary tutorial-next">Siguiente</button>
          <button type="button" class="secondary tutorial-skip">Saltar capítulo</button>
        </div>
        <div class="tutorial-finish" hidden>
          <button type="button" class="secondary tutorial-free">Práctica libre</button>
          <button type="button" class="primary tutorial-menu">Menú</button>
        </div>
      </div>`;
    this.lookHint = el('div', 'tutorial-look-hint');
    this.lookHint.hidden = true;
    this.lookHint.setAttribute('aria-hidden', 'true');
    this.lookHint.innerHTML =
      '<span class="tutorial-look-arrow">‹</span><span class="tutorial-look-finger"></span><span class="tutorial-look-arrow">›</span>';
    parent.append(this.lookHint, this.root);
    this.bar = query(this.root, '.tutorial-bar');
    this.chapterBadge = query(this.root, '.tutorial-chapter');
    this.goal = query(this.root, '.tutorial-goal');
    this.signs = query(this.root, '.tutorial-signs');
    this.progress = query(this.root, '.tutorial-progress');
    this.kicker = query(this.root, '.tutorial-kicker');
    this.text = query(this.root, '.tutorial-text');
    this.next = query(this.root, '.tutorial-next');
    this.actions = query(this.root, '.tutorial-actions');
    this.finish = query(this.root, '.tutorial-finish');
    this.bar.addEventListener('click', () => {
      if (!this.collapsible) return;
      this.setExpanded(!this.expanded);
      // Abierta a mano, no se cierra sola enseguida: se lee con calma.
      this.shownAt = performance.now();
      this.clearTimer();
    });
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
    this.lookHint.hidden = true;
    this.clearTimer();
  }

  /** Vuelve a dibujar el paso actual (al avanzar): aparece desplegado. */
  render(): void {
    const tutorial = this.tutorial;
    if (!tutorial) return;
    const step = tutorial.step;
    this.root.classList.remove('advance');
    void this.root.offsetWidth;
    this.root.classList.add('advance');
    const chapter = tutorial.chapter;
    this.clearTimer();
    if (!step || !chapter) {
      this.chapterBadge.textContent = '✦';
      this.goal.textContent = '¡Tutorial terminado!';
      this.signs.replaceChildren();
      this.kicker.textContent = 'Tutorial';
      this.text.textContent =
        'Puedes repetir cualquier capítulo desde Entrenamiento. Los combos que faltan se descubren jugando.';
      this.progress.hidden = true;
      this.actions.hidden = true;
      this.finish.hidden = false;
      this.lookHint.hidden = true;
      this.setExpanded(true);
      return;
    }
    const reading = step.goal.kind === 'read';
    const extra = tutorial.chapter?.extra === true;
    this.chapterBadge.textContent = extra ? '✦' : `${tutorial.chapterNumber}/${tutorial.mainCount}`;
    this.goal.replaceChildren(richText(step.short ?? step.title));
    const signs = step.combo
      ? [comboStepsView(step.combo)]
      : step.spell
        ? [spellStepsView([step.spell])]
        : [];
    this.signs.replaceChildren(...signs);
    this.kicker.textContent = `${chapter.title} · paso ${tutorial.stepNumber} de ${chapter.steps.length}`;
    this.text.replaceChildren(richText(step.text));
    this.refreshProgress();
    this.actions.hidden = false;
    this.next.hidden = !reading;
    this.finish.hidden = true;
    this.lookHint.hidden = !(step.goal.kind === 'signal' && step.goal.signal === 'look');
    this.root.classList.toggle('reading', reading);
    this.setExpanded(true);
    this.shownAt = performance.now();
    if (!reading) {
      this.collapseTimer = window.setTimeout(() => this.setExpanded(false), AUTO_COLLAPSE_MS);
    }
  }

  /**
   * El jugador empezó a jugar (se movió, tejió o giró la cámara): la guía se recoge a su línea.
   * No pasa en los pasos de leer ni apenas aparecido el paso.
   */
  collapse(): void {
    if (!this.expanded || !this.collapsible) return;
    if (performance.now() - this.shownAt < READ_GRACE_MS) return;
    this.clearTimer();
    this.setExpanded(false);
  }

  /** La cuenta del paso ("3 de 5"), sin volver a animar la tarjeta. */
  refreshProgress(): void {
    const progress = this.tutorial?.progress ?? '';
    if (this.progress.textContent !== progress) this.progress.textContent = progress;
    this.progress.hidden = progress === '';
  }

  /** Si la guía se puede recoger: solo en pasos que se hacen jugando. */
  private get collapsible(): boolean {
    const goal = this.tutorial?.step?.goal;
    return goal !== undefined && goal.kind !== 'read';
  }

  private setExpanded(value: boolean): void {
    this.expanded = value;
    this.root.classList.toggle('collapsed', !value);
    this.root.classList.toggle('collapsible', this.collapsible);
    this.bar.setAttribute('aria-expanded', String(value));
  }

  private clearTimer(): void {
    if (this.collapseTimer) window.clearTimeout(this.collapseTimer);
    this.collapseTimer = 0;
  }
}
