import { STORY_CONTINUES, type StoryBeat } from '@crisol/content';

const KEY = 'crisol.historia';

/** Lo que se guarda de la Historia (en el celular y en el respaldo, como todo `crisol.`). */
interface Saved {
  /** El id de lo que toca ver o jugar ahora. */
  readonly at: string;
  /** Continuaciones que quedan en este acto. */
  readonly continues: number;
  /** Ids de lo que ya se vio alguna vez: esas escenas se pueden saltar. */
  readonly seen: readonly string[];
}

/** Qué pasa después de perder un combate de la Historia. */
export type StoryLoss =
  /** Se gastó una continuación: se reintenta el mismo combate. */
  | { readonly kind: 'retry'; readonly left: number }
  /** No quedaban: se vuelve al inicio del acto, con las continuaciones llenas. */
  | { readonly kind: 'restart'; readonly act: number };

/**
 * Por dónde vas en la Historia. Avanza de a un paso (escena o combate) por la lista de
 * `storyFor`; el Linaje es para siempre, así que basta con el id del paso.
 */
export class StoryProgress {
  private at: string;
  private continues: number;
  private readonly seen: Set<string>;

  constructor(private readonly beats: readonly StoryBeat[]) {
    const saved = load();
    const at = saved ? resume(beats, saved.at) : null;
    this.at = at ?? beats[0]?.id ?? '';
    this.continues = at && saved ? saved.continues : STORY_CONTINUES;
    this.seen = new Set(saved?.seen ?? []);
  }

  /** El paso que toca, o undefined si la Historia (por ahora) terminó. */
  get current(): StoryBeat | undefined {
    return this.beats[this.index];
  }

  /** Si ya llegaste al final de lo que hay. */
  get finished(): boolean {
    return this.at.startsWith(DONE);
  }

  get continuesLeft(): number {
    return this.continues;
  }

  /** Si ese paso ya se vio antes (se puede saltar). */
  wasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  /** Terminaste el paso actual (viste la escena o ganaste el combate): toca el siguiente. */
  advance(): void {
    const beat = this.current;
    if (!beat) return;
    this.seen.add(beat.id);
    const next = this.beats[this.index + 1];
    // Al cambiar de acto, las continuaciones vuelven a estar completas.
    if (!next || next.act !== beat.act) this.continues = STORY_CONTINUES;
    this.at = next ? next.id : `${DONE}${beat.id}`;
    this.save();
  }

  /** Perdiste el combate actual. */
  lose(): StoryLoss {
    const beat = this.current;
    if (this.continues > 0) {
      this.continues--;
      this.save();
      return { kind: 'retry', left: this.continues };
    }
    const act = beat?.act ?? 1;
    const start = this.beats.find((b) => b.act === act);
    if (start) this.at = start.id;
    this.continues = STORY_CONTINUES;
    this.save();
    return { kind: 'restart', act };
  }

  /** Empieza la Historia otra vez desde el preludio (lo visto se puede saltar). */
  restart(): void {
    this.at = this.beats[0]?.id ?? '';
    this.continues = STORY_CONTINUES;
    this.save();
  }

  private get index(): number {
    return this.beats.findIndex((b) => b.id === this.at);
  }

  private save(): void {
    const saved: Saved = { at: this.at, continues: this.continues, seen: [...this.seen] };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Sin almacenamiento (modo privado): el avance dura solo esta visita.
    }
  }
}

/**
 * Marca de "ya viste todo lo que hay" (`fin:` y el último paso): cuando lleguen el acto 3 y los
 * finales, se sigue desde el paso que venga después de ese.
 */
const DONE = 'fin:';

/** Dónde seguir con lo guardado, o null si ese paso ya no existe. */
function resume(beats: readonly StoryBeat[], at: string): string | null {
  if (!at.startsWith(DONE)) return beats.some((b) => b.id === at) ? at : null;
  const last = beats.findIndex((b) => b.id === at.slice(DONE.length));
  if (last < 0) return null;
  return beats[last + 1]?.id ?? at;
}

function load(): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (!raw || typeof raw.at !== 'string') return null;
    const continues =
      typeof raw.continues === 'number' && raw.continues >= 0
        ? Math.min(STORY_CONTINUES, Math.floor(raw.continues))
        : STORY_CONTINUES;
    const seen = Array.isArray(raw.seen)
      ? raw.seen.filter((x): x is string => typeof x === 'string')
      : [];
    return { at: raw.at, continues, seen };
  } catch {
    return null;
  }
}
