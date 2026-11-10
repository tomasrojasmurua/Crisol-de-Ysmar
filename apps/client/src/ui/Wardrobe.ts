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
import { type ElementId, opposingOf, SeededRng } from '@crisol/core';
import { cleanName, NAME_MAX_LENGTH, type Profile, randomAppearance } from '../game/Profile';
import { el, query } from './dom';

const elementName = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.name ?? id;

type TabId = 'mago' | 'rostro' | 'ropa' | 'cabeza' | 'foco';

const TABS: readonly { readonly id: TabId; readonly name: string }[] = [
  { id: 'mago', name: 'Mago' },
  { id: 'rostro', name: 'Rostro' },
  { id: 'ropa', name: 'Ropa' },
  { id: 'cabeza', name: 'Cabeza' },
  { id: 'foco', name: 'Foco' },
];

/** Una fila de opciones: piezas con nombre o muestras de color. */
interface Row {
  readonly key: keyof LookIds;
  readonly title: string;
  readonly options: readonly LookOption[];
  readonly kind: 'pieces' | 'swatches';
}

const ROWS: Readonly<Record<Exclude<TabId, 'mago'>, readonly Row[]>> = {
  rostro: [
    { key: 'face', title: 'Linaje', options: FACES, kind: 'pieces' },
    { key: 'skin', title: 'Piel, escamas o pelaje', options: SKIN_TONES, kind: 'swatches' },
    { key: 'mask', title: 'En el rostro', options: MASKS, kind: 'pieces' },
  ],
  ropa: [
    { key: 'outfit', title: 'Ropa', options: OUTFITS, kind: 'pieces' },
    { key: 'robe', title: 'Color', options: ROBE_COLORS, kind: 'swatches' },
    { key: 'trim', title: 'Adornos y metal', options: TRIM_COLORS, kind: 'swatches' },
    { key: 'cape', title: 'Capa', options: CAPES, kind: 'pieces' },
  ],
  cabeza: [{ key: 'headwear', title: 'En la cabeza', options: HEADWEAR, kind: 'pieces' }],
  foco: [{ key: 'focus', title: 'Foco', options: FOCI, kind: 'pieces' }],
};

/**
 * El Vestidor: nombre, Afinidad y todas las piezas del hechicero, en pestañas. Cada cambio se ve
 * en el modelo 3D que queda a un lado; todo es cosmético salvo la Afinidad. Los arquetipos arman
 * un hechicero de una vez y "Al azar" sortea uno que respete las combinaciones.
 */
export class Wardrobe {
  private readonly root: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly affinityDetail: HTMLElement;
  private readonly pages = new Map<TabId, HTMLElement>();
  private readonly tabButtons = new Map<TabId, HTMLElement>();
  private readonly pieceButtons: { key: keyof LookIds; option: LookOption; button: HTMLElement }[] =
    [];
  private readonly archetypeButtons: { look: LookIds; button: HTMLElement }[] = [];
  private readonly affinityButtons: { id: string; button: HTMLElement }[] = [];
  private profile: Profile;
  private tab: TabId = 'mago';

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
            <label class="wardrobe-name">
              <span>Nombre</span>
              <input type="text" maxlength="${NAME_MAX_LENGTH}" autocomplete="off"
                autocapitalize="words" spellcheck="false" placeholder="¿Cómo te llaman?" />
            </label>
            <h3>Afinidad</h3>
            <div class="wardrobe-row affinity"></div>
            <p class="wardrobe-affinity-detail"></p>
            <h3>Arquetipos</h3>
            <div class="wardrobe-row pieces archetypes"></div>
          </div>
        </div>
        <button type="button" class="primary wardrobe-done">Listo</button>
      </section>`;
    parent.append(this.root);
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

    this.buildTabs();
    this.buildAffinity();
    this.buildArchetypes();
    const body = query(this.root, '.wardrobe-body');
    for (const [tab, rows] of Object.entries(ROWS) as [Exclude<TabId, 'mago'>, readonly Row[]][]) {
      const page = el('div', 'wardrobe-page');
      for (const row of rows) this.buildRow(page, row);
      body.append(page);
      this.pages.set(tab, page);
    }
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(profile: Profile): void {
    this.profile = profile;
    this.nameInput.value = profile.name;
    // La primera vez se parte por el nombre; después, por los arquetipos y el resto.
    this.tab = 'mago';
    this.refresh();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.nameInput.blur();
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
        this.tab = tab.id;
        this.refresh();
        query(this.root, '.wardrobe-body').scrollTop = 0;
      });
      nav.append(button);
      this.tabButtons.set(tab.id, button);
    }
  }

  private buildAffinity(): void {
    const row = query(this.root, '.wardrobe-row.affinity');
    const none = el('button', 'wardrobe-affinity none', 'Ninguna');
    none.type = 'button';
    none.addEventListener('click', () => this.update({ ...this.profile, affinity: null }));
    row.append(none);
    this.affinityButtons.push({ id: '', button: none });
    for (const element of ELEMENTS) {
      const button = el('button', 'wardrobe-affinity', element.name);
      button.type = 'button';
      button.style.setProperty('--element', element.color);
      button.addEventListener('click', () =>
        this.update({ ...this.profile, affinity: element.id as ElementId }),
      );
      row.append(button);
      this.affinityButtons.push({ id: element.id, button });
    }
  }

  private buildArchetypes(): void {
    const row = query(this.root, '.archetypes');
    for (const archetype of ARCHETYPES) {
      const button = el('button', 'wardrobe-piece', archetype.name);
      button.type = 'button';
      button.addEventListener('click', () =>
        this.update({ ...this.profile, look: archetype.look }),
      );
      row.append(button);
      this.archetypeButtons.push({ look: archetype.look, button });
    }
    const random = el('button', 'wardrobe-piece wardrobe-random', '✦ Al azar');
    random.type = 'button';
    random.addEventListener('click', () => {
      const rng = new SeededRng((Math.random() * 2 ** 32) >>> 0);
      this.update({ ...this.profile, look: randomAppearance(rng) });
    });
    row.append(random);
  }

  private buildRow(page: HTMLElement, row: Row): void {
    page.append(el('h3', '', row.title));
    const list = el('div', `wardrobe-row ${row.kind}`);
    for (const option of row.options) {
      const swatch = row.kind === 'swatches';
      const button = el(
        'button',
        swatch ? 'wardrobe-swatch' : 'wardrobe-piece',
        swatch ? undefined : option.name,
      );
      button.type = 'button';
      if (swatch) {
        button.title = option.name;
        button.setAttribute('aria-label', option.name);
        button.style.setProperty('--swatch', option.color ?? '#888');
      }
      button.addEventListener('click', () => this.setLook(row.key, option.id));
      list.append(button);
      this.pieceButtons.push({ key: row.key, option, button });
    }
    page.append(list);
  }

  private refresh(): void {
    const { look, affinity } = this.profile;
    for (const [id, page] of this.pages) page.hidden = id !== this.tab;
    for (const [id, button] of this.tabButtons)
      button.classList.toggle('selected', id === this.tab);
    for (const { key, option, button } of this.pieceButtons) {
      button.classList.toggle('selected', look[key] === option.id);
      const fits = fitsFace(option, look.face);
      button.classList.toggle('unavailable', !fits);
      (button as HTMLButtonElement).disabled = !fits;
    }
    for (const { look: preset, button } of this.archetypeButtons) {
      button.classList.toggle('selected', sameLook(preset, look));
    }
    for (const { id, button } of this.affinityButtons) {
      button.classList.toggle('selected', id === (affinity ?? ''));
    }
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
