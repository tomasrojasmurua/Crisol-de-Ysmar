import { el, query, setStyle } from './dom';
import { type HighlightView, highlightCard } from './HighlightCard';
import { MENU_ICONS } from './menuIcons';

/**
 * Lo que se ve encima de la repetición: "Repetición" con una barra de avance arriba, la jugada
 * abajo y Saltar en la esquina. Mientras está a la vista, el HUD de la partida se guarda (la
 * vida y el mapa serían de otro momento).
 */
export class ReplayOverlay {
  private readonly root: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly slot: HTMLElement;
  private lastProgress = -1;

  constructor(
    private readonly parent: HTMLElement,
    onSkip: () => void,
  ) {
    this.root = el('div', 'replay');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="replay-head">
        <span class="replay-dot" aria-hidden="true"></span>
        <span class="replay-label">Repetición</span>
        <span class="replay-track"><span class="replay-bar"></span></span>
      </div>
      <div class="replay-slot"></div>
      <button type="button" class="secondary replay-skip">${MENU_ICONS.skip}<span>Saltar</span></button>`;
    parent.append(this.root);
    this.bar = query(this.root, '.replay-bar');
    this.slot = query(this.root, '.replay-slot');
    query(this.root, '.replay-skip').addEventListener('click', onSkip);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Con la jugada, su tarjeta; sin ella (el desenlace), solo un rótulo. */
  show(highlight: HighlightView | null): void {
    this.slot.replaceChildren(
      highlight
        ? highlightCard(highlight, 'replay-highlight')
        : el('p', 'replay-ending', 'El desenlace'),
    );
    this.lastProgress = -1;
    this.setProgress(0);
    this.root.hidden = false;
    this.parent.classList.add('replaying');
  }

  hide(): void {
    this.root.hidden = true;
    this.parent.classList.remove('replaying');
  }

  /** La barra de avance: se toca solo cuando cambia un punto (nada de repintar por cuadro). */
  setProgress(progress: number): void {
    const rounded = Math.round(progress * 100);
    if (rounded === this.lastProgress) return;
    this.lastProgress = rounded;
    setStyle(this.bar, 'transform', `scaleX(${rounded / 100})`);
  }
}
