import type { PathStep } from '@crisol/content';

const KEY = 'crisol.camino';

/**
 * Los pasos del Camino de tu Linaje que ya superaste, guardados en el celular (y en el respaldo,
 * que lleva todo lo que empieza con `crisol.`). El Linaje es para siempre: basta con el id.
 */
export class PathProgress {
  private readonly done: Set<string>;

  constructor() {
    this.done = new Set(load());
  }

  has(stepId: string): boolean {
    return this.done.has(stepId);
  }

  /** Cuántos pasos de este Camino van superados. */
  count(path: readonly PathStep[]): number {
    return path.filter((step) => this.done.has(step.id)).length;
  }

  /**
   * El paso que toca: el primero sin superar. Con todo superado, el último (para repetirlo).
   * Se avanza en orden, así que los que vienen después están cerrados.
   */
  current(path: readonly PathStep[]): number {
    const index = path.findIndex((step) => !this.done.has(step.id));
    return index < 0 ? path.length - 1 : index;
  }

  /** Si ese paso se puede jugar: ya superado, o el que toca. */
  open(path: readonly PathStep[], index: number): boolean {
    const step = path[index];
    return step !== undefined && (this.done.has(step.id) || index <= this.current(path));
  }

  /**
   * Marca un paso superado. Devuelve true si es la primera vez: ahí se enchufarán los premios
   * cuando existan.
   */
  add(stepId: string): boolean {
    if (this.done.has(stepId)) return false;
    this.done.add(stepId);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.done]));
    } catch {
      // Sin almacenamiento (modo privado): el avance dura solo esta visita.
    }
    return true;
  }
}

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
