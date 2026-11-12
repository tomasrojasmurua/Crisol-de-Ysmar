// Lee el registro de errores (base D1 `crisol-errores`) y lo muestra como tablas en Markdown.
// Necesita CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID (los mismos secretos de la publicación).
//
//   node scripts/errores.mjs              últimas 48 horas
//   node scripts/errores.mjs --horas 6    últimas 6 horas
//   node scripts/errores.mjs --sala ABCD  solo esa sala
//   node scripts/errores.mjs --revisar    solo revisa que el token pueda usar D1
//
// En GitHub Actions también escribe el resumen de la ejecución (ver docs/errores.md).
import { appendFileSync } from 'node:fs';

const DATABASE = 'crisol-errores';
const API = 'https://api.cloudflare.com/client/v4';
const ZONE = 'America/Santiago';

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const hours = Number(option('--horas') ?? '48');
const room = (option('--sala') ?? '').toUpperCase();
const checkOnly = args.includes('--revisar');

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.');
  process.exit(checkOnly ? 0 : 1);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}/accounts/${account}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const reason = body.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || response.status;
    throw new Error(`Cloudflare respondió ${reason}`);
  }
  return body.result;
}

async function findDatabase() {
  const list = await api(`/d1/database?name=${DATABASE}`);
  return list.find((db) => db.name === DATABASE)?.uuid ?? null;
}

async function query(uuid, sql, params = []) {
  const result = await api(`/d1/database/${uuid}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
  return result[0]?.results ?? [];
}

const output = [];
const print = (line = '') => output.push(line);
const cell = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ⏎ ');
const chileTime = (iso) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  });

function finish() {
  const text = output.join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

if (checkOnly) {
  try {
    const uuid = await findDatabase();
    print(
      uuid
        ? `El token puede usar D1 y la base \`${DATABASE}\` existe.`
        : `El token puede usar D1. La base \`${DATABASE}\` se creará al publicar el servidor.`,
    );
  } catch (error) {
    print(`::warning::El token de Cloudflare no puede usar D1 (${error.message}).`);
    print('Agrega el permiso Account → D1 → Edit al token (ver docs/publicacion.md).');
  }
  finish();
  process.exit(0);
}

const uuid = await findDatabase();
if (!uuid) {
  print(`Todavía no existe la base \`${DATABASE}\`: se crea al publicar el servidor.`);
  finish();
  process.exit(0);
}

const since = new Date(Date.now() - hours * 3_600_000).toISOString();
const where = room ? 'at >= ? AND room = ?' : 'at >= ?';
const params = room ? [since, room] : [since];
let groups;
let latest;
try {
  groups = await query(
    uuid,
    `SELECT kind, message, COUNT(*) AS veces, COUNT(DISTINCT session) AS visitas,
       GROUP_CONCAT(DISTINCT device) AS celulares, MAX(at) AS ultima
     FROM reports WHERE ${where} GROUP BY kind, message ORDER BY veces DESC LIMIT 40`,
    params,
  );
  latest = await query(
    uuid,
    `SELECT at, source, kind, message, detail, version, device, screen, room, match, session, uptime
     FROM reports WHERE ${where} ORDER BY at DESC LIMIT 60`,
    params,
  );
} catch (error) {
  if (!/no such table/.test(error.message)) throw error;
  groups = [];
  latest = [];
}

const scope = room ? ` en la sala ${room}` : '';
print(`## Registro de errores: últimas ${hours} horas${scope}`);
print();
if (latest.length === 0) {
  print('No hay informes. 🎉');
  finish();
  process.exit(0);
}

print('### Resumen');
print();
print('| Veces | Visitas | Tipo | Qué pasó | Celulares | Última vez |');
print('| ----: | ------: | ---- | -------- | --------- | ---------- |');
for (const g of groups) {
  print(
    `| ${g.veces} | ${g.visitas} | ${g.kind} | ${cell(g.message)} | ${cell(g.celulares)} | ${chileTime(g.ultima)} |`,
  );
}
print();
print('### Últimos informes (hora de Chile)');
print();
print('| Hora | Tipo | Qué pasó | Versión | Celular | Pantalla | Sala | Partida | Visita | Seg. |');
print('| ---- | ---- | -------- | ------- | ------- | -------- | ---- | ------- | ------ | ---: |');
for (const r of latest) {
  print(
    `| ${chileTime(r.at)} | ${r.source === 'sala' ? 'sala' : r.kind} | ${cell(r.message)} | ${cell(r.version)} | ${cell(r.device)} | ${cell(r.screen)} | ${cell(r.room)} | ${cell(r.match)} | ${cell(r.session)} | ${r.uptime} |`,
  );
}
print();
print('### Detalle (pilas y datos extra)');
print();
for (const r of latest.filter((x) => x.detail)) {
  print(`**${chileTime(r.at)} · ${r.message}**`);
  print('```');
  print(r.detail);
  print('```');
}
finish();
