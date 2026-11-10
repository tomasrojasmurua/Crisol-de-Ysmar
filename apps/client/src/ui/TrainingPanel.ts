import type { GameRules } from '@crisol/core';
import { type SpellId, spellOf, type Wizard } from '@crisol/core';
import { el, query } from './dom';
import { weaveOrbs } from './GrimoireBook';
import { spellCard } from './spellFacts';

/**
 * El panel del entrenamiento: lo que estás tejiendo ahora y qué hechizo sale, con su
 * descripción; y el último que lanzaste. También deja quitar el cansancio y salir.
 */
export class TrainingPanel {
  private readonly root: HTMLElement;
  private readonly weaving: HTMLElement;
  private readonly last: HTMLElement;
  private readonly rest: HTMLInputElement;
  private shownWeave = '-';
  private shownLast: SpellId | null = null;

  constructor(parent: HTMLElement, onRestless: (on: boolean) => void, onExit: () => void) {
    this.root = el('aside', 'training-panel');
    this.root.hidden = true;
    this.root.innerHTML = `
      <header class="training-head">
        <button type="button" class="training-toggle" aria-expanded="true">
          <strong>Entrenamiento</strong> <span class="training-chevron">▾</span>
        </button>
        <label class="training-rest"><input type="checkbox" checked /> Sin cansancio</label>
        <button type="button" class="secondary training-exit">Salir</button>
      </header>
      <div class="training-body">
        <p class="training-label">Tejiendo</p>
        <div class="training-weaving"></div>
        <p class="training-label">Último lanzado</p>
        <div class="training-last"><p class="training-empty">Lanza algo con ✦</p></div>
      </div>`;
    parent.append(this.root);
    this.weaving = query(this.root, '.training-weaving');
    this.last = query(this.root, '.training-last');
    this.rest = query(this.root, '.training-rest input') as HTMLInputElement;
    this.rest.addEventListener('change', () => onRestless(this.rest.checked));
    query(this.root, '.training-exit').addEventListener('click', onExit);
    // En pantallas bajas el panel se puede plegar para ver la arena entera.
    const toggle = query(this.root, '.training-toggle');
    toggle.addEventListener('click', () => {
      const folded = this.root.classList.toggle('folded');
      toggle.setAttribute('aria-expanded', String(!folded));
    });
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
    if (value) {
      this.shownWeave = '-';
      this.shownLast = null;
      this.rest.checked = true;
      this.last.replaceChildren(el('p', 'training-empty', 'Lanza algo con ✦'));
    }
  }

  /** Cada cuadro: muestra el tejido del mago y el hechizo que sale, si cambió. */
  update(player: Wizard, rules: GameRules): void {
    if (this.root.hidden) return;
    const weave = player.channel?.weave ?? player.weave;
    const key = weave.join(',');
    if (key === this.shownWeave) return;
    this.shownWeave = key;
    this.weaving.replaceChildren();
    const spell = weave.length > 0 ? spellOf(weave) : null;
    if (!spell) {
      this.weaving.append(el('p', 'training-empty', 'Toca hasta 3 elementos'));
      return;
    }
    const card = spellCard(spell, rules);
    card.prepend(weaveOrbs(weave));
    if (weave.length < 3) {
      card.append(el('span', 'training-more', 'Puedes sumar otro elemento'));
    }
    this.weaving.append(card);
  }

  /** Salió un hechizo: queda como el último lanzado. */
  cast(spell: SpellId, rules: GameRules): void {
    if (this.root.hidden || spell === this.shownLast) return;
    this.shownLast = spell;
    this.last.replaceChildren(spellCard(spell, rules));
  }
}
