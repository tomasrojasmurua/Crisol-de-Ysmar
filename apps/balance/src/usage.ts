import { appendFileSync } from 'node:fs';
import { ELEMENTS, SPELL_NAMES } from '@crisol/content';
import { SPELL_IDS, SPELL_WEAVES, type SpellId } from '@crisol/core';

/**
 * Cuánto se usa cada hechizo de verdad: suma el historial de todos los respaldos de la base D1
 * `crisol-perfiles` (ver docs/respaldo.md). Cada respaldo trae `crisol.estadisticas`, con cuántas
 * veces lanzó ese jugador cada hechizo en partidas terminadas (contra la IA o en red, nunca el
 * entrenamiento). El informe no muestra nada de nadie en particular: solo totales.
 *
 * Necesita CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID. Se corre desde Actions → "Uso de
 * hechizos", o a mano: pnpm --filter @crisol/balance uso [--dias 30]
 */

const DATABASE = 'crisol-perfiles';
const API = 'https://api.cloudflare.com/client/v4';
const STATS_KEY = 'crisol.estadisticas';
/** Los hechizos de uno y dos elementos, los que todos tienen a mano. */
const BASE_LENGTH = 2;

const args = process.argv.slice(2);
const daysAt = args.indexOf('--dias');
const days = daysAt >= 0 ? Number(args[daysAt + 1]) : 0;

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.');
  process.exit(1);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}/accounts/${account}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: { code: number; message: string }[];
  };
  if (!response.ok || body.success === false) {
    const reason = body.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || response.status;
    throw new Error(`Cloudflare respondió ${reason}`);
  }
  return body.result as T;
}

async function query<Row>(uuid: string, sql: string, params: unknown[] = []): Promise<Row[]> {
  const result = await api<{ results?: Row[] }[]>(`/d1/database/${uuid}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
  return result[0]?.results ?? [];
}

const output: string[] = [];
const print = (line = ''): void => {
  output.push(line);
};
function finish(): void {
  const text = output.join('\n');
  console.log(text);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${text}\n`);
}

/** Lo que nos importa del historial de un jugador: sus partidas y sus hechizos. */
interface PlayerUsage {
  readonly played: number;
  readonly spells: Partial<Record<SpellId, number>>;
}

const positive = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

/** Lee un respaldo sin confiar en nada: uno roto no suma. */
function readRecord(data: string): PlayerUsage | null {
  try {
    const entries = JSON.parse(data) as Record<string, unknown>;
    const text = entries?.[STATS_KEY];
    if (typeof text !== 'string') return null;
    const raw = JSON.parse(text) as { played?: unknown; spells?: Record<string, unknown> };
    const spells: Partial<Record<SpellId, number>> = {};
    for (const id of SPELL_IDS) {
      const n = positive(raw.spells?.[id]);
      if (n > 0) spells[id] = n;
    }
    return { played: positive(raw.played), spells };
  } catch {
    return null;
  }
}

const elementName = new Map(ELEMENTS.map((e) => [e.id, e.name]));
const weaveText = (id: SpellId): string =>
  SPELL_WEAVES[id].map((e) => elementName.get(e) ?? e).join(' → ');
const percent = (n: number, total: number): string =>
  total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

const databases = await api<{ name: string; uuid: string }[]>(`/d1/database?name=${DATABASE}`);
const uuid = databases.find((db) => db.name === DATABASE)?.uuid;
if (!uuid) {
  print(`Todavía no existe la base \`${DATABASE}\`.`);
  finish();
  process.exit(0);
}

const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : '';
const rows = await query<{ data: string }>(
  uuid,
  since ? 'SELECT data FROM profiles WHERE updated_at >= ?' : 'SELECT data FROM profiles',
  since ? [since] : [],
);

const totals = new Map<SpellId, number>();
const users = new Map<SpellId, number>();
let players = 0;
let matches = 0;
for (const row of rows) {
  const record = readRecord(row.data);
  if (!record || record.played === 0) continue;
  players++;
  matches += record.played;
  for (const [id, n] of Object.entries(record.spells) as [SpellId, number][]) {
    totals.set(id, (totals.get(id) ?? 0) + n);
    users.set(id, (users.get(id) ?? 0) + 1);
  }
}

const scope = days > 0 ? ` (respaldos de los últimos ${days} días)` : '';
print(`## Uso de hechizos${scope}`);
print();
print(
  `${players} jugadores con partidas terminadas, ${matches} partidas en total. Los números ` +
    'suman a todos: no se ve a nadie en particular.',
);
print();
if (players === 0) {
  print('Todavía no hay respaldos con partidas.');
  finish();
  process.exit(0);
}

const base = SPELL_IDS.filter((id) => SPELL_WEAVES[id].length <= BASE_LENGTH);
const great = SPELL_IDS.filter((id) => SPELL_WEAVES[id].length > BASE_LENGTH);
const sum = (ids: readonly SpellId[]): number =>
  ids.reduce((acc, id) => acc + (totals.get(id) ?? 0), 0);
const baseTotal = sum(base);
const greatTotal = sum(great);
const allTotal = baseTotal + greatTotal;
print(
  `Lanzamientos: ${allTotal}. De uno y dos elementos: ${percent(baseTotal, allTotal)}; ` +
    `Grandes hechizos: ${percent(greatTotal, allTotal)}.`,
);
print();

const byUse = (ids: readonly SpellId[]): SpellId[] =>
  [...ids].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));

print('### Hechizos de uno y dos elementos');
print();
print('| Hechizo | Tejido | Veces | Del total de estos | Por partida | Jugadores que lo usaron |');
print('| ------- | ------ | ----: | -----------------: | ----------: | ----------------------: |');
for (const id of byUse(base)) {
  const n = totals.get(id) ?? 0;
  print(
    `| ${SPELL_NAMES[id]} | ${weaveText(id)} | ${n} | ${percent(n, baseTotal)} | ` +
      `${(n / matches).toFixed(2)} | ${users.get(id) ?? 0} de ${players} |`,
  );
}
print();

const usedGreat = byUse(great).filter((id) => (totals.get(id) ?? 0) > 0);
print(`### Grandes hechizos (${usedGreat.length} de ${great.length} usados alguna vez)`);
print();
print('| Hechizo | Tejido | Veces | Del total de Grandes | Jugadores que lo usaron |');
print('| ------- | ------ | ----: | -------------------: | ----------------------: |');
for (const id of usedGreat) {
  const n = totals.get(id) ?? 0;
  print(
    `| ${SPELL_NAMES[id]} | ${weaveText(id)} | ${n} | ${percent(n, greatTotal)} | ` +
      `${users.get(id) ?? 0} de ${players} |`,
  );
}
print();
finish();
