import { ALL_WEAVES, COMBOS, weaveKey } from '@crisol/content';
import type { Weave } from '@crisol/core';
import type { ComboLog } from './ComboLog';
import type { Grimoire } from './Grimoire';

const STORAGE_KEY = 'crisol.grimorioLeido';

/** La página de un hechizo: se lee al abrir su ficha. */
export const spellPage = (weave: Weave): string => `h:${weaveKey(weave)}`;
/** La página de un combo: se lee al abrir la pestaña de combos. */
export const comboPage = (id: string): string => `c:${id}`;

/** Las páginas que ya tiene el Grimorio: los hechizos descubiertos y los combos que aparecieron. */
export function writtenPages(grimoire: Grimoire, comboLog: ComboLog): string[] {
  return [
    ...ALL_WEAVES.filter((w) => grimoire.has(w)).map(spellPage),
    ...COMBOS.filter((c) => comboLog.isUnlocked(c)).map((c) => comboPage(c.id)),
  ];
}

/**
 * Las páginas del Grimorio que ya leíste, guardadas en este celular. Lo que descubres después
 * queda marcado como nuevo (en el menú, en su pestaña y en su tarjeta) hasta que lo lees: así
 * el Grimorio te llama a entrar. Quien ya jugaba antes de esto parte con todo leído, para que
 * no le aparezcan de golpe decenas de páginas nuevas.
 */
export class GrimoireSeen {
  private readonly read: Set<string>;

  /** `written`: lo que ya hay en el Grimorio, que se da por leído si nunca se guardó nada. */
  constructor(written: () => readonly string[]) {
    const saved = load();
    this.read = new Set(saved ?? written());
    if (!saved) this.save();
  }

  isNew(page: string): boolean {
    return !this.read.has(page);
  }

  /** Marca páginas como leídas. Devuelve true si alguna era nueva. */
  markRead(pages: readonly string[]): boolean {
    let changed = false;
    for (const page of pages) {
      if (this.read.has(page)) continue;
      this.read.add(page);
      changed = true;
    }
    if (changed) this.save();
    return changed;
  }

  /** Cuántas de estas páginas faltan por leer. */
  unread(pages: readonly string[]): number {
    return pages.filter((p) => !this.read.has(p)).length;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.read]));
    } catch {
      // Sin almacenamiento: lo leído dura solo esta visita.
    }
  }
}

function load(): string[] | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(saved) ? saved.filter((p): p is string => typeof p === 'string') : null;
  } catch {
    return null;
  }
}
