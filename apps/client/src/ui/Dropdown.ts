import { el } from './dom';

/** Una alternativa del desplegable. */
export interface DropdownOption {
  readonly id: string;
  readonly label: string;
  /** Color de la muestra (piel, ropa) o del texto (Afinidad). */
  readonly color?: string | undefined;
}

export interface DropdownSetup {
  readonly title: string;
  readonly options: readonly DropdownOption[];
  readonly onPick: (id: string) => void;
  /**
   * Dónde se abre la lista: cubre ese contenedor entero (el panel del Vestidor, la sala) para no
   * tapar lo que está al lado, como el mago en 3D.
   */
  readonly host: HTMLElement;
  /** Flechas ‹ › a los lados para pasar de una alternativa a la siguiente sin abrir la lista. */
  readonly arrows?: boolean;
  /** Las alternativas son colores: la lista va en muestras redondas. */
  readonly swatches?: boolean;
  /** Cómo pinta `color`: como muestra (por defecto) o como color del texto. */
  readonly colorAs?: 'swatch' | 'text';
  /** Lo que se lee cuando el valor no es ninguna alternativa (un aspecto armado a mano). */
  readonly placeholder?: string;
}

/** El desplegable abierto en este momento: abrir otro cierra el anterior. */
let openDropdown: Dropdown | null = null;

/**
 * Un desplegable compacto: una línea con la alternativa elegida que, al tocarla, abre la lista
 * completa encima del contenedor `host`. Así cada ajuste ocupa una sola fila y los menús caben
 * en un celular en horizontal sin deslizar. Las flechas permiten probar alternativas una por una
 * (en el Vestidor el mago cambia al instante).
 */
export class Dropdown {
  readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly valueLabel: HTMLElement;
  private readonly valueSwatch: HTMLElement;
  private readonly prev: HTMLButtonElement | null = null;
  private readonly next: HTMLButtonElement | null = null;
  private readonly sheet: HTMLElement;
  private readonly items = new Map<string, HTMLButtonElement>();
  private selected = '';
  private readonly disabledIds = new Set<string>();
  private locked = false;

  constructor(private readonly setup: DropdownSetup) {
    this.root = el('div', 'dropdown');
    this.button = el('button', 'dropdown-value') as HTMLButtonElement;
    this.button.type = 'button';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-label', setup.title);
    this.valueSwatch = el('span', 'dropdown-swatch');
    this.valueLabel = el('span', 'dropdown-label');
    this.button.append(this.valueSwatch, this.valueLabel, el('span', 'dropdown-caret', '▾'));
    this.button.addEventListener('click', () => this.open());

    if (setup.arrows) {
      this.prev = this.arrow('‹', 'Anterior', -1);
      this.next = this.arrow('›', 'Siguiente', 1);
      this.root.append(this.prev, this.button, this.next);
    } else {
      this.root.append(this.button);
    }

    this.sheet = el('div', 'dropdown-sheet');
    this.sheet.hidden = true;
    this.sheet.setAttribute('role', 'listbox');
    const head = el('div', 'dropdown-sheet-head');
    const close = el('button', 'dropdown-close', '✕') as HTMLButtonElement;
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar');
    close.addEventListener('click', () => this.close());
    head.append(el('span', 'dropdown-sheet-title', setup.title), close);
    const list = el('div', setup.swatches ? 'dropdown-list swatches' : 'dropdown-list');
    for (const option of setup.options) {
      const item = el('button', 'dropdown-item') as HTMLButtonElement;
      item.type = 'button';
      item.setAttribute('role', 'option');
      if (setup.swatches) {
        item.title = option.label;
        item.setAttribute('aria-label', option.label);
        item.style.setProperty('--swatch', option.color ?? '#888');
        item.append(el('span', 'dropdown-item-name', option.label));
      } else {
        item.textContent = option.label;
        if (option.color) item.style.setProperty('--option-color', option.color);
      }
      item.addEventListener('click', () => {
        this.close();
        if (option.id !== this.selected) setup.onPick(option.id);
      });
      list.append(item);
      this.items.set(option.id, item);
    }
    // Tocar fuera de la lista (en el fondo de la hoja) también la cierra.
    this.sheet.addEventListener('click', (event) => {
      if (event.target === this.sheet) this.close();
    });
    this.sheet.append(head, list);
    setup.host.append(this.sheet);
  }

  /** Marca la alternativa elegida (no avisa con `onPick`). */
  set value(id: string) {
    this.selected = id;
    const option = this.setup.options.find((o) => o.id === id);
    this.valueLabel.textContent = option?.label ?? this.setup.placeholder ?? '';
    this.button.classList.toggle('placeholder', !option);
    const color = option?.color;
    const asText = this.setup.colorAs === 'text';
    this.valueSwatch.hidden = !color || asText;
    if (color && !asText) this.valueSwatch.style.setProperty('--swatch', color);
    if (asText) {
      if (color) this.button.style.setProperty('--option-color', color);
      else this.button.style.removeProperty('--option-color');
    }
    for (const [itemId, item] of this.items) {
      const chosen = itemId === id;
      item.classList.toggle('selected', chosen);
      item.setAttribute('aria-selected', String(chosen));
    }
  }

  get value(): string {
    return this.selected;
  }

  /** Alternativas que no se pueden elegir ahora (una barba en un lobo, un modo sin puestos). */
  setDisabled(isDisabled: (id: string) => boolean): void {
    this.disabledIds.clear();
    for (const [id, item] of this.items) {
      const off = isDisabled(id);
      if (off) this.disabledIds.add(id);
      item.disabled = off;
      item.classList.toggle('unavailable', off);
    }
  }

  /** Solo mirar: quien no creó la sala ve el ajuste pero no lo cambia. */
  setLocked(locked: boolean): void {
    this.locked = locked;
    this.root.classList.toggle('locked', locked);
    this.button.disabled = locked;
    if (this.prev) this.prev.disabled = locked;
    if (this.next) this.next.disabled = locked;
    if (locked) this.close();
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  open(): void {
    if (this.locked) return;
    if (openDropdown && openDropdown !== this) openDropdown.close();
    openDropdown = this;
    this.sheet.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
  }

  close(): void {
    this.sheet.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (openDropdown === this) openDropdown = null;
  }

  /** Cierra el desplegable que esté abierto, si hay (al salir de un menú). */
  static closeAll(): void {
    openDropdown?.close();
  }

  private arrow(text: string, label: string, step: 1 | -1): HTMLButtonElement {
    const button = el('button', 'dropdown-arrow', text) as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', `${label}: ${this.setup.title}`);
    button.addEventListener('click', () => this.step(step));
    return button;
  }

  /** Pasa a la alternativa vecina que se pueda elegir, dando la vuelta al final. */
  private step(direction: 1 | -1): void {
    const { options } = this.setup;
    const start = Math.max(
      0,
      options.findIndex((o) => o.id === this.selected),
    );
    for (let i = 1; i <= options.length; i++) {
      const option = options[(start + direction * i + options.length * 2) % options.length];
      if (option && !this.disabledIds.has(option.id)) {
        if (option.id !== this.selected) this.setup.onPick(option.id);
        return;
      }
    }
  }
}
