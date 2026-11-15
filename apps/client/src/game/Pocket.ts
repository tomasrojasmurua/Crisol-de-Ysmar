import { ALL_WEAVES, weaveKey } from '@crisol/content';
import type { Weave } from '@crisol/core';

const STORAGE_KEY = 'crisol.bolsillo';

/** Cuántos hechizos caben en el bolsillo. */
export const POCKET_SIZE = 3;

/**
 * El grimorio de bolsillo: hasta 3 hechizos que el jugador marcó en el Grimorio para ver su
 * receta durante la partida. Es solo un recordatorio: el hechizo se teje igual, con los botones.
 * Se guarda en este celular.
 */
export class Pocket {
  private keys: string[];
  /** Los hechizos del bolsillo, en el orden en que se marcaron (se lee en cada cuadro). */
  private list: readonly Weave[];

  constructor() {
    this.keys = load();
    this.list = weavesOf(this.keys);
  }

  get weaves(): readonly Weave[] {
    return this.list;
  }

  get full(): boolean {
    return this.keys.length >= POCKET_SIZE;
  }

  has(weave: Weave): boolean {
    return this.keys.includes(weaveKey(weave));
  }

  /** Lo mete o lo saca. Devuelve false si no cupo. */
  toggle(weave: Weave): boolean {
    const key = weaveKey(weave);
    if (this.keys.includes(key)) {
      this.keys = this.keys.filter((k) => k !== key);
    } else if (this.full) {
      return false;
    } else {
      this.keys = [...this.keys, key];
    }
    this.list = weavesOf(this.keys);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.keys));
    } catch {
      // Sin almacenamiento: el bolsillo dura solo esta visita.
    }
    return true;
  }
}

function weavesOf(keys: readonly string[]): Weave[] {
  return keys.flatMap((key) => ALL_WEAVES.filter((w) => weaveKey(w) === key));
}

function load(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const valid = new Set(ALL_WEAVES.map(weaveKey));
    if (!Array.isArray(saved)) return [];
    const keys = saved.filter((k): k is string => typeof k === 'string' && valid.has(k));
    return [...new Set(keys)].slice(0, POCKET_SIZE);
  } catch {
    return [];
  }
}
