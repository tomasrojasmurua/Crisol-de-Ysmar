import { MATCH_LOG_LIMITS, type MatchLog, parseMatchLog } from '@crisol/protocol';

/**
 * Registro de partidas en D1 (base `crisol-partidas`): qué lanzó cada mago y qué pasó después,
 * para buscar combinaciones de hechizos que funcionan (ver docs/partidas.md). Sin nombres, sin IP
 * y sin el código de respaldo: los magos van por número.
 */

/** Se guardan 6 meses: suficiente para aprender sin juntar para siempre. */
const KEEP_DAYS = 180;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    source TEXT NOT NULL,
    mode TEXT NOT NULL,
    bot_level TEXT NOT NULL,
    humans INTEGER NOT NULL,
    version TEXT NOT NULL,
    data TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS matches_at ON matches (at)',
];

const INSERT = `INSERT INTO matches (at, source, mode, bot_level, humans, version, data)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

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

/** Guarda un registro y borra los de hace más de 6 meses. */
export async function saveMatchLog(db: D1Database, log: MatchLog, now: Date): Promise<void> {
  await ensureSchema(db);
  const oldest = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  await db.batch([
    db
      .prepare(INSERT)
      .bind(
        now.toISOString(),
        log.source,
        log.mode,
        log.botLevel,
        log.wizards.filter((w) => w.human).length,
        log.version,
        JSON.stringify({ wizards: log.wizards, rounds: log.rounds, winnerTeam: log.winnerTeam }),
      ),
    db.prepare('DELETE FROM matches WHERE at < ?').bind(oldest),
  ]);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * `POST /api/partida`: un registro en JSON (texto plano, sin preguntar antes). Responde rápido
 * y sin detalles, como el registro de errores: al celular no le sirve saber si se guardó.
 */
export async function receiveMatchLog(
  request: Request,
  db: D1Database | undefined,
  waitUntil: (task: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: CORS });
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MATCH_LOG_LIMITS.bytes) return new Response(null, { status: 413, headers: CORS });
  const log = parseMatchLog(await request.text());
  if (!log) return new Response(null, { status: 400, headers: CORS });
  if (db) {
    waitUntil(
      saveMatchLog(db, log, new Date()).catch((error: unknown) => {
        console.error('No se pudo guardar el registro de la partida', error);
      }),
    );
  }
  return new Response(null, { status: 204, headers: CORS });
}
