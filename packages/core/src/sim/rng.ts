/**
 * Generador de azar con semilla (mulberry32).
 * El núcleo nunca usa Math.random: con la misma semilla, la partida se repite igual.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Estado interno, para guardar y restaurar una simulación. */
  snapshot(): number {
    return this.state;
  }

  static restore(state: number): SeededRng {
    const rng = new SeededRng(0);
    rng.state = state >>> 0;
    return rng;
  }
}
