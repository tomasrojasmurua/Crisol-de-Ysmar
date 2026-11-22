import {
  ALL_WEAVES,
  COMBOS,
  type Combo,
  ELEMENTS,
  masterOf,
  RECIPE_RULE,
  type School,
  SECOND_ELEMENT_ROLES,
  SPELL_LORE,
  spellName,
} from '@crisol/content';
import { type ElementId, type GameRules, SPELL_WEAVES, spellOf, type Weave } from '@crisol/core';
import type { ComboLog, OwnCombo } from '../game/ComboLog';
import type { Grimoire } from '../game/Grimoire';
import { comboPage, type GrimoireSeen, spellPage } from '../game/GrimoireSeen';
import { POCKET_SIZE, type Pocket } from '../game/Pocket';
import { comboStepsView, spellStepsView } from './comboSteps';
import { el, query } from './dom';
import { BOOKMARK_ICON, elementIcon } from './icons';
import { intentMark } from './intentTag';
import { MENU_ICONS } from './menuIcons';
import { OwnComboEditor } from './OwnComboEditor';
import type { Practice } from './PocketStrip';
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

export type GrimoireTab = ElementId | 'combos';
type Tab = GrimoireTab;

/** Dónde y cómo se abre el Grimorio. */
export interface GrimoireOpening {
  /** La pestaña con que abre (sin ella: la del linaje, o la última que viste). */
  readonly tab?: Tab | undefined;
  /** Abre directo la ficha de este hechizo (aunque no lo hayas descubierto: ver `foreign`). */
  readonly spell?: Weave | undefined;
  /** Si se ofrece Probar (ir a practicarlo frente al muñeco). */
  readonly canTry?: boolean | undefined;
  /** Encima de otra pantalla (Pausa, resultado): Volver regresa a ella. */
  readonly over?: boolean | undefined;
  /** Qué hacer al tocar Volver (por defecto, lo que se dio al crearlo). */
  readonly onClose?: (() => void) | undefined;
}

/** La guía de la primera vez ya se cerró. */
const GUIDE_KEY = 'crisol.grimorioGuia';

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
 * El nombre de un hechizo en las listas del Grimorio, con el ícono de para qué sirve a su lado
 * (Daño, Control, Cura, Apoyo o Movimiento): así se elige de un vistazo sin abrir la ficha.
 */
