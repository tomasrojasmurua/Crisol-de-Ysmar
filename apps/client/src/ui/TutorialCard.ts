import type { Tutorial } from '../game/Tutorial';
import { comboStepsView, spellStepsView } from './comboSteps';
import { el, query } from './dom';
import { MENU_ICONS } from './menuIcons';
import { richText } from './richText';

/** Recién aparecido un paso, jugar todavía no lo recoge: alcanza a leerse. */
const READ_GRACE_MS = 1500;

/**
 * La guía del tutorial, arriba al centro, en dos tamaños:
 *
 * - Recogida: una sola línea con el capítulo, la orden corta, los signos del hechizo o combo y
 *   cuánto llevas. Es lo que queda mientras juegas, para no tapar el muñeco ni los botones.
 * - Desplegada: además, la explicación completa y los botones (Siguiente, Saltar capítulo).
 *
 * Cada paso nuevo aparece desplegado y se recoge al empezar a jugar (moverte, tejer o girar la
 * cámara), nunca por tiempo: así alcanza a leerse con calma. Tocar la línea la despliega o la
 * recoge. Los pasos que solo se leen quedan desplegados: ahí no hay nada que hacer en la partida.
 * Si llevas rato sin lograr un paso, se despliega con una pista y ya no se recoge sola.
 */
export class TutorialCard {
  private readonly root: HTMLElement;
  private readonly bar: HTMLButtonElement;
  private readonly chapterBadge: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly signs: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly dots: HTMLElement;
  /** "Botón nuevo: Tormenta", cuando el paso estrena un elemento. */
  private readonly fresh: HTMLElement;
  private readonly text: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly actions: HTMLElement;
  private readonly finish: HTMLElement;
  /** La marca de dónde arrastrar para girar la cámara (solo en ese paso). */
  private readonly lookHint: HTMLElement;
  private tutorial: Tutorial | null = null;
  private expanded = true;
  private shownAt = 0;
  /** La pista para quien se trabó (ver `Tutorial.hint`). */
  private readonly hint: HTMLElement;
  /** El ✓ que salta al cumplir un paso. */
  private readonly check: HTMLElement;
  /** Ya se mostró la pista de este paso: la guía queda abierta hasta que lo logres. */
  private hinted = false;

  constructor(
    parent: HTMLElement,
    onFreePlay: () => void,
    /** Terminado el tutorial: al Grimorio, donde quedó lo aprendido (y de ahí al menú). */
    onGrimoire: () => void,
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
        <span class="tutorial-kicker"><span class="tutorial-kicker-title"></span><span class="tutorial-dots" aria-hidden="true"></span></span>
        <span class="tutorial-fresh" hidden></span>
        <p class="tutorial-hint" hidden></p>
        <p class="tutorial-text"></p>
        <div class="tutorial-actions">
          <button type="button" class="primary tutorial-next">Siguiente</button>
          <button type="button" class="secondary tutorial-skip">Saltar capítulo</button>
        </div>
        <div class="tutorial-finish" hidden>
          <button type="button" class="secondary tutorial-free">Práctica libre</button>
          <button type="button" class="primary tutorial-menu">${MENU_ICONS.grimoire}<span>Grimorio</span></button>
        </div>
      </div>`;
    this.check = el('span', 'tutorial-check', '✓');
    this.check.setAttribute('aria-hidden', 'true');
    this.root.append(this.check);
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
    this.kicker = query(this.root, '.tutorial-kicker-title');
    this.dots = query(this.root, '.tutorial-dots');
    this.fresh = query(this.root, '.tutorial-fresh');
    this.hint = query(this.root, '.tutorial-hint');
    this.text = query(this.root, '.tutorial-text');
    this.next = query(this.root, '.tutorial-next');
    this.actions = query(this.root, '.tutorial-actions');
    this.finish = query(this.root, '.tutorial-finish');
    this.bar.addEventListener('click', () => {
      if (!this.collapsible) return;
      this.setExpanded(!this.expanded);
      // Abierta a mano, no se cierra sola enseguida: se lee con calma.
      this.shownAt = performance.now();
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
    query(this.root, '.tutorial-menu').addEventListener('click', onGrimoire);
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
    this.hinted = false;
    this.hint.hidden = true;
    if (!step || !chapter) {
      this.chapterBadge.textContent = '✦';
      this.goal.textContent = '¡Tutorial terminado!';
      this.signs.replaceChildren();
      this.kicker.textContent = 'Tutorial';
      this.dots.replaceChildren();
      this.fresh.hidden = true;
      this.text.textContent =
        'Lo que aprendiste quedó en tu Grimorio, con tu combo. Ahí puedes leer cada hechizo y ' +
        'pensar tu próxima partida. Los combos que faltan se descubren jugando.';
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
    // Un solo contador: el capítulo va en la línea ("4/11"); los pasos del capítulo, en puntitos.
    this.kicker.textContent = chapter.title;
    const total = chapter.steps.length;
    this.dots.replaceChildren(
      ...(total > 1
        ? chapter.steps.map((_, i) =>
            el('span', i < tutorial.stepNumber ? 'tutorial-dot done' : 'tutorial-dot'),
          )
        : []),
    );
    this.dots.parentElement?.setAttribute(
      'aria-label',
      total > 1 ? `${chapter.title}, paso ${tutorial.stepNumber} de ${total}` : chapter.title,
    );
    const fresh = step.fresh ?? [];
    this.fresh.hidden = fresh.length === 0;
    this.fresh.replaceChildren(
      ...(fresh.length > 0
        ? [
            fresh.length > 1 ? 'Botones nuevos: ' : 'Botón nuevo: ',
            richText(fresh.map((e) => `{${e}}`).join(' y ')),
          ]
        : []),
    );
    this.text.replaceChildren(richText(step.text));
    this.refreshProgress();
    this.actions.hidden = false;
    this.next.hidden = !reading;
    this.finish.hidden = true;
    this.lookHint.hidden = !(step.goal.kind === 'signal' && step.goal.signal === 'look');
    this.root.classList.toggle('reading', reading);
    this.setExpanded(true);
    this.shownAt = performance.now();
  }

  /** Cumpliste un paso que se hace jugando: salta un ✓ junto a la guía. */
  celebrate(): void {
    this.check.classList.remove('pop');
    void this.check.offsetWidth;
    this.check.classList.add('pop');
  }

  /**
   * El jugador empezó a jugar (se movió, tejió o giró la cámara): la guía se recoge a su línea.
   * No pasa en los pasos de leer ni apenas aparecido el paso.
   */
  collapse(): void {
    if (!this.expanded || !this.collapsible) return;
    if (this.hinted) return;
    if (performance.now() - this.shownAt < READ_GRACE_MS) return;
    this.setExpanded(false);
  }

  /**
   * La cuenta del paso ("3 de 5") y los avisos, sin volver a animar la tarjeta. Si te trabaste,
   * despliega la pista; devuelve true en ese momento, para que brille el botón que toca.
   */
  refreshProgress(): boolean {
    const progress = this.tutorial?.progress ?? '';
    if (this.progress.textContent !== progress) this.progress.textContent = progress;
    this.progress.hidden = progress === '';
    const hint = this.tutorial?.hint ?? '';
    if (hint === '' || this.hinted) return false;
    this.hinted = true;
    this.hint.replaceChildren(el('strong', '', 'Pista: '), richText(hint));
    this.hint.hidden = false;
    this.setExpanded(true);
    return true;
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
}
