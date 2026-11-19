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
let opinions;
let matches;
let servers;
// Las opiniones y los resúmenes de rendimiento no son errores: van en sus propias secciones.
const errorsOnly = `${where} AND kind NOT IN ('rendimiento', 'opinion', 'servidor')`;
// La compañía de internet llegó después: en una tabla vieja todavía no está la columna.
let network = 'network';
try {
  await query(uuid, 'SELECT network FROM reports LIMIT 1');
} catch {
  network = "'' AS network";
}
try {
  groups = await query(
    uuid,
    `SELECT kind, message, COUNT(*) AS veces, COUNT(DISTINCT session) AS visitas,
       GROUP_CONCAT(DISTINCT device) AS celulares, MAX(at) AS ultima
     FROM reports WHERE ${errorsOnly} GROUP BY kind, message ORDER BY veces DESC LIMIT 40`,
    params,
  );
  latest = await query(
    uuid,
    `SELECT at, source, kind, message, detail, version, device, screen, room, match, session, uptime
     FROM reports WHERE ${errorsOnly} ORDER BY at DESC LIMIT 80`,
    params,
  );
  opinions = await query(
    uuid,
    `SELECT at, message, detail, version, device, room, match, session, ${network}
     FROM reports WHERE ${where} AND kind = 'opinion' ORDER BY at DESC LIMIT 200`,
    params,
  );
  matches = await query(
    uuid,
    `SELECT at, message, detail, version, device, screen, room, match, session, ${network}
     FROM reports WHERE ${where} AND kind = 'rendimiento' ORDER BY at DESC LIMIT 120`,
    params,
  );
  servers = await query(
    uuid,
    `SELECT at, message, detail, device, room
     FROM reports WHERE ${where} AND kind = 'servidor' ORDER BY at DESC LIMIT 120`,
    params,
  );
} catch (error) {
  if (!/no such table/.test(error.message)) throw error;
  groups = [];
  latest = [];
  opinions = [];
  matches = [];
  servers = [];
}

const scope = room ? ` en la sala ${room}` : '';
print(`## Registro de errores: últimas ${hours} horas${scope}`);
print();
if (latest.length + opinions.length + matches.length + servers.length === 0) {
  print('No hay informes. 🎉');
  finish();
  process.exit(0);
}

/** De un resumen de rendimiento, la línea que empieza así (sin el comienzo). */
const lineOf = (detail, start) =>
  String(detail ?? '')
    .split('\n')
    .find((line) => line.startsWith(start))
    ?.slice(start.length)
    .trim() ?? '';

if (opinions.length > 0) {
  print('### Qué dijeron los jugadores');
  print();
  const counts = new Map();
  for (const o of opinions) {
    if (!o.message.startsWith('Se jugó: ')) continue;
    const answer = o.message.slice('Se jugó: '.length);
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  if (counts.size > 0) {
    print([...counts].map(([answer, n]) => `**${answer}**: ${n}`).join(' · '));
    print();
  }
  print('| Hora | Qué dijo | Ping y detalle | Celular | Compañía | Sala | Partida | Visita |');
  print('| ---- | -------- | -------------- | ------- | -------- | ---- | ------- | ------ |');
  for (const o of opinions) {
    print(
      `| ${chileTime(o.at)} | ${cell(o.message)} | ${cell(o.detail)} | ${cell(o.device)} | ${cell(o.network)} | ${cell(o.room)} | ${cell(o.match)} | ${cell(o.session)} |`,
    );
  }
  print();
}

if (matches.length > 0) {
  print('### Rendimiento de cada partida en red');
  print();
  print(
    '| Hora | Sala | Celular | Compañía y conexión | Servidor | Ping | Silencios | Colchón | Cuadros | Partida | Visita |',
  );
  print(
    '| ---- | ---- | ------- | ------------------- | -------- | ---- | --------- | ------- | ------- | ------- | ------ |',
  );
  for (const m of matches) {
    const fps = lineOf(m.detail, 'Duración');
    const connection = [m.network, lineOf(m.detail, 'Conexión:')].filter(Boolean).join(' · ');
    print(
      `| ${chileTime(m.at)} | ${cell(m.room)} | ${cell(m.device)} | ${cell(connection)} | ${cell(lineOf(m.detail, 'Servidor de salas:'))} | ${cell(m.message)} | ${cell(lineOf(m.detail, 'Silencios de más de 100 ms:'))} | ${cell(lineOf(m.detail, 'Colchón'))} | ${cell(fps)} | ${cell(lineOf(m.detail, 'Partida:'))} | ${cell(m.session)} |`,
    );
  }
  print();
  print('<details><summary>Resúmenes completos</summary>');
  print();
  for (const m of matches) {
    const company = m.network ? ` · ${m.network}` : '';
    print(`**${chileTime(m.at)} · ${m.room} · ${m.device}${company}**`);
    print('```');
    print(m.detail);
    print('```');
  }
  print('</details>');
  print();
}

if (servers.length > 0) {
  print('### Cómo iba la Sala en cada partida');
  print();
  print('| Hora | Sala | Dónde | Qué pasó | Quiénes | Reloj | Máquina |');
  print('| ---- | ---- | ----- | -------- | ------- | ----- | ------- |');
  for (const r of servers) {
    print(
      `| ${chileTime(r.at)} | ${cell(r.room)} | ${cell(r.device)} | ${cell(r.message)} | ${cell(lineOf(r.detail, 'Sala:'))} | ${cell([lineOf(r.detail, 'Reloj:'), lineOf(r.detail, 'Trabajo por vuelta:')].filter(Boolean).join(' · '))} | ${cell(lineOf(r.detail, 'Máquina:'))} |`,
    );
  }
  print();
}

// Las líneas de tiempo de una misma sala juntas: si todos se trabaron en el mismo tramo de 10 s,
// fue la Sala o una red compartida; si fue uno solo, su conexión o su celular.
const rooms = [...new Set([...servers, ...matches].map((r) => r.room).filter(Boolean))];
if (
  rooms.length > 0 &&
  (servers.length > 0 || matches.some((m) => m.detail.includes('cada 10 s')))
) {
  print('<details><summary>Líneas de tiempo por sala (cada 10 s)</summary>');
  print();
  for (const code of rooms) {
    const rows = [
      ...servers
        .filter((r) => r.room === code)
        .map((r) => ({
          at: r.at,
          who: `Sala (${r.device})`,
          line: lineOf(r.detail, 'Cada 10 s, peor atraso (ms):'),
        })),
      ...matches
        .filter((m) => m.room === code)
        .flatMap((m) => [
          {
            at: m.at,
            who: `${m.device} · red`,
            line: lineOf(m.detail, 'Red cada 10 s (ping máx/vacíos/silencios):'),
          },
          {
            at: m.at,
            who: `${m.device} · cuadros`,
            line: lineOf(m.detail, 'Cada 10 s (fps/tirones/conjuros):'),
          },
        ]),
    ]
      .filter((row) => row.line)
      .sort((a, b) => a.at.localeCompare(b.at));
    if (rows.length === 0) continue;
    print(
      `**Sala ${code}** · Sala: peor atraso en ms · red: ping máx/vacíos/silencios · cuadros: fps/tirones/conjuros`,
    );
    print('```');
    for (const row of rows) print(`${chileTime(row.at)} · ${row.who}: ${row.line}`);
    print('```');
  }
  print('</details>');
  print();
}

if (latest.length === 0) {
  print('Sin errores ni cortes. 🎉');
  finish();
  process.exit(0);
}

print('### Errores y cortes');
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
