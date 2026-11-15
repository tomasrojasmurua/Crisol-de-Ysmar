import { ROOM_CODE_ALPHABET } from './messages';

/**
 * Respaldo del progreso en el servidor (ver docs/respaldo.md). No hay cuentas: cada hechicero
 * tiene un código de respaldo al azar ("K7QF-M9XA-2RHT") que es a la vez su nombre y su llave.
 * Con él se recupera el progreso en otro celular o después de que Safari lo borre.
 */

/** Las mismas letras que los códigos de sala: sin 0/O ni 1/I, fáciles de dictar. */
export const BACKUP_CODE_ALPHABET = ROOM_CODE_ALPHABET;
/** 12 letras de 32 posibles: 60 bits, imposible de adivinar probando. */
export const BACKUP_CODE_LENGTH = 12;

export const BACKUP_LIMITS = {
  /** Un respaldo pesa unos pocos KB; esto deja mucho margen y cabe en un envío `keepalive`. */
  bytes: 60_000,
  /** Cuántas claves guardadas en el celular puede traer. */
  keys: 64,
} as const;

/** Lo que el celular guarda del juego: todo empieza con este prefijo. */
export const BACKUP_KEY_PREFIX = 'crisol.';

/** Un código nuevo con la fuente de azar que se le pase (en el celular, `crypto`). */
export function generateBackupCode(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  let code = '';
  // 256 es múltiplo de 32: cada letra sale con la misma probabilidad.
  for (const byte of bytes) code += BACKUP_CODE_ALPHABET.charAt(byte % BACKUP_CODE_ALPHABET.length);
  return code;
}

/**
 * Lo que escribió el jugador, limpio: sin guiones ni espacios y en mayúsculas. Null si no es un
 * código válido (largo distinto o letras que no existen en los códigos).
 */
export function normalizeBackupCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s\-_.·]/g, '');
  if (code.length !== BACKUP_CODE_LENGTH) return null;
  return [...code].every((char) => BACKUP_CODE_ALPHABET.includes(char)) ? code : null;
}

/** Para mostrarlo: de a cuatro letras ("K7QF-M9XA-2RHT"). */
export function formatBackupCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

/** Las claves y valores guardados en el celular que viajan en un respaldo. */
export type BackupEntries = Readonly<Record<string, string>>;

/** Lee un respaldo que llega como JSON; null si no tiene la forma esperada o se pasa del tope. */
export function parseBackupEntries(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(BACKUP_KEY_PREFIX) || typeof value !== 'string') return null;
    if (++count > BACKUP_LIMITS.keys) return null;
    entries[key] = value;
  }
  return entries;
}
