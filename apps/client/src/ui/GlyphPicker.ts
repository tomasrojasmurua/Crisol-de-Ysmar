import { ELEMENTS, type Glyph } from '@crisol/content';
import { el, query } from './dom';

const NEUTRAL_COLOR = '#d8bf8a';

/** Pantalla entre rondas: eliges 1 Glifo entre 3 (o 4 si perdiste la ronda). */
export class GlyphPicker {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly owned: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly onPick: (glyph: Glyph) => void,
  ) {
    this.root = el('div', 'glyph-picker');
    this.root.hidden = true;
    this.root.innerHTML = `
      <h2>Elige un Glifo</h2>
      <p class="glyph-subtitle"></p>
      <div class="glyph-cards"></div>
      <p class="glyph-owned"></p>`;
    parent.append(this.root);
    this.cards = query(this.root, '.glyph-cards');
    this.subtitle = query(this.root, '.glyph-subtitle');
    this.owned = query(this.root, '.glyph-owned');
  }

  show(options: readonly Glyph[], owned: readonly Glyph[], lostRound: boolean): void {
    this.subtitle.textContent = lostRound
      ? 'Perdiste la ronda: tienes una opción extra'
      : 'Te acompaña hasta el final de la partida';
    this.owned.textContent =
      owned.length > 0 ? `Tus Glifos: ${owned.map((g) => g.name).join(' · ')}` : '';
    this.cards.replaceChildren();
    for (const glyph of options) {
      const card = el('button', 'glyph-card');
      card.type = 'button';
      const color = ELEMENTS.find((e) => e.id === glyph.element)?.color ?? NEUTRAL_COLOR;
      card.style.setProperty('--glyph', color);
      card.append(
        el('span', 'glyph-sigil', sigilFor(glyph)),
        el('strong', 'glyph-name', glyph.name),
        el('span', 'glyph-text', glyph.description),
      );
      card.addEventListener('click', () => {
        this.hide();
        this.onPick(glyph);
      });
      this.cards.append(card);
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }
}

/** Un signo simple para cada Glifo, según su elemento. */
function sigilFor(glyph: Glyph): string {
  switch (glyph.element) {
    case 'brasa':
      return '✺';
    case 'tormenta':
      return 'ϟ';
    case 'marea':
      return '≋';
    case 'raiz':
      return '❦';
    case 'umbra':
      return '☾';
    default:
      return '✦';
  }
}
