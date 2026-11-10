import { SPELL_NAMES } from '@crisol/content';
import { type GameRules, SPELL_WEAVES, type SpellId } from '@crisol/core';
import { el, query } from './dom';
import { weaveOrbs } from './GrimoireBook';
import { spellCard } from './spellFacts';

/**
 * El entrenamiento en pantalla. Arriba a la izquierda, bajo tu vida, el último hechizo que
 * lanzaste: sus colores y su nombre; al tocarlo se despliega qué hace. Arriba a la derecha,
 * una barra chica para quitar el cansancio y salir.
 */
export class TrainingPanel {
  private readonly bar: HTMLElement;
  private readonly spell: HTMLElement;
  private readonly summary: HTMLButtonElement;
  private readonly detail: HTMLElement;
  private readonly rest: HTMLInputElement;
  private shown: SpellId | null = null;

  constructor(
    parent: HTMLElement,
    /** La columna de arriba a la izquierda del HUD (nombre, vida, Presagio). */
    playerColumn: HTMLElement,
    onRestless: (on: boolean) => void,
    onExit: () => void,
  ) {
    this.bar = el('aside', 'training-panel');
    this.bar.hidden = true;
    this.bar.innerHTML = `
      <strong class="training-title">Entrenamiento</strong>
      <label class="training-rest"><input type="checkbox" checked /> Sin cansancio</label>
      <button type="button" class="secondary training-exit">Salir</button>`;
    parent.append(this.bar);
    this.rest = query<HTMLInputElement>(this.bar, '.training-rest input');
    this.rest.addEventListener('change', () => onRestless(this.rest.checked));
    query(this.bar, '.training-exit').addEventListener('click', onExit);

    this.spell = el('div', 'training-spell');
    this.spell.hidden = true;
    this.summary = el('button', 'training-spell-summary');
    this.summary.type = 'button';
    this.summary.setAttribute('aria-expanded', 'false');
    this.detail = el('div', 'training-spell-detail');
    this.detail.hidden = true;
    this.spell.append(this.summary, this.detail);
    // Tocar el nombre despliega el detalle; tocar el detalle lo vuelve a plegar.
    this.summary.addEventListener('click', () =>
      this.setOpen(!this.spell.classList.contains('open')),
    );
    this.detail.addEventListener('click', () => this.setOpen(false));
    playerColumn.append(this.spell);
    this.showEmpty();
  }

  set visible(value: boolean) {
    this.bar.hidden = !value;
    this.spell.hidden = !value;
    if (value) {
      this.rest.checked = true;
      this.showEmpty();
    }
  }

  /** Salió un hechizo tuyo: sus colores y su nombre quedan a la vista. */
  cast(spell: SpellId, rules: GameRules): void {
    if (this.spell.hidden) return;
    if (spell !== this.shown) {
      this.shown = spell;
      const name = el('strong', 'training-spell-name', SPELL_NAMES[spell]);
      this.summary.replaceChildren(
        weaveOrbs(SPELL_WEAVES[spell]),
        name,
        el('span', 'training-spell-chevron', '▾'),
      );
      this.detail.replaceChildren(spellCard(spell, rules));
      this.summary.disabled = false;
    }
    // Un pulso en cada lanzamiento, aunque se repita el mismo hechizo.
    this.spell.classList.remove('pulse');
    void this.spell.offsetWidth;
    this.spell.classList.add('pulse');
  }

  private showEmpty(): void {
    this.shown = null;
    this.summary.replaceChildren(el('span', 'training-spell-empty', 'Teje y lanza con ✦'));
    this.detail.replaceChildren();
    this.summary.disabled = true;
    this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    this.detail.hidden = !open;
    this.spell.classList.toggle('open', open);
    this.summary.setAttribute('aria-expanded', String(open));
  }
}
