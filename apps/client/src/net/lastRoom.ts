/**
 * La última sala en red de este celular. Sirve para dos cosas:
 * - si la página se recarga o el sistema la cierra en plena partida (un tirón hacia abajo, el
 *   celular sin memoria), al abrirla de nuevo vuelves solo a tu mago;
 * - en "Jugar con un amigo", el código de la última sala queda escrito para volver con un toque.
 * Salir a propósito al menú apaga lo primero, no lo segundo.
 */
const STORAGE_KEY = 'crisol.ultimaSala';
/** Pasado esto sin noticias, la partida ya debe haber terminado: no se vuelve solo. */
const AUTO_REJOIN_MS = 15 * 60_000;
/** El código se sigue ofreciendo en "Jugar con un amigo" por unas horas. */
const PREFILL_MS = 3 * 60 * 60_000;

interface Saved {
  readonly code: string;
  readonly at: number;
  /** true mientras estás en la sala; false si saliste a propósito. */
  readonly active: boolean;
}

function read(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null;
    if (
      !saved ||
      typeof saved.code !== 'string' ||
      typeof saved.at !== 'number' ||
      typeof saved.active !== 'boolean'
    ) {
      return null;
    }
    return { code: saved.code, at: saved.at, active: saved.active };
  } catch {
    return null;
  }
}

function write(saved: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento: no se puede volver solo.
  }
}

/** Estás en esta sala (se llama al entrar y de vez en cuando mientras sigues conectado). */
export function rememberRoom(code: string): void {
  write({ code, at: Date.now(), active: true });
}

/** Saliste a propósito (o la sala no te dejó entrar): no se vuelve solo. */
export function leftRoom(): void {
  const saved = read();
  if (saved?.active) write({ ...saved, active: false });
}

/** La sala a la que volver sola al abrir la página, si la dejaste sin querer hace poco. */
export function roomToRejoin(): string | null {
  const saved = read();
  return saved?.active && Date.now() - saved.at < AUTO_REJOIN_MS ? saved.code : null;
}

/** El código para dejar escrito en "Jugar con un amigo". */
export function recentRoomCode(): string {
  const saved = read();
  return saved && Date.now() - saved.at < PREFILL_MS ? saved.code : '';
}
