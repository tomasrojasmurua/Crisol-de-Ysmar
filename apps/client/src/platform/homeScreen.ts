/**
 * El juego en la pantalla de inicio del iPhone.
 *
 * Safari borra lo que un sitio guarda en el celular (Grimorio, combos, tutorial, Vestidor) si
 * pasan unos días sin abrirlo, salvo que el sitio esté agregado a la pantalla de inicio. Por eso
 * el menú invita a agregarlo. Pero el ícono nuevo no ve lo que guardó Safari: cada uno tiene su
 * propio almacenamiento. Para que el progreso viaje, mientras está abierta la invitación la
 * dirección de la página lleva el progreso empacado (`#traer=…`); el ícono se crea con esa
 * dirección y, la primera vez que se abre, desempaca lo que traiga.
 */

/** Todo lo del juego en el celular empieza así. */
const PREFIX = 'crisol.';
/** Cosas del momento que no tiene sentido llevar al ícono. */
const NOT_CARRIED = ['crisol.ultimaSala', 'crisol.sala.', 'crisol.inicio'];
const HASH_KEY = 'traer';
/** Si ya agregaste el juego o pediste "ahora no" (y hasta cuándo). */
const INVITE_KEY = 'crisol.inicio';
/** "Ahora no" esconde la invitación por estos días. */
const SNOOZE_DAYS = 3;

type Entries = Readonly<Record<string, string>>;

/** Si esa clave es progreso que vale la pena llevar al ícono. */
export function isCarried(key: string): boolean {
  return key.startsWith(PREFIX) && !NOT_CARRIED.some((skip) => key.startsWith(skip));
}

/** Empaca el progreso para la dirección: JSON en base64 sin caracteres que la rompan. */
export function packProgress(entries: Entries): string {
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Desempaca lo que trae la dirección; null si viene roto o no es progreso del juego. */
export function unpackProgress(packed: string): Record<string, string> | null {
  try {
    const binary = atob(packed.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isCarried(key) && typeof value === 'string') entries[key] = value;
    }
    return entries;
  } catch {
    return null;
  }
}

/** Lo que trae `#traer=…`, o null si la dirección no trae nada. */
export function carriedInHash(hash: string): Record<string, string> | null {
  const packed = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  return packed ? unpackProgress(packed) : null;
}

/**
 * Al abrir la página: si la dirección trae progreso, lo guarda (sin pisar lo que este lugar ya
 * tenga) y limpia la dirección. Se llama antes de crear el Grimorio, el perfil y lo demás.
 */
export function adoptCarriedProgress(): void {
  const entries = carriedInHash(location.hash);
  if (!entries) return;
  try {
    for (const [key, value] of Object.entries(entries)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch {
    // Sin almacenamiento no hay dónde guardarlo: se parte de cero.
  }
  history.replaceState(null, '', location.pathname + location.search);
}

/** Pone el progreso de este celular en la dirección (mientras se agrega a inicio). */
export function carryProgressInUrl(): void {
  const entries: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = key === null ? null : localStorage.getItem(key);
      if (key !== null && value !== null && isCarried(key)) entries[key] = value;
    }
  } catch {
    return;
  }
  const hash = `#${HASH_KEY}=${packProgress(entries)}`;
  history.replaceState(history.state, '', location.pathname + location.search + hash);
}

/** Saca el progreso de la dirección (para que no viaje si compartes el enlace). */
export function clearProgressFromUrl(): void {
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
}

/** Un iPhone o iPad (el iPad nuevo se presenta como Mac, pero tiene pantalla táctil). */
function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Abierto desde el ícono de la pantalla de inicio, no desde el navegador. */
function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

interface InviteState {
  readonly added?: boolean;
  readonly snoozedUntil?: number;
}

function readInvite(): InviteState {
  try {
    const saved = JSON.parse(localStorage.getItem(INVITE_KEY) ?? '{}') as InviteState | null;
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function writeInvite(state: InviteState): void {
  try {
    localStorage.setItem(INVITE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento: la invitación volverá a aparecer.
  }
}

/** Si toca invitar: iPhone, en el navegador, sin haberlo agregado ni pedido "ahora no" hace poco. */
export function shouldInvite(now: number): boolean {
  if (!isAppleMobile() || isInstalled()) return false;
  const state = readInvite();
  return !state.added && (state.snoozedUntil ?? 0) <= now;
}

/** "Ya lo agregué": no se vuelve a invitar en este navegador. */
export function markAdded(): void {
  writeInvite({ added: true });
}

/** "Ahora no": se esconde unos días. */
export function snoozeInvite(now: number): void {
  writeInvite({ snoozedUntil: now + SNOOZE_DAYS * 24 * 60 * 60_000 });
}
