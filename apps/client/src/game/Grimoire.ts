import { ALL_WEAVES, weaveKey } from '@crisol/content';
import type { Weave } from '@crisol/core';

const STORAGE_KEY = 'crisol.grimorio';

/** Los conjuros que el jugador ya lanzó alguna vez, guardados en este celular. */
export class Grimoire {
  private readonly known: Set<string>;

  constructor() {
    this.known = new Set(load());
  }

  get count(): number {
    return this.known.size;
  }

  get total(): number {
    return ALL_WEAVES.length;
  }

  has(weave: Weave): boolean {
    return this.known.has(weaveKey(weave));
  }

  /** Anota un conjuro. Devuelve true si es la primera vez. */
  discover(weave: Weave): boolean {
    const key = weaveKey(weave);
    if (this.known.has(key)) return false;
    this.known.add(key);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.known]));
    } catch {
      // Sin almacenamiento: el descubrimiento dura solo esta visita.
    }
    return true;
  }
}

function load(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const valid = new Set(ALL_WEAVES.map(weaveKey));
    return Array.isArray(saved) ? saved.filter((k): k is string => valid.has(k)) : [];
  } catch {
    return [];
  }
}
