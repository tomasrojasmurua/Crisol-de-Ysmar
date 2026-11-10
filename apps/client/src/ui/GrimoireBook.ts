import { ALL_WEAVES, ELEMENTS, spellName } from '@crisol/content';
import { type ElementId, type GameRules, spellOf, type Weave } from '@crisol/core';
import type { Grimoire } from '../game/Grimoire';
import { el, query } from './dom';
import { spellCard } from './spellFacts';

/** Las pestañas agrupan los conjuros por su primer elemento. */
const TAB_NAMES: Record<ElementId, string> = {
  brasa: 'Brasa',
  tormenta: 'Tormenta',
  marea: 'Marea',
  raiz: 'Raíz',
  umbra: 'Umbra',
};

const colorOf = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

/** Las bolitas de un tejido, en orden: así se lee cómo se teje cada conjuro. */
export function weaveOrbs(weave: Weave): HTMLElement {
  const orbs = el('span', 'weave-orbs');
  for (const element of weave) {
    const orb = el('span', 'weave-orb');
    orb.style.setProperty('--element', colorOf(element));
    orbs.append(orb);
  }
  return orbs;
}

/**
 * El Grimorio: los conjuros que ya descubriste, por su primer elemento. Los que faltan no se
 * muestran: hay que encontrarlos tejiendo. Tocar uno abre su ficha con qué hace y sus datos.
 */
export class GrimoireBook {
  private readonly root: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly list: HTMLElement;
  private readonly progress: HTMLElement;
  private form: ElementId = 'brasa';
  private grimoire: Grimoire | null = null;
  private readonly detail: HTMLElement;

  constructor(
    parent: HTMLElement,
    onClose: () => void,
    private readonly rules: () => GameRules,
  ) {
    this.root = el('div', 'grimoire');
    this.root.hidden = true;
    this.root.innerHTML = `
      <section class="grimoire-book">
        <header class="grimoire-head">
          <div>
            <h2>Grimorio</h2>
            <p class="grimoire-progress"></p>
          </div>
          <button type="button" class="secondary grimoire-close">Volver</button>
        </header>
        <nav class="grimoire-tabs"></nav>
        <div class="grimoire-list"></div>
        <div class="grimoire-detail" hidden></div>
      </section>`;
    parent.append(this.root);
    this.tabs = query(this.root, '.grimoire-tabs');
    this.list = query(this.root, '.grimoire-list');
    this.progress = query(this.root, '.grimoire-progress');
    this.detail = query(this.root, '.grimoire-detail');
    this.detail.addEventListener('click', () => {
      this.detail.hidden = true;
    });
    query(this.root, '.grimoire-close').addEventListener('click', onClose);

    for (const element of ELEMENTS) {
      const id = element.id as ElementId;
      const tab = el('button', 'grimoire-tab');
      tab.type = 'button';
      tab.dataset.id = id;
      tab.style.setProperty('--element', element.color);
      tab.append(el('strong', '', TAB_NAMES[id]), el('span', 'grimoire-tab-count'));
      tab.addEventListener('click', () => {
        this.form = id;
        this.render();
      });
      this.tabs.append(tab);
    }
  }

  show(grimoire: Grimoire): void {
    this.grimoire = grimoire;
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.detail.hidden = true;
  }

  /** La ficha de un conjuro ya descubierto. */
  private openDetail(weave: Weave): void {
    const spell = spellOf(weave);
    if (!spell) return;
    this.detail.replaceChildren();
    const card = spellCard(spell, this.rules());
    card.prepend(weaveOrbs(weave));
    card.append(el('span', 'spell-card-close', 'Toca para cerrar'));
    this.detail.append(card);
    this.detail.hidden = false;
  }

  private render(): void {
    const grimoire = this.grimoire;
    if (!grimoire) return;
    this.progress.textContent = `${grimoire.count} de ${grimoire.total} conjuros descubiertos`;

    for (const tab of this.tabs.querySelectorAll<HTMLElement>('.grimoire-tab')) {
      const id = tab.dataset.id as ElementId;
      const weaves = ALL_WEAVES.filter((w) => w[0] === id);
      const known = weaves.filter((w) => grimoire.has(w)).length;
      tab.classList.toggle('selected', id === this.form);
      query(tab, '.grimoire-tab-count').textContent = `${known}/${weaves.length}`;
    }

    this.list.replaceChildren();
    this.list.style.setProperty('--element', colorOf(this.form));
    const weaves = ALL_WEAVES.filter((w) => w[0] === this.form);
    const known = weaves.filter((w) => grimoire.has(w));
    for (const weave of known) {
      const card = el('button', 'grimoire-spell known');
      card.type = 'button';
      card.append(weaveOrbs(weave), el('span', 'grimoire-spell-name', spellName(weave)));
      card.addEventListener('click', () => this.openDetail(weave));
      this.list.append(card);
    }
    const left = weaves.length - known.length;
    if (left > 0) {
      const hint =
        known.length === 0
          ? `Todavía no descubres conjuros que empiecen con ${TAB_NAMES[this.form]}: ¡a tejer!`
          : `Te faltan ${left} por descubrir`;
      this.list.append(el('p', 'grimoire-missing', hint));
    }
    this.list.scrollTop = 0;
  }
}
