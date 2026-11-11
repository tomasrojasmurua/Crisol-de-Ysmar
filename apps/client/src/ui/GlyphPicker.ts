import { ELEMENTS, type Glyph } from '@crisol/content';
import { el, query } from './dom';
import { glyphIcon } from './icons';

const NEUTRAL_COLOR = '#d8bf8a';

/**
 * Las cartas no responden hasta terminar de entrar: el pulgar suele venir tocando de la ronda
 * anterior y no debe elegir un Glifo sin querer.
 */
const ARM_MS = 550;

/** Pantalla entre rondas: eliges 1 Glifo entre 3 (o 4 si perdiste la ronda). */
export class GlyphPicker {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly owned: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly clockText: HTMLElement;
  private readonly clockFill: HTMLElement;
  private armTimer: number | undefined;
  private armed = false;
  /** Segundos que tenía el reloj al abrir: la barra se vacía en proporción. */
  private clockTotal = 0;
  private lastClock = -1;

  constructor(
    parent: HTMLElement,
    private readonly onPick: (glyph: Glyph) => void,
  ) {
    this.root = el('div', 'glyph-picker');
    this.root.hidden = true;
    this.root.innerHTML = `
      <header class="glyph-head">
        <h2>Elige un Glifo</h2>
        <p class="glyph-subtitle"></p>
      </header>
      <div class="glyph-cards"></div>
      <footer class="glyph-foot">
        <div class="glyph-owned"></div>
        <div class="glyph-clock" hidden>
          <span class="glyph-clock-track"><span class="glyph-clock-fill"></span></span>
          <span class="glyph-clock-text"></span>
        </div>
      </footer>`;
    parent.append(this.root);
    this.cards = query(this.root, '.glyph-cards');
    this.subtitle = query(this.root, '.glyph-subtitle');
    this.owned = query(this.root, '.glyph-owned');
    this.clock = query(this.root, '.glyph-clock');
    this.clockText = query(this.root, '.glyph-clock-text');
    this.clockFill = query(this.root, '.glyph-clock-fill');
  }

  /**
   * `secondsLeft` es el tiempo para elegir antes de que la Sala elija al azar (solo en red);
   * `null` si no hay apuro.
   */
  show(
    options: readonly Glyph[],
    owned: readonly Glyph[],
    lostRound: boolean,
    secondsLeft: number | null = null,
  ): void {
    this.subtitle.textContent = lostRound
      ? 'Perdiste la ronda: tienes una opción extra'
      : 'Te acompaña hasta el final de la partida';
    this.renderOwned(owned);
    this.cards.replaceChildren(...options.map((glyph) => this.card(glyph)));
    this.cards.classList.toggle('four', options.length > 3);
    this.clockTotal = secondsLeft ?? 0;
    this.lastClock = -1;
    this.clock.hidden = secondsLeft === null;
    if (secondsLeft !== null) this.setClock(secondsLeft);

    this.armed = false;
    this.root.classList.remove('armed');
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => {
      this.armed = true;
      this.root.classList.add('armed');
    }, ARM_MS);
    this.root.hidden = false;
  }

  /** Actualiza la cuenta regresiva (en red). */
  setClock(secondsLeft: number): void {
    const whole = Math.max(0, Math.ceil(secondsLeft));
    if (whole === this.lastClock) return;
    this.lastClock = whole;
    this.clockText.textContent = `Se elige al azar en ${whole} s`;
    const ratio = this.clockTotal > 0 ? Math.min(1, secondsLeft / this.clockTotal) : 0;
    this.clockFill.style.transform = `scaleX(${ratio})`;
    this.clock.classList.toggle('urgent', whole <= 5);
  }

  hide(): void {
    window.clearTimeout(this.armTimer);
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  private card(glyph: Glyph): HTMLButtonElement {
    const card = el('button', 'glyph-card');
    card.type = 'button';
    card.style.setProperty('--glyph', glyphColor(glyph));
    const sigil = el('span', 'glyph-sigil');
    sigil.innerHTML = glyphIcon(glyph);
    card.append(
      sigil,
      el('strong', 'glyph-name', glyph.name),
      el('span', 'glyph-text', glyph.description),
    );
    card.addEventListener('click', () => {
      if (!this.armed) return;
      this.hide();
      this.onPick(glyph);
    });
    return card;
  }

  private renderOwned(owned: readonly Glyph[]): void {
    this.owned.replaceChildren();
    if (owned.length === 0) return;
    this.owned.append(el('span', 'glyph-owned-label', 'Tus Glifos'));
    for (const glyph of owned) {
      const chip = el('span', 'glyph-chip');
      chip.style.setProperty('--glyph', glyphColor(glyph));
      chip.innerHTML = glyphIcon(glyph);
      chip.append(el('span', '', glyph.name));
      this.owned.append(chip);
    }
  }
}

function glyphColor(glyph: Glyph): string {
  return ELEMENTS.find((e) => e.id === glyph.element)?.color ?? NEUTRAL_COLOR;
}
