import { ELEMENTS, SCHOOLS, type School, SPELL_NAMES } from '@crisol/content';
import { type ElementId, SPELL_WEAVES } from '@crisol/core';
import { el, query } from './dom';
import { weaveGlyphs } from './GrimoireBook';
import { elementIcon } from './icons';

const colorOf = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

/**
 * Elegir escuela, al crear el hechicero: cinco tarjetas, una por elemento, con su estilo y sus 4
 * hechizos. Tocar una la marca; "Elegir" la deja para siempre. No bloquea nada: el resto de
 * los hechizos sigue a mano, solo se aprenden después.
 */
export class SchoolPicker {
  private readonly root: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly confirm: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private chosen: ElementId | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onChoose: (school: ElementId) => void,
  ) {
    this.root = el('div', 'school-picker');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="school-picker-card">
        <header class="school-picker-head">
          <h2>Elige tu escuela</h2>
          <p>Te enseña 4 hechizos para empezar. Es para siempre, pero no te cierra nada: los demás hechizos los descubres jugando.</p>
        </header>
        <div class="school-cards"></div>
        <footer class="school-picker-foot">
          <span class="school-picker-hint">Toca una escuela</span>
          <button type="button" class="primary school-confirm" disabled>Elegir</button>
        </footer>
      </div>`;
    parent.append(this.root);
    this.cards = query(this.root, '.school-cards');
    this.confirm = query(this.root, '.school-confirm');
    this.hint = query(this.root, '.school-picker-hint');
    for (const school of SCHOOLS) this.cards.append(this.card(school));
    this.confirm.addEventListener('click', () => {
      if (!this.chosen) return;
      this.hide();
      this.onChoose(this.chosen);
    });
  }

  show(): void {
    this.chosen = null;
    this.refresh();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  private card(school: School): HTMLElement {
    const card = el('button', 'school-card');
    card.type = 'button';
    card.dataset.element = school.element;
    card.style.setProperty('--element', colorOf(school.element));
    const icon = el('span', 'school-card-icon');
    icon.innerHTML = elementIcon(school.element);
    const list = el('ul', 'school-card-spells');
    for (const spell of school.spells) {
      const item = el('li', 'school-card-spell');
      item.append(
        weaveGlyphs(SPELL_WEAVES[spell], 'weave-glyphs tiny'),
        el('span', 'school-card-spell-name', SPELL_NAMES[spell]),
      );
      item.title = school.roles[spell] ?? '';
      list.append(item);
    }
    card.append(
      icon,
      el('strong', 'school-card-name', school.name.replace('Escuela de ', '')),
      el('span', 'school-card-style', school.style),
      list,
    );
    card.addEventListener('click', () => {
      this.chosen = school.element;
      this.refresh();
    });
    return card;
  }

  private refresh(): void {
    for (const card of this.cards.querySelectorAll<HTMLElement>('.school-card')) {
      card.classList.toggle('selected', card.dataset.element === this.chosen);
    }
    const school = SCHOOLS.find((s) => s.element === this.chosen);
    this.confirm.disabled = !school;
    this.hint.textContent = school ? `${school.name} · ${school.style}` : 'Toca una escuela';
  }
}
