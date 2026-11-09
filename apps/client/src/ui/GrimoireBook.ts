import { ALL_WEAVES, ELEMENTS, spellName } from '@crisol/content';
import type { ElementId, Weave } from '@crisol/core';
import type { Grimoire } from '../game/Grimoire';
import { el, query } from './dom';

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
 * El Grimorio: los 155 conjuros por su primer elemento. Los que ya lanzaste muestran su nombre;
 * los demás muestran solo la receta, para que dé ganas de probarlos.
 */
export class GrimoireBook {
  private readonly root: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly list: HTMLElement;
  private readonly progress: HTMLElement;
  private form: ElementId = 'brasa';
  private grimoire: Grimoire | null = null;

  constructor(parent: HTMLElement, onClose: () => void) {
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
      </section>`;
    parent.append(this.root);
    this.tabs = query(this.root, '.grimoire-tabs');
    this.list = query(this.root, '.grimoire-list');
    this.progress = query(this.root, '.grimoire-progress');
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
    for (const weave of ALL_WEAVES.filter((w) => w[0] === this.form)) {
      const known = grimoire.has(weave);
      const card = el('div', `grimoire-spell${known ? ' known' : ''}`);
      card.append(
        weaveOrbs(weave),
        el('span', 'grimoire-spell-name', known ? spellName(weave) : 'Por descubrir'),
      );
      this.list.append(card);
    }
    this.list.scrollTop = 0;
  }
}
