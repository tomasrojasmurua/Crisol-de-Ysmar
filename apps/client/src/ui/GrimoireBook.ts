import { ALL_WEAVES, COMBOS, type Combo, ELEMENTS, type School, spellName } from '@crisol/content';
import { type ElementId, type GameRules, SPELL_WEAVES, spellOf, type Weave } from '@crisol/core';
import type { ComboLog, OwnCombo } from '../game/ComboLog';
import type { Grimoire } from '../game/Grimoire';
import { comboStepsView, spellStepsView } from './comboSteps';
import { el, query } from './dom';
import { elementIcon } from './icons';
import { MENU_ICONS } from './menuIcons';
import { OwnComboEditor } from './OwnComboEditor';
import { spellCard } from './spellFacts';

const ELEMENT_NAMES: Record<ElementId, string> = {
  brasa: 'Brasa',
  tormenta: 'Tormenta',
  marea: 'Marea',
  raiz: 'Raíz',
  umbra: 'Umbra',
};

/** Los conjuros de cada pestaña, por largo: así se lee de lo simple a lo grande. */
const GROUPS: readonly { readonly length: number; readonly name: string }[] = [
  { length: 1, name: 'Básico' },
  { length: 2, name: 'Dos elementos' },
  { length: 3, name: 'Grandes hechizos' },
];

/** Dos rombos enlazados: la pestaña de combos no es de ningún elemento. */
const COMBO_TAB_ICON =
  '<svg class="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M11 6L18 13L11 20L4 13Z"/><path d="M21 12L28 19L21 26L14 19Z"/></svg>';

const colorOf = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

type Tab = ElementId | 'combos';

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

/** Los signos de un tejido, en orden y con su color: se distinguen también sin color. */
export function weaveGlyphs(weave: Weave, className = 'weave-glyphs'): HTMLElement {
  const glyphs = el('span', className);
  for (const element of weave) {
    const glyph = el('span', 'weave-glyph');
    glyph.style.setProperty('--element', colorOf(element));
    glyph.innerHTML = elementIcon(element);
    glyphs.append(glyph);
  }
  return glyphs;
}

/**
 * El Grimorio: los conjuros que ya descubriste, por su primer elemento y de lo simple a lo
 * grande. Los que faltan no se muestran, solo cuántos quedan en cada grupo: hay que
 * encontrarlos tejiendo. Tocar uno abre su ficha con qué hace y sus datos.
 */
