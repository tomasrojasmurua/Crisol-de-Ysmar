import { type ErrorReport, PROTOCOL_VERSION, parseReports, REPORT_LIMITS } from '@crisol/protocol';

/**
 * Registro de errores en D1 (base `crisol-errores`). Los celulares mandan lo que les falla y la
 * Sala anota sus propias excepciones. Se lee con el flujo "Leer errores" de GitHub o con
 * `pnpm errores` (ver docs/errores.md). Se guarda solo lo del informe: nada de IP ni nombres.
 */

/** Los informes viejos se borran solos: para la prueba con amigos basta un mes. */
const KEEP_DAYS = 30;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT NOT NULL,
    version TEXT NOT NULL,
    device TEXT NOT NULL,
    screen TEXT NOT NULL,
    room TEXT NOT NULL,
    match TEXT NOT NULL,
    session TEXT NOT NULL,
    uptime INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS reports_at ON reports (at)',
];

const INSERT = `INSERT INTO reports
  (at, source, kind, message, detail, version, device, screen, room, match, session, uptime)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** De dónde viene el informe: el celular o la Sala. */
export type ReportSource = 'cliente' | 'sala';

/** La tabla se crea la primera vez que se usa (una vez por instancia del Worker). */
const ready = new WeakMap<D1Database, Promise<unknown>>();

function ensureSchema(db: D1Database): Promise<unknown> {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    // Si falla, se reintenta en el próximo informe.
    pending.catch(() => ready.delete(db));
    ready.set(db, pending);
  }
  return pending;
}

/** Guarda los informes y borra los de hace más de un mes. */
export async function saveReports(
  db: D1Database,
  reports: readonly ErrorReport[],
  source: ReportSource,
  now: Date,
): Promise<void> {
  if (reports.length === 0) return;
  await ensureSchema(db);
  const at = now.toISOString();
  const oldest = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  await db.batch([
    ...reports.map((r) =>
      db
        .prepare(INSERT)
        .bind(
          at,
          source,
          r.kind,
          r.message,
          r.detail,
          r.version,
          r.device,
          r.screen,
          r.room,
          r.match,
          r.session,
          r.uptime,
        ),
    ),
    db.prepare('DELETE FROM reports WHERE at < ?').bind(oldest),
  ]);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * `POST /api/errors`: un arreglo de informes en JSON. Siempre responde rápido y sin detalles: al
 * celular no le sirve saber si se guardó, y un error aquí no debe causar otro allá.
 */
export async function receiveReports(
  request: Request,
  db: D1Database | undefined,
  waitUntil: (task: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > REPORT_LIMITS.bytes) return new Response(null, { status: 413, headers: CORS });
  const reports = parseReports(await request.text());
  if (db && reports.length > 0) {
    waitUntil(
      saveReports(db, reports, 'cliente', new Date()).catch((error: unknown) => {
        console.error('No se pudieron guardar los informes', error);
      }),
    );
  }
  return new Response(null, { status: 204, headers: CORS });
}

/** La Sala anota una excepción propia (sin cortar lo que estaba haciendo). */
export function reportRoomError(
  db: D1Database | undefined,
  room: string,
  where: string,
  error: unknown,
): Promise<void> {
  console.error(`Error en la Sala ${room} (${where})`, error);
  if (!db) return Promise.resolve();
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const detail = error instanceof Error ? (error.stack ?? '') : '';
  const report: ErrorReport = {
    kind: 'sala',
    message: `${where}: ${message}`.slice(0, REPORT_LIMITS.message),
    detail: detail.slice(0, REPORT_LIMITS.detail),
    version: `protocolo ${PROTOCOL_VERSION}`,
    device: 'servidor',
    screen: '',
    room,
    match: '',
    session: '',
    uptime: 0,
  };
  return saveReports(db, [report], 'sala', new Date()).catch((cause: unknown) => {
    console.error('No se pudo anotar el error de la Sala', cause);
  });
}
