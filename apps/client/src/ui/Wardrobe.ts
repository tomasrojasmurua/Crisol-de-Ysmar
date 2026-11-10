import {
  AFFINITY_LOOKS,
  AFFINITY_RULES,
  ELEMENTS,
  FOCI,
  HEADWEAR,
  type LookOption,
  ROBE_COLORS,
  SKIN_TONES,
  TRIM_COLORS,
} from '@crisol/content';
import { type ElementId, opposingOf } from '@crisol/core';
import { type Appearance, cleanName, NAME_MAX_LENGTH, type Profile } from '../game/Profile';
import { el, query } from './dom';

const elementName = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.name ?? id;

/**
 * El Vestidor: nombre, Afinidad y piezas del hechicero. Cada cambio se ve en el modelo 3D
 * que queda a un lado; todo es cosmético salvo la Afinidad.
 */
export class Wardrobe {
  private readonly root: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly affinityDetail: HTMLElement;
  private readonly sections = new Map<string, HTMLElement>();
  private profile: Profile;

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
        <div class="wardrobe-body">
        <h2>Tu hechicero</h2>
        <label class="wardrobe-name">
          <span>Nombre</span>
          <input type="text" maxlength="${NAME_MAX_LENGTH}" autocomplete="off"
            autocapitalize="words" spellcheck="false" placeholder="¿Cómo te llaman?" />
        </label>
        <h3>Afinidad</h3>
        <div class="wardrobe-row affinity" data-section="affinity"></div>
        <p class="wardrobe-affinity-detail"></p>
        <h3>Túnica</h3>
        <div class="wardrobe-row swatches" data-section="robe"></div>
        <h3>Adornos</h3>
        <div class="wardrobe-row swatches" data-section="trim"></div>
        <h3>Piel</h3>
        <div class="wardrobe-row swatches" data-section="skin"></div>
        <div class="wardrobe-pair">
          <div>
            <h3>Cabeza</h3>
            <div class="wardrobe-row pieces" data-section="headwear"></div>
          </div>
          <div>
            <h3>Foco</h3>
            <div class="wardrobe-row pieces" data-section="focus"></div>
          </div>
        </div>
        </div>
        <button type="button" class="primary wardrobe-done">Listo</button>
      </section>`;
    parent.append(this.root);
    this.nameInput = query<HTMLInputElement>(this.root, 'input');
    this.affinityDetail = query(this.root, '.wardrobe-affinity-detail');
    for (const section of this.root.querySelectorAll<HTMLElement>('[data-section]')) {
      this.sections.set(section.dataset.section ?? '', section);
    }

    this.nameInput.addEventListener('input', () => {
      this.update({ ...this.profile, name: this.nameInput.value });
      this.nameInput.classList.remove('missing');
    });
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.nameInput.blur();
    });
    query(this.root, '.wardrobe-done').addEventListener('click', () => this.finish());

    this.buildAffinity();
    this.buildSwatches('robe', ROBE_COLORS);
    this.buildSwatches('trim', TRIM_COLORS);
    this.buildSwatches('skin', SKIN_TONES);
    this.buildPieces('headwear', HEADWEAR);
    this.buildPieces('focus', FOCI);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(profile: Profile): void {
    this.profile = profile;
    this.nameInput.value = profile.name;
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
      // La primera vez el nombre es obligatorio: se marca el campo en vez de seguir.
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

  private setLook(key: keyof Appearance, id: string): void {
    this.update({ ...this.profile, look: { ...this.profile.look, [key]: id } });
  }

  private buildAffinity(): void {
    const row = this.sections.get('affinity');
    if (!row) return;
    const none = el('button', 'wardrobe-affinity none', 'Ninguna');
    none.type = 'button';
    none.dataset.id = '';
    none.addEventListener('click', () => this.update({ ...this.profile, affinity: null }));
    row.append(none);
    for (const element of ELEMENTS) {
      const button = el('button', 'wardrobe-affinity', element.name);
      button.type = 'button';
      button.dataset.id = element.id;
      button.style.setProperty('--element', element.color);
      button.addEventListener('click', () =>
        this.update({ ...this.profile, affinity: element.id as ElementId }),
      );
      row.append(button);
    }
  }

  private buildSwatches(key: 'robe' | 'trim' | 'skin', options: readonly LookOption[]): void {
    const row = this.sections.get(key);
    if (!row) return;
    for (const option of options) {
      const button = el('button', 'wardrobe-swatch');
      button.type = 'button';
      button.dataset.id = option.id;
      button.title = option.name;
      button.setAttribute('aria-label', option.name);
      button.style.setProperty('--swatch', option.color ?? '#888');
      button.addEventListener('click', () => this.setLook(key, option.id));
      row.append(button);
    }
  }

  private buildPieces(key: 'headwear' | 'focus', options: readonly LookOption[]): void {
    const row = this.sections.get(key);
    if (!row) return;
    for (const option of options) {
      const button = el('button', 'wardrobe-piece', option.name);
      button.type = 'button';
      button.dataset.id = option.id;
      button.addEventListener('click', () => this.setLook(key, option.id));
      row.append(button);
    }
  }

  private refresh(): void {
    const { look, affinity } = this.profile;
    const selected: Record<string, string> = { ...look, affinity: affinity ?? '' };
    for (const [key, row] of this.sections) {
      for (const button of row.querySelectorAll<HTMLElement>('button')) {
        button.classList.toggle('selected', button.dataset.id === selected[key]);
      }
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
