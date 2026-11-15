import {
  AFFINITY_LOOKS,
  AFFINITY_RULES,
  ARCHETYPES,
  CAPES,
  ELEMENTS,
  FACES,
  FOCI,
  fitsFace,
  HEADWEAR,
  type LookIds,
  type LookOption,
  MASKS,
  OUTFITS,
  ROBE_COLORS,
  SKIN_TONES,
  TRIM_COLORS,
} from '@crisol/content';
import { type ElementId, isElementId, opposingOf, SeededRng } from '@crisol/core';
import { cleanName, NAME_MAX_LENGTH, type Profile, randomAppearance } from '../game/Profile';
import { Dropdown } from './Dropdown';
import { el, query } from './dom';

const elementName = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.name ?? id;

type TabId = 'mago' | 'aspecto' | 'ropa';

const TABS: readonly { readonly id: TabId; readonly name: string }[] = [
  { id: 'mago', name: 'Mago' },
  { id: 'aspecto', name: 'Aspecto' },
  { id: 'ropa', name: 'Ropa' },
];

/** Un ajuste del aspecto: una fila con su desplegable. */
interface Row {
  readonly key: keyof LookIds;
  readonly title: string;
  readonly options: readonly LookOption[];
}

const ROWS: Readonly<Record<Exclude<TabId, 'mago'>, readonly Row[]>> = {
  aspecto: [
    { key: 'face', title: 'Linaje', options: FACES },
    { key: 'skin', title: 'Piel', options: SKIN_TONES },
    { key: 'mask', title: 'Rostro', options: MASKS },
    { key: 'headwear', title: 'Cabeza', options: HEADWEAR },
  ],
  ropa: [
    { key: 'outfit', title: 'Ropa', options: OUTFITS },
    { key: 'robe', title: 'Color', options: ROBE_COLORS },
    { key: 'trim', title: 'Adornos', options: TRIM_COLORS },
    { key: 'cape', title: 'Capa', options: CAPES },
    { key: 'focus', title: 'Foco', options: FOCI },
  ],
};

/** El valor del desplegable de arquetipos cuando el aspecto ya no es ninguno de ellos. */
const OWN_LOOK = 'A tu medida';

/**
 * El Vestidor: nombre, Afinidad y todas las piezas del hechicero, en tres pestañas. Cada ajuste es
 * una sola fila con un desplegable (y flechas para probar uno por uno), así todo cabe sin
 * deslizar y el mago en 3D queda a la vista en el espacio libre. Todo es cosmético salvo la
 * Afinidad. Los arquetipos arman un hechicero de una vez y "Al azar" sortea uno que respete las
 * combinaciones.
 */