function spellNameView(weave: Weave): HTMLElement {
  const text = spellName(weave);
  const id = spellOf(weave);
  if (id === null) return el('span', 'grimoire-spell-name', text);
  // El ícono va pegado a la última palabra: si el nombre no cabe, bajan juntos y nunca queda
  // el ícono solo en una línea.
  const cut = text.lastIndexOf(' ') + 1;
  const name = el('span', 'grimoire-spell-name', text.slice(0, cut));
  const tail = el('span', 'grimoire-spell-name-tail', text.slice(cut));
  tail.append(intentMark(id));
  name.append(tail);
  return name;
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
  /** Tu linaje: sus hechizos van destacados y arriba en la pestaña de su elemento. */
  private school: School | null = null;
  private readonly editor: OwnComboEditor;
  /** Si en esta apertura se ofrece Probar. */
  private canTry = false;
  private closeHandler: () => void;
  /** Lo nuevo de la pestaña de combos al abrirla: brilla esa vez y queda leído. */
  private freshCombos = new Set<string>();
  /** Ir a practicar un hechizo o un combo (lo conecta quien arma el juego). */
  onTry: ((practice: Practice) => void) | null = null;
  /** Se leyó una página: el menú vuelve a contar las nuevas. */
  onRead: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onCloseDefault: () => void,
    private readonly rules: () => GameRules,
    private readonly pocket: Pocket,
    private readonly seen: GrimoireSeen,
  ) {
    this.closeHandler = onCloseDefault;
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
    query(this.root, '.grimoire-close').addEventListener('click', () => this.closeHandler());

    for (const element of ELEMENTS) {
      const id = element.id as ElementId;
      this.tabs.append(this.tabButton(id, ELEMENT_NAMES[id], element.color, elementIcon(id)));
    }
    this.tabs.append(this.tabButton('combos', 'Combos', '#f3dfb0', COMBO_TAB_ICON));
    this.editor = new OwnComboEditor(this.root, () => this.render());
  }

  show(
    grimoire: Grimoire,
    comboLog: ComboLog,
    school: School | null = null,
    opening: GrimoireOpening = {},
  ): void {
    this.grimoire = grimoire;
    this.comboLog = comboLog;
    if (school && school !== this.school) this.tab = school.element;
    this.school = school;
    const spell = opening.spell;
    if (opening.tab) this.tab = opening.tab;
    else if (spell?.[0]) this.tab = spell[0];
    this.canTry = opening.canTry ?? false;
    this.closeHandler = opening.onClose ?? this.onCloseDefault;
    this.root.classList.toggle('over', opening.over ?? false);
    this.detail.hidden = true;
    this.render();
    this.root.hidden = false;
    if (spell) this.openDetail(spell);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
    this.freshCombos.clear();
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

  /**
   * La ficha de un conjuro. Si todavía no lo descubres (el que te derribó, abierto desde el
   * resultado), lo dice y no se puede llevar en el bolsillo: queda en tu Grimorio al lanzarlo.
   */
  private openDetail(weave: Weave): void {
    const spell = spellOf(weave);
    if (!spell) return;
    const known = this.grimoire?.has(weave) ?? false;
    if (known && this.seen.markRead([spellPage(weave)])) {
      this.onRead?.();
      const scroll = this.list.scrollTop;
      this.render();
      this.list.scrollTop = scroll;
    }
    const card = spellCard(spell, this.rules());
    card.classList.add('grimoire-card');
    card.style.setProperty('--element', colorOf(weave[0] ?? 'brasa'));
    card.prepend(weaveGlyphs(weave, 'weave-glyphs large'));
    // La nota que dejó en el margen el maestro del primer elemento del tejido.
    const lore = SPELL_LORE[spell];
    const first = weave[0];
    if (lore && first) {
      const note = el('p', 'spell-card-lore');
      const author = masterOf(first).name.split(',')[0] ?? '';
      note.append(el('q', '', lore), el('span', 'spell-card-lore-author', author));
      note.style.setProperty('--element', colorOf(first));
      query(card, '.spell-card-text').after(note);
    }
    const close = el('button', 'grimoire-card-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.innerHTML = '×';
    const actions = el('div', 'grimoire-card-actions');
    if (known) actions.append(this.pocketButton(weave));
    else {
      card.classList.add('foreign');
      actions.append(
        el('p', 'grimoire-card-foreign', 'Aún no lo descubres: lánzalo y quedará en tu Grimorio.'),
      );
    }
    if (this.canTry) actions.append(this.tryButton({ kind: 'spell', weave }));
    card.append(close, actions);
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
        const log = this.comboLog;
        count.textContent = log ? `${log.unlockedCount}/${log.total}` : '';
        const fresh =
          id !== this.tab && log
            ? COMBOS.some((c) => log.isUnlocked(c) && this.seen.isNew(comboPage(c.id)))
            : false;
        tab.classList.toggle('fresh', fresh);
        continue;
      }
      const weaves = ALL_WEAVES.filter((w) => w[0] === id);
      const known = weaves.filter((w) => grimoire.has(w));
      count.textContent = `${known.length}/${weaves.length}`;
      tab.classList.toggle(
        'fresh',
        known.some((w) => this.seen.isNew(spellPage(w))),
      );
    }

    this.list.replaceChildren();
    if (this.tab === 'combos') this.renderCombos(grimoire);
    else this.renderElement(this.tab, grimoire);
    this.renderGuide();
    this.list.scrollTop = 0;
  }

  /**
   * La primera vez, arriba del libro: para qué sirve el Grimorio. Se va al tocar Entendido y
   * no vuelve.
   */
  private renderGuide(): void {
    if (loadFlag(GUIDE_KEY)) return;
    const guide = el('aside', 'grimoire-guide');
    const text = el('p', '');
    text.append(
      el('strong', '', 'Aquí queda todo lo que descubres. '),
      'Cada hechizo que lanzas y cada combo que aciertas tiene su página: léela para pensar tu ' +
        'próxima partida. Marca hasta 3 con el marcador y verás su receta mientras juegas.',
    );
    const ok = el('button', 'secondary grimoire-guide-ok', 'Entendido');
    ok.type = 'button';
    ok.addEventListener('click', () => {
      saveFlag(GUIDE_KEY);
      guide.remove();
    });
    guide.append(text, ok);
    this.list.prepend(guide);
  }

  /** El botón de la ficha para ir a practicarlo frente al muñeco. */
  private tryButton(practice: Practice): HTMLButtonElement {
    const button = el('button', 'grimoire-try-button');
    button.type = 'button';
    button.innerHTML = MENU_ICONS.training;
    button.append(el('span', '', 'Probar'));
    button.setAttribute('aria-label', 'Probar frente al muñeco');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onTry?.(practice);
    });
    return button;
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
    this.renderPocket();
    if (this.school?.element === element) this.renderSchool(this.school);
    const highlighted = new Set(this.school?.spells ?? []);
    for (const group of GROUPS) {
      if (group.length === 2) {
        this.renderRecipe(element, grimoire);
        continue;
      }
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
        card.append(weaveGlyphs(weave), spellNameView(weave));
        if (this.pocket.has(weave)) card.append(pocketMark());
        this.markFresh(card, spellPage(weave));
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
   * Los cinco hechizos de dos elementos que empiezan con este, siempre a la vista con su receta:
   * el segundo elemento dice qué hace, así eliges cuál tejer según lo que necesitas. Los que no
   * descubriste no dicen su nombre: el nombre se gana lanzándolo.
   */
  private renderRecipe(first: ElementId, grimoire: Grimoire): void {
    const weaves = ELEMENTS.map((e): Weave => [first, e.id as ElementId]);
    const found = weaves.filter((w) => grimoire.has(w)).length;
    const section = el('section', 'grimoire-group grimoire-recipe');
    const title = el('h3', 'grimoire-group-title', 'Dos elementos');
    title.append(el('span', 'grimoire-group-count', `${found}/${weaves.length}`));
    const rule = el('p', 'grimoire-recipe-rule', RECIPE_RULE);
    const grid = el('div', 'grimoire-grid');
    for (const weave of weaves) {
      const second = weave[1] as ElementId;
      const known = grimoire.has(weave);
      const card = el(known ? 'button' : 'div', 'grimoire-spell grimoire-recipe-spell');
      card.classList.toggle('unknown', !known);
      const text = el('span', 'grimoire-school-text');
      const role = el('span', 'grimoire-recipe-role', SECOND_ELEMENT_ROLES[second].verb);
      role.style.setProperty('--second', colorOf(second));
      text.append(
        known ? spellNameView(weave) : el('span', 'grimoire-spell-name', 'Por descubrir'),
        role,
      );
      card.append(weaveGlyphs(weave), text);
      card.title = SECOND_ELEMENT_ROLES[second].hint;
      if (known) {
        (card as HTMLButtonElement).type = 'button';
        const id = spellOf(weave);
        card.classList.toggle('school', id !== null && (this.school?.spells ?? []).includes(id));
        if (this.pocket.has(weave)) card.append(pocketMark());
        this.markFresh(card, spellPage(weave));
        card.addEventListener('click', () => this.openDetail(weave));
      }
      grid.append(card);
    }
    section.append(title, rule, grid);
    this.list.append(section);
  }

  /**
   * El botón de la ficha para meter o sacar el hechizo del bolsillo. Con el bolsillo lleno avisa
   * que primero hay que sacar otro. Tocarlo no cierra la ficha.
   */
  private pocketButton(weave: Weave): HTMLButtonElement {
    const button = el('button', 'grimoire-pocket-button');
    button.type = 'button';
    const paint = (): void => {
      const inside = this.pocket.has(weave);
      const blocked = !inside && this.pocket.full;
      button.classList.toggle('inside', inside);
      button.disabled = blocked;
      button.innerHTML = BOOKMARK_ICON;
      button.append(
        el(
          'span',
          '',
          inside
            ? 'En tu bolsillo · sacar'
            : blocked
              ? `Bolsillo lleno (${POCKET_SIZE} de ${POCKET_SIZE}): saca uno primero`
              : 'Llevar en el bolsillo',
        ),
      );
    };
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.pocket.toggle(weave);
      paint();
      const scroll = this.list.scrollTop;
      this.render();
      this.list.scrollTop = scroll;
    });
    paint();
    return button;
  }

  /**
   * Tu bolsillo, arriba de cada pestaña: los hechizos que marcaste para ver su receta en
   * partida, y los huecos que quedan.
   */
  private renderPocket(): void {
    const weaves = this.pocket.weaves;
    const section = el('section', 'grimoire-group grimoire-pocket');
    const title = el('h3', 'grimoire-group-title', 'Tu bolsillo');
    title.append(
      el('span', 'grimoire-group-count', `${weaves.length}/${POCKET_SIZE} · su receta en partida`),
    );
    const grid = el('div', 'grimoire-grid');
    for (const weave of weaves) {
      const card = el('button', 'grimoire-spell');
      card.type = 'button';
      card.style.setProperty('--element', colorOf(weave[0] ?? 'brasa'));
      card.append(weaveGlyphs(weave), spellNameView(weave), pocketMark());
      card.addEventListener('click', () => this.openDetail(weave));
      grid.append(card);
    }
    if (weaves.length < POCKET_SIZE) {
      grid.append(el('span', 'grimoire-spell missing', 'Toca un hechizo para sumarlo'));
    }
    section.append(title, grid);
    this.list.append(section);
  }

  /**
   * Tu linaje, arriba de todo: sus 4 hechizos y Paso, con para qué sirve cada uno. Se ven
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
        spellNameView(weave),
        el('span', 'grimoire-school-role', school.roles[spell] ?? 'Para esquivar'),
      );
      card.append(weaveGlyphs(weave), text);
      if (this.grimoire?.has(weave)) this.markFresh(card, spellPage(weave));
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
          ? 'El tutorial de Entrenamiento te entrega el de tu linaje'
          : left > 0
            ? `Te faltan ${left} por descubrir`
            : 'Los descubriste todos',
        true,
      ),
    );
    const unlocked = COMBOS.filter((c) => log.isUnlocked(c));
    // Lo nuevo brilla mientras la pestaña siga abierta y queda leído.
    const pages = unlocked.map((c) => comboPage(c.id));
    for (const c of unlocked) if (this.seen.isNew(comboPage(c.id))) this.freshCombos.add(c.id);
    if (this.seen.markRead(pages)) this.onRead?.();
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
    for (const combo of combos) {
      const card = comboCard(combo);
      if (this.freshCombos.has(combo.id)) card.append(freshMark());
      card.classList.toggle('fresh', this.freshCombos.has(combo.id));
      // En equipo no se puede probar: frente al muñeco no hay compañero.
      if (this.canTry && !combo.team) card.append(this.tryButton({ kind: 'combo', combo }));
      grid.append(card);
    }
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

  /** Una página que todavía no lees: brilla y dice "Nuevo". */
  private markFresh(card: HTMLElement, page: string): void {
    if (!this.seen.isNew(page)) return;
    card.classList.add('fresh');
    card.append(freshMark());
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

/** La marca de un hechizo que va en el bolsillo. */
function pocketMark(): HTMLElement {
  const mark = el('span', 'grimoire-pocket-mark');
  mark.innerHTML = BOOKMARK_ICON;
  mark.setAttribute('aria-label', 'En tu bolsillo');
  return mark;
}

/** La marca "Nuevo" de una página sin leer. */
function freshMark(): HTMLElement {
  return el('span', 'grimoire-fresh-mark', 'Nuevo');
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function saveFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Sin almacenamiento: la guía vuelve a salir la próxima vez.
  }
}
