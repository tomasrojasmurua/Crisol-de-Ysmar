import {
  type BackupEntries,
  generateBackupCode,
  normalizeBackupCode,
  parseBackupEntries,
} from '@crisol/protocol';
import { profileBackupUrl } from '../net/serverUrl';
import { isCarried } from './homeScreen';

/**
 * El respaldo del progreso en el servidor (ver docs/respaldo.md). Sin cuentas: este celular
 * inventa un código de respaldo la primera vez y, cada vez que cambia algo, sube todo lo que el
 * juego guarda aquí (Grimorio, combos, Vestidor, Linaje, tutorial). Con el código se recupera el
 * hechicero en otro celular. Si no hay red no pasa nada: se reintenta más tarde.
 *
 * El código vive en `crisol.respaldo`, que sí viaja al ícono de inicio del iPhone (ver
 * homeScreen.ts): así Safari y el ícono respaldan al mismo hechicero.
 */

const STATE_KEY = 'crisol.respaldo';
/** Cada cuánto se revisa si hay algo nuevo que subir, con la app a la vista. */
const CHECK_EVERY_MS = 45_000;
/** La primera revisión, un rato después de abrir (sin competir con la carga del juego). */
const FIRST_CHECK_MS = 8_000;

interface BackupState {
  readonly code: string;
  /** La huella de lo último que se subió bien, para no subir lo mismo dos veces. */
  readonly sent?: string;
  /** Cuándo se subió por última vez (milisegundos). */
  readonly savedAt?: number;
}

/** Lo que encontró el servidor para un código. */
export type FoundBackup =
  | { readonly kind: 'found'; readonly code: string; readonly entries: BackupEntries }
  | { readonly kind: 'invalid' | 'missing' | 'offline' };

/** Huella corta de un texto (FNV-1a de 32 bits): basta para saber si algo cambió. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Lo que va en el respaldo: el progreso que viaja, sin el propio código. */
export function backupEntries(all: Readonly<Record<string, string>>): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const key of Object.keys(all).sort()) {
    const value = all[key];
    if (value !== undefined && isCarried(key) && key !== STATE_KEY) entries[key] = value;
  }
  return entries;
}

/** Si el respaldo tiene un hechicero con nombre (sin él no vale la pena guardarlo). */
export function heroName(entries: BackupEntries): string {
  try {
    const profile = JSON.parse(entries['crisol.perfil'] ?? '{}') as { name?: unknown };
    return typeof profile.name === 'string' ? profile.name.trim() : '';
  } catch {
    return '';
  }
}

function readAll(): Record<string, string> {
  const all: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = key === null ? null : localStorage.getItem(key);
      if (key !== null && value !== null) all[key] = value;
    }
  } catch {
    // Sin almacenamiento: no hay nada que respaldar.
  }
  return all;
}

function readState(): BackupState | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as Partial<BackupState>;
    const code = typeof saved?.code === 'string' ? normalizeBackupCode(saved.code) : null;
    if (!code) return null;
    return {
      code,
      ...(typeof saved?.sent === 'string' ? { sent: saved.sent } : {}),
      ...(typeof saved?.savedAt === 'number' ? { savedAt: saved.savedAt } : {}),
    };
  } catch {
    return null;
  }
}

function writeState(state: BackupState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento: el código dura solo esta visita.
  }
}

export class ProfileBackup {
  private state: BackupState | null = readState();
  private sending = false;
  /** Avisa cuando cambia lo que muestra la tarjeta del respaldo. */
  onChange: () => void = () => {};

  /** Empieza a respaldar solo: al rato de abrir, cada tanto y al dejar la app. */
  start(): void {
    setTimeout(() => void this.sync(), FIRST_CHECK_MS);
    setInterval(() => {
      if (!document.hidden) void this.sync();
    }, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.sync(true);
    });
    window.addEventListener('pagehide', () => void this.sync(true));
  }

  /** El código de este celular (se inventa la primera vez que se pide). */
  get code(): string {
    if (!this.state) {
      this.state = {
        code: generateBackupCode((length) => crypto.getRandomValues(new Uint8Array(length))),
      };
      writeState(this.state);
    }
    return this.state.code;
  }

  /** Cuándo se respaldó por última vez, o null si nunca. */
  get savedAt(): number | null {
    return this.state?.savedAt ?? null;
  }

  /** Sube el progreso si cambió desde la última vez. `leaving`: la app se está cerrando. */
  async sync(leaving = false): Promise<void> {
    if (this.sending) return;
    const entries = backupEntries(readAll());
    if (!heroName(entries)) return;
    const body = JSON.stringify({ code: this.code, entries });
    const sent = fingerprint(body);
    if (sent === this.state?.sent) return;
    this.sending = true;
    try {
      const response = await fetch(profileBackupUrl(), {
        method: 'POST',
        // Texto plano: el navegador no pregunta antes, y `keepalive` llega aunque se cierre la app.
        headers: { 'Content-Type': 'text/plain' },
        body,
        keepalive: leaving,
      });
      if (response.ok) {
        this.state = { code: this.code, sent, savedAt: Date.now() };
        writeState(this.state);
        this.onChange();
      }
    } catch {
      // Sin red: se reintenta en la próxima revisión.
    } finally {
      this.sending = false;
    }
  }

  /** Busca en el servidor el respaldo de un código escrito por el jugador. */
  async find(raw: string): Promise<FoundBackup> {
    const code = normalizeBackupCode(raw);
    if (!code) return { kind: 'invalid' };
    try {
      const response = await fetch(`${profileBackupUrl()}/leer`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ code }),
      });
      if (response.status === 404) return { kind: 'missing' };
      if (!response.ok) return { kind: 'offline' };
      const data = (await response.json()) as { entries?: unknown };
      const entries = parseBackupEntries(data.entries);
      return entries ? { kind: 'found', code, entries } : { kind: 'missing' };
    } catch {
      return { kind: 'offline' };
    }
  }

  /**
   * Trae un respaldo a este celular: borra el progreso de aquí, pone el del respaldo y adopta su
   * código. Después hay que recargar la página para que todo lo lea de nuevo.
   */
  adopt(found: Extract<FoundBackup, { kind: 'found' }>): void {
    try {
      const old: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null && isCarried(key)) old.push(key);
      }
      for (const key of old) localStorage.removeItem(key);
      for (const [key, value] of Object.entries(found.entries)) localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento no hay dónde ponerlo.
    }
    const sent = fingerprint(JSON.stringify({ code: found.code, entries: found.entries }));
    this.state = { code: found.code, sent, savedAt: Date.now() };
    writeState(this.state);
  }
}