export class Wardrobe {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly affinityDetail: HTMLElement;
  private readonly pages = new Map<TabId, HTMLElement>();
  private readonly tabButtons = new Map<TabId, HTMLElement>();
  private readonly lookPickers: { readonly row: Row; readonly picker: Dropdown }[] = [];
  private readonly archetypePicker: Dropdown;
  private readonly affinityPicker: Dropdown;
  private profile: Profile;
  private tab: TabId = 'mago';
  /** Qué parte del ancho queda libre a la izquierda del panel (0 a 1), para encuadrar al mago. */
  private freeWidth = 0.5;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (profile: Profile) => void,
    private readonly onDone: (profile: Profile) => void,
    initial: Profile,
  ) {
    this.profile = initial;
    this.root = el('div', 'wardrobe');
    this.root.hidden = true;
    this.root.innerHTML = `
      <section class="wardrobe-panel">
        <nav class="wardrobe-tabs"></nav>
        <div class="wardrobe-body">
          <div class="wardrobe-page" data-page="mago">
            <label class="wardrobe-line wardrobe-name">
              <span class="wardrobe-line-title">Nombre</span>
              <input type="text" maxlength="${NAME_MAX_LENGTH}" autocomplete="off"
                autocapitalize="words" spellcheck="false" placeholder="¿Cómo te llaman?" />
            </label>
            <div class="wardrobe-line wardrobe-affinity-line">
              <span class="wardrobe-line-title">Afinidad</span>
            </div>
            <p class="wardrobe-affinity-detail"></p>
            <div class="wardrobe-line wardrobe-archetype-line">
              <span class="wardrobe-line-title">Arquetipo</span>
            </div>
          </div>
        </div>
        <div class="wardrobe-actions">
          <button type="button" class="secondary wardrobe-random">✦ Al azar</button>
          <button type="button" class="primary wardrobe-done">Listo</button>
        </div>
      </section>`;
    parent.append(this.root);
    this.panel = query(this.root, '.wardrobe-panel');
    this.nameInput = query<HTMLInputElement>(this.root, 'input');
    this.affinityDetail = query(this.root, '.wardrobe-affinity-detail');
    this.pages.set('mago', query(this.root, '[data-page="mago"]'));

    this.nameInput.addEventListener('input', () => {
      this.update({ ...this.profile, name: this.nameInput.value });
      this.nameInput.classList.remove('missing');
    });
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.nameInput.blur();
    });
    query(this.root, '.wardrobe-done').addEventListener('click', () => this.finish());
    query(this.root, '.wardrobe-random').addEventListener('click', () => {
      const rng = new SeededRng((Math.random() * 2 ** 32) >>> 0);
      this.update({ ...this.profile, look: randomAppearance(rng) });
    });

    this.buildTabs();
    this.affinityPicker = new Dropdown({
      title: 'Afinidad',
      host: this.panel,
      arrows: true,
      colorAs: 'text',
      options: [
        { id: '', label: 'Ninguna' },
        ...ELEMENTS.map((e) => ({ id: e.id, label: e.name, color: e.color })),
      ],
      onPick: (id) => this.update({ ...this.profile, affinity: id && isElementId(id) ? id : null }),
    });
    query(this.root, '.wardrobe-affinity-line').append(this.affinityPicker.root);
    this.archetypePicker = new Dropdown({
      title: 'Arquetipo',
      host: this.panel,
      arrows: true,
      placeholder: OWN_LOOK,
      options: ARCHETYPES.map((a) => ({ id: a.id, label: a.name })),
      onPick: (id) => {
        const archetype = ARCHETYPES.find((a) => a.id === id);
        if (archetype) this.update({ ...this.profile, look: archetype.look });
      },
    });
    query(this.root, '.wardrobe-archetype-line').append(this.archetypePicker.root);

    const body = query(this.root, '.wardrobe-body');
    for (const [tab, rows] of Object.entries(ROWS) as [Exclude<TabId, 'mago'>, readonly Row[]][]) {
      const page = el('div', 'wardrobe-page');
      for (const row of rows) this.buildRow(page, row);
      body.append(page);
      this.pages.set(tab, page);
    }
    window.addEventListener('resize', () => this.measure());
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /**
   * La franja libre a la izquierda del panel, como parte del ancho de la pantalla (0 a 1): ahí
   * se encuadra al mago para que el panel nunca lo tape.
   */
  get stageWidth(): number {
    return this.freeWidth;
  }

  show(profile: Profile): void {
    this.profile = profile;
    this.nameInput.value = profile.name;
    // La primera vez se parte por el nombre; después, por los arquetipos y el resto.
    this.tab = 'mago';
    this.refresh();
    this.root.hidden = false;
    this.measure();
  }

  hide(): void {
    Dropdown.closeAll();
    this.root.hidden = true;
    this.nameInput.blur();
  }

  /** Se mide al abrir y al girar o redimensionar, nunca en cada cuadro. */
  private measure(): void {
    if (this.root.hidden) return;
    const width = window.innerWidth;
    if (width <= 0) return;
    this.freeWidth = Math.min(Math.max(this.panel.getBoundingClientRect().left / width, 0.2), 1);
  }

  private finish(): void {
    const name = cleanName(this.nameInput.value);
    if (!name) {
      // El nombre es obligatorio: se vuelve a la pestaña y se marca el campo en vez de seguir.
      this.tab = 'mago';
      this.refresh();
      this.nameInput.classList.remove('missing');
      void this.nameInput.offsetWidth;
      this.nameInput.classList.add('missing');
      this.nameInput.focus();
      return;
    }
    this.profile = { ...this.profile, name };
    this.onDone(this.profile);
  }

  private update(profile: Profile): void {
    this.profile = profile;
    this.refresh();
    this.onChange(profile);
  }

  private setLook(key: keyof LookIds, id: string): void {
    const look = { ...this.profile.look, [key]: id };
    // Si cambias de linaje y la máscara no le calza (barba en un lobo), se saca.
    const mask = MASKS.find((m) => m.id === look.mask);
    if (mask && !fitsFace(mask, look.face)) look.mask = 'ninguno';
    this.update({ ...this.profile, look });
  }

  private buildTabs(): void {
    const nav = query(this.root, '.wardrobe-tabs');
    for (const tab of TABS) {
      const button = el('button', 'wardrobe-tab', tab.name);
      button.type = 'button';
      button.addEventListener('click', () => {
        Dropdown.closeAll();
        this.tab = tab.id;
        this.refresh();
        query(this.root, '.wardrobe-body').scrollTop = 0;
      });
      nav.append(button);
      this.tabButtons.set(tab.id, button);
    }
  }

  private buildRow(page: HTMLElement, row: Row): void {
    const line = el('div', 'wardrobe-line');
    line.append(el('span', 'wardrobe-line-title', row.title));
    const swatches = row.options.every((o) => o.color !== undefined);
    const picker = new Dropdown({
      title: row.title,
      host: this.panel,
      arrows: true,
      swatches,
      options: row.options.map((o) => ({ id: o.id, label: o.name, color: o.color })),
      onPick: (id) => this.setLook(row.key, id),
    });
    line.append(picker.root);
    page.append(line);
    this.lookPickers.push({ row, picker });
  }

  private refresh(): void {
    const { look, affinity } = this.profile;
    for (const [id, page] of this.pages) page.hidden = id !== this.tab;
    for (const [id, button] of this.tabButtons)
      button.classList.toggle('selected', id === this.tab);
    for (const { row, picker } of this.lookPickers) {
      picker.value = look[row.key];
      picker.setDisabled((id) => {
        const option = row.options.find((o) => o.id === id);
        return option ? !fitsFace(option, look.face) : false;
      });
    }
    this.archetypePicker.value = ARCHETYPES.find((a) => sameLook(a.look, look))?.id ?? '';
    this.affinityPicker.value = affinity ?? '';
    if (affinity) {
      const own = Math.round((1 - AFFINITY_RULES.ownFatigueMultiplier) * 100);
      const opposing = Math.round((AFFINITY_RULES.opposingFatigueMultiplier - 1) * 100);
      const [a, b] = opposingOf(affinity).map(elementName);
      this.affinityDetail.innerHTML = '';
      this.affinityDetail.append(
        el(
          'span',
          'wardrobe-affinity-rule',
          `${elementName(affinity)} descansa ${own}% más rápido; ${a} y ${b}, ${opposing}% más lento.`,
        ),
        el('span', 'wardrobe-affinity-look', AFFINITY_LOOKS[affinity]),
      );
    } else {
      this.affinityDetail.textContent =
        'Sin Afinidad todos tus elementos descansan igual. Elige un hilo para unirte a él.';
    }
  }
}

function sameLook(a: LookIds, b: LookIds): boolean {
  return (Object.keys(a) as (keyof LookIds)[]).every((key) => a[key] === b[key]);
}
