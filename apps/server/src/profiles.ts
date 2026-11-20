import {
  BACKUP_LIMITS,
  type BackupEntries,
  normalizeBackupCode,
  parseBackupEntries,
} from '@crisol/protocol';

/**
 * Respaldo de perfiles en D1 (base `crisol-perfiles`, ver docs/respaldo.md). Cada hechicero se
 * guarda bajo la huella de su código de respaldo: la base nunca ve el código, así que quien la
 * lea no puede usarlo para entrar como otro.
 *
 * - `POST /api/perfil` con `{ code, entries }`: guarda (reemplaza) el respaldo.
 * - `POST /api/perfil/leer` con `{ code }`: devuelve `{ entries, savedAt }` o 404.
 *
 * Los dos son POST con texto plano y el código en el cuerpo: así el navegador no pide permiso
 * antes (sin "preflight"), el envío `keepalive` al cerrar la app funciona, y el código no queda
 * en la dirección ni en los registros.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    saves INTEGER NOT NULL
  )`,
];

const UPSERT = `INSERT INTO profiles (id, data, created_at, updated_at, saves)
  VALUES (?1, ?2, ?3, ?3, 1)
  ON CONFLICT (id) DO UPDATE SET data = ?2, updated_at = ?3, saves = saves + 1`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** La tabla se crea la primera vez que se usa (una vez por instancia del Worker). */
const ready = new WeakMap<D1Database, Promise<unknown>>();

function ensureSchema(db: D1Database): Promise<unknown> {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    pending.catch(() => ready.delete(db));
    ready.set(db, pending);
  }
  return pending;
}

/** La huella SHA-256 del código, en hexadecimal: es la llave de la fila. */
export async function profileId(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveProfile(
  db: D1Database,
  code: string,
  entries: BackupEntries,
  now: Date,
): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(UPSERT)
    .bind(await profileId(code), JSON.stringify(entries), now.toISOString())
    .run();
}

async function readProfile(
  db: D1Database,
  code: string,
): Promise<{ entries: BackupEntries; savedAt: string } | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT data, updated_at FROM profiles WHERE id = ?')
    .bind(await profileId(code))
    .first<{ data: string; updated_at: string }>();
  if (!row) return null;
  const entries = parseBackupEntries(JSON.parse(row.data));
  return entries ? { entries, savedAt: row.updated_at } : null;
}

function reply(status: number, body?: unknown): Response {
  return body === undefined
    ? new Response(null, { status, headers: CORS })
    : Response.json(body, { status, headers: CORS });
}

/** Lee el cuerpo como JSON sin pasarse del tope; null si viene grande o roto. */
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > BACKUP_LIMITS.bytes) return null;
  const text = await request.text();
  if (text.length > BACKUP_LIMITS.bytes) return null;
  try {
    const body: unknown = JSON.parse(text);
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Atiende `/api/perfil` y `/api/perfil/leer`. */
export async function handleProfile(
  request: Request,
  db: D1Database | undefined,
  read: boolean,
): Promise<Response> {
  if (request.method === 'OPTIONS') return reply(204);
  if (request.method !== 'POST') return reply(405);
  if (!db) return reply(503);
  const body = await readBody(request);
  const code = typeof body?.code === 'string' ? normalizeBackupCode(body.code) : null;
  if (!body || !code) return reply(400);
  if (read) {
    const saved = await readProfile(db, code);
    return saved ? reply(200, saved) : reply(404);
  }
  const entries = parseBackupEntries(body.entries);
  if (!entries) return reply(400);
  await saveProfile(db, code, entries, new Date());
  return reply(204);
}
