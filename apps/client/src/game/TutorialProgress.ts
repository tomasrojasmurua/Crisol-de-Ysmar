const KEY = 'crisol.tutorial.capitulos';

/** Los capítulos del tutorial que ya terminaste, guardados en el celular. */
export class TutorialProgress {
  private readonly done: Set<string>;

  constructor() {
    this.done = new Set(load());
  }

  has(chapterId: string): boolean {
    return this.done.has(chapterId);
  }

  get count(): number {
    return this.done.size;
  }

  add(chapterId: string): void {
    if (this.done.has(chapterId)) return;
    this.done.add(chapterId);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.done]));
    } catch {
      // Sin almacenamiento (modo privado): solo se pierde la marca de hecho.
    }
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
