import { COMBOS, type Combo } from '@crisol/content';
import { type ComboId, SPELL_IDS, type SpellId } from '@crisol/core';

const HITS_KEY = 'crisol.combos';
const OWN_KEY = 'crisol.misCombos';

/** Hasta cuántos hechizos lleva un combo propio. */
export const OWN_COMBO_MAX_STEPS = 4;
const OWN_NAME_MAX = 32;
const OWN_NOTE_MAX = 160;

/** Un combo que anotó el jugador en su hoja en blanco. */
export interface OwnCombo {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly SpellId[];
  readonly note: string;
}

/**
 * Los combos del catálogo que el jugador acertó en partidas y los que anotó él mismo, guardados
 * en este celular. Un combo aparece en el Grimorio al juntar sus aciertos (3, o 5 los más
 * poderosos); antes no se muestra nada de él. Los del tutorial vienen desbloqueados mientras
 * el tutorial no exista.
 */
export class ComboLog {
  private readonly hits: Map<string, number>;
  private own: OwnCombo[];

  constructor() {
    this.hits = loadHits();
    this.own = loadOwn();
  }

  get total(): number {
    return COMBOS.length;
  }

  get unlockedCount(): number {
    return COMBOS.filter((c) => this.isUnlocked(c)).length;
  }

  isUnlocked(combo: Combo): boolean {
    return combo.tutorial === true || (this.hits.get(combo.id) ?? 0) >= combo.needed;
  }

  /**
   * Suma un acierto de una partida (no de entrenamiento). Devuelve el combo si con este acierto
   * aparece en el Grimorio.
   */
  record(id: string): Combo | null {
    const combo = COMBOS.find((c) => c.id === id);
    if (!combo || this.isUnlocked(combo)) return null;
    this.hits.set(id, (this.hits.get(id) ?? 0) + 1);
    save(HITS_KEY, Object.fromEntries(this.hits));
    return this.isUnlocked(combo) ? combo : null;
  }

  /** El combo del catálogo que corresponde a una reacción del juego. */
  static forReaction(reaction: ComboId): Combo | undefined {
    return COMBOS.find((c) => c.reaction === reaction);
  }

  get ownCombos(): readonly OwnCombo[] {
    return this.own;
  }

  /** Guarda un combo propio nuevo o cambia uno existente (mismo id). */
  saveOwn(combo: Omit<OwnCombo, 'id'> & { readonly id?: string }): OwnCombo {
    const clean: OwnCombo = {
      id: combo.id ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      name: combo.name.trim().slice(0, OWN_NAME_MAX) || 'Sin nombre',
      steps: combo.steps.slice(0, OWN_COMBO_MAX_STEPS),
      note: combo.note.trim().slice(0, OWN_NOTE_MAX),
    };
    const index = this.own.findIndex((c) => c.id === clean.id);
    if (index >= 0) this.own[index] = clean;
    else this.own.push(clean);
    save(OWN_KEY, this.own);
    return clean;
  }

  removeOwn(id: string): void {
    this.own = this.own.filter((c) => c.id !== id);
    save(OWN_KEY, this.own);
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: dura solo esta visita.
  }
}

function loadHits(): Map<string, number> {
  const hits = new Map<string, number>();
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HITS_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object') return hits;
    for (const combo of COMBOS) {
      const count = (saved as Record<string, unknown>)[combo.id];
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        hits.set(combo.id, Math.floor(count));
      }
    }
  } catch {
    // Guardado roto: se parte de cero.
  }
  return hits;
}

function loadOwn(): OwnCombo[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(OWN_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    const spells = new Set<string>(SPELL_IDS);
    return saved.flatMap((item): OwnCombo[] => {
      if (!item || typeof item !== 'object') return [];
      const { id, name, steps, note } = item as Record<string, unknown>;
      if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(steps)) return [];
      const valid = steps.filter((s): s is SpellId => typeof s === 'string' && spells.has(s));
      return [
        {
          id,
          name: name.slice(0, OWN_NAME_MAX),
          steps: valid.slice(0, OWN_COMBO_MAX_STEPS),
          note: typeof note === 'string' ? note.slice(0, OWN_NOTE_MAX) : '',
        },
      ];
    });
  } catch {
    return [];
  }
}