export class GrimoireBook {
  private readonly root: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly list: HTMLElement;
  private readonly progressText: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly detail: HTMLElement;
  /** La pestaña abierta: un elemento o los combos. */
  private tab: Tab = 'brasa';
  private grimoire: Grimoire | null = null;
  private comboLog: ComboLog | null = null;
  /** Tu escuela: sus hechizos van destacados y arriba en la pestaña de su elemento. */
  private school: School | null = null;
  private readonly editor: OwnComboEditor;

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
          <button type="button" class="secondary grimoire-close" aria-label="Volver">${MENU_ICONS.back}</button>
          <div class="grimoire-title">
            <h2>Grimorio</h2>
            <div class="grimoire-progress">
              <span class="grimoire-progress-track"><span class="grimoire-progress-fill"></span></span>
              <span class="grimoire-progress-text"></span>
            </div>
          </div>
          <nav class="grimoire-tabs"></nav>
        </header>
        <div class="grimoire-list"></div>
        <div class="grimoire-detail" hidden></div>
      </section>`;
    parent.append(this.root);
    this.tabs = query(this.root, '.grimoire-tabs');
    this.list = query(this.root, '.grimoire-list');
    this.progressText = query(this.root, '.grimoire-progress-text');
    this.progressFill = query(this.root, '.grimoire-progress-fill');
    this.detail = query(this.root, '.grimoire-detail');
    this.detail.addEventListener('click', () => {
      this.detail.hidden = true;
    });
    query(this.root, '.grimoire-close').addEventListener('click', onClose);

    for (const element of ELEMENTS) {
      const id = element.id as ElementId;
      this.tabs.append(this.tabButton(id, ELEMENT_NAMES[id], element.color, elementIcon(id)));
    }
    this.tabs.append(this.tabButton('combos', 'Combos', '#f3dfb0', COMBO_TAB_ICON));
    this.editor = new OwnComboEditor(this.root, () => this.render());
  }

  show(grimoire: Grimoire, comboLog: ComboLog, school: School | null = null): void {
    this.grimoire = grimoire;
    this.comboLog = comboLog;
    if (school && school !== this.school) this.tab = school.element;
    this.school = school;
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.detail.hidden = true;
    this.editor.hide();
  }

  private tabButton(id: Tab, name: string, color: string, icon: string): HTMLButtonElement {
    const tab = el('button', 'grimoire-tab');
    tab.type = 'button';
    tab.dataset.id = id;
    tab.setAttribute('aria-label', name);
    tab.style.setProperty('--element', color);
    tab.innerHTML = icon;
    tab.append(el('span', 'grimoire-tab-count'));
    tab.addEventListener('click', () => {
      this.tab = id;
      this.render();
    });
    return tab;
  }

  /** La ficha de un conjuro ya descubierto. */
  private openDetail(weave: Weave): void {
    const spell = spellOf(weave);
    if (!spell) return;
    const card = spellCard(spell, this.rules());
    card.classList.add('grimoire-card');
    card.style.setProperty('--element', colorOf(weave[0] ?? 'brasa'));
    card.prepend(weaveGlyphs(weave, 'weave-glyphs large'));
    const close = el('button', 'grimoire-card-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.innerHTML = '×';
    card.append(close);
    this.detail.replaceChildren(card);
    this.detail.hidden = false;
  }

  private render(): void {
    const grimoire = this.grimoire;
    if (!grimoire) return;
    this.progressText.textContent = `${grimoire.count} de ${grimoire.total}`;
    this.progressFill.style.transform = `scaleX(${grimoire.count / grimoire.total})`;

    for (const tab of this.tabs.querySelectorAll<HTMLElement>('.grimoire-tab')) {
      const id = tab.dataset.id as Tab;
      tab.classList.toggle('selected', id === this.tab);
      tab.setAttribute('aria-pressed', String(id === this.tab));
      const count = query(tab, '.grimoire-tab-count');
      if (id === 'combos') {
        count.textContent = this.comboLog
          ? `${this.comboLog.unlockedCount}/${this.comboLog.total}`
          : '';
        continue;
      }
      const weaves = ALL_WEAVES.filter((w) => w[0] === id);
      count.textContent = `${weaves.filter((w) => grimoire.has(w)).length}/${weaves.length}`;
    }

    this.list.replaceChildren();
    if (this.tab === 'combos') this.renderCombos(grimoire);
    else this.renderElement(this.tab, grimoire);
    this.list.scrollTop = 0;
  }

  private renderElement(element: ElementId, grimoire: Grimoire): void {
    this.list.style.setProperty('--element', colorOf(element));
    const weaves = ALL_WEAVES.filter((w) => w[0] === element);
    const known = weaves.filter((w) => grimoire.has(w));
    this.list.append(
      this.heading(
        elementIcon(element),
        ELEMENT_NAMES[element],
        `${known.length} de ${weaves.length}`,
        known.length === 0
          ? `Todavía no descubres conjuros que empiecen con ${ELEMENT_NAMES[element]}: ¡a tejer!`
          : 'Conjuros que empiezan con este elemento',
      ),
    );
    if (this.school?.element === element) this.renderSchool(this.school);
    const highlighted = new Set(this.school?.spells ?? []);
    for (const group of GROUPS) {
      const inGroup = weaves.filter((w) => w.length === group.length);
      const found = inGroup.filter((w) => grimoire.has(w));
      const section = el('section', 'grimoire-group');
      const title = el('h3', 'grimoire-group-title', group.name);
      title.append(el('span', 'grimoire-group-count', `${found.length}/${inGroup.length}`));
      const grid = el('div', 'grimoire-grid');
      for (const weave of found) {
        const card = el('button', 'grimoire-spell');
        card.type = 'button';
        const id = spellOf(weave);
        card.classList.toggle('school', id !== null && highlighted.has(id));
        card.append(weaveGlyphs(weave), el('span', 'grimoire-spell-name', spellName(weave)));
        card.addEventListener('click', () => this.openDetail(weave));
        grid.append(card);
      }
      const left = inGroup.length - found.length;
      if (left > 0) {
        grid.append(
          el(
            'span',
            'grimoire-spell missing',
            left === 1 ? '1 por descubrir' : `${left} por descubrir`,
          ),
        );
      }
      section.append(title, grid);
      this.list.append(section);
    }
  }

  /**
   * Tu escuela, arriba de todo: sus 4 hechizos y Paso, con para qué sirve cada uno. Se ven
   * aunque todavía no los lances: son los que el tutorial te enseña.
   */
  private renderSchool(school: School): void {
    const section = el('section', 'grimoire-group grimoire-school');
    section.append(el('h3', 'grimoire-group-title', school.name));
    const grid = el('div', 'grimoire-grid');
    for (const spell of [
      ...school.spells,
      ...(school.spells.includes('step') ? [] : ['step' as const]),
    ]) {
      const weave = SPELL_WEAVES[spell];
      const card = el('button', 'grimoire-spell school');
      card.type = 'button';
      const text = el('span', 'grimoire-school-text');
      text.append(
        el('span', 'grimoire-spell-name', spellName(weave)),
        el('span', 'grimoire-school-role', school.roles[spell] ?? 'Para esquivar'),
      );
      card.append(weaveGlyphs(weave), text);
      card.addEventListener('click', () => this.openDetail(weave));
      grid.append(card);
    }
    section.append(grid);
    this.list.append(section);
  }

  /**
   * Los combos del catálogo que ya aparecieron (reacciones y seguidillas), cuántos faltan sin
   * decir cuáles, y la hoja de Mis combos.
   */
  private renderCombos(grimoire: Grimoire): void {
    const log = this.comboLog;
    if (!log) return;
    this.list.style.setProperty('--element', '#f3dfb0');
    const left = log.total - log.unlockedCount;
    this.list.append(
      this.heading(
        COMBO_TAB_ICON,
        'Combos',
        `${log.unlockedCount} de ${log.total}`,
        !log.tutorialDone
          ? 'El tutorial de Entrenamiento te entrega el de tu escuela'
          : left > 0
            ? `Te faltan ${left} por descubrir`
            : 'Los descubriste todos',
        true,
      ),
    );
    const unlocked = COMBOS.filter((c) => log.isUnlocked(c));
    this.comboGroup(
      'Reacciones',
      unlocked.filter((c) => c.reaction),
    );
    this.comboGroup(
      'Seguidillas',
      unlocked.filter((c) => !c.reaction).sort((a, b) => a.level - b.level),
      left,
    );

    const own = el('section', 'grimoire-group');
    const title = el('h3', 'grimoire-group-title', 'Mis combos');
    title.append(el('span', 'grimoire-group-count', String(log.ownCombos.length)));
    const grid = el('div', 'grimoire-grid wide');
    for (const combo of log.ownCombos) grid.append(this.ownCard(combo, log, grimoire));
    const add = el('button', 'grimoire-spell missing grimoire-add', '+ Anotar un combo');
    add.type = 'button';
    add.addEventListener('click', () => this.editor.open(log, grimoire, null));
    grid.append(add);
    own.append(title, grid);
    this.list.append(own);
  }

  private comboGroup(name: string, combos: readonly Combo[], left = 0): void {
    if (combos.length === 0 && left === 0) return;
    const section = el('section', 'grimoire-group');
    const title = el('h3', 'grimoire-group-title', name);
    title.append(el('span', 'grimoire-group-count', String(combos.length)));
    const grid = el('div', 'grimoire-grid wide');
    for (const combo of combos) grid.append(comboCard(combo));
    if (left > 0) {
      grid.append(
        el(
          'span',
          'grimoire-spell missing',
          left === 1 ? '1 por descubrir' : `${left} por descubrir`,
        ),
      );
    }
    section.append(title, grid);
    this.list.append(section);
  }

  private ownCard(combo: OwnCombo, log: ComboLog, grimoire: Grimoire): HTMLElement {
    const card = el('button', 'grimoire-spell grimoire-combo own');
    card.type = 'button';
    const head = el('span', 'grimoire-combo-head');
    head.append(el('span', 'grimoire-spell-name', combo.name), spellStepsView(combo.steps));
    card.append(head);
    if (combo.note) card.append(el('span', 'grimoire-combo-detail', combo.note));
    card.addEventListener('click', () => this.editor.open(log, grimoire, combo));
    return card;
  }

  private heading(
    icon: string,
    name: string,
    count: string,
    hint: string,
    keepHint = false,
  ): HTMLElement {
    const head = el('header', 'grimoire-section-head');
    const sigil = el('span', 'grimoire-section-sigil');
    sigil.innerHTML = icon;
    const text = el('div', 'grimoire-section-text');
    const title = el('h3', '', name);
    if (count) title.append(el('span', 'grimoire-section-count', count));
    text.append(title, el('p', keepHint ? 'keep' : '', hint));
    head.append(sigil, text);
    return head;
  }
}

/** Una ficha de combo: nombre y nivel, los signos de sus pasos y qué pasa. */
function comboCard(combo: Combo): HTMLElement {
  const card = el('div', 'grimoire-spell grimoire-combo');
  const head = el('span', 'grimoire-combo-head');
  const name = el('span', 'grimoire-spell-name', combo.name);
  name.append(el('span', 'grimoire-combo-level', '★'.repeat(combo.level)));
  head.append(name, comboStepsView(combo));
  card.append(head, el('span', 'grimoire-combo-detail', combo.detail));
  if (combo.team) card.append(el('span', 'grimoire-combo-tag', 'En equipo'));
  return card;
}
