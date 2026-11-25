import { appendFileSync, writeFileSync } from 'node:fs';
import { BOT_PROFILES, rulesForMode, SPELL_NAMES } from '@crisol/content';
import {
  BotController,
  createLogRound,
  createMatch,
  duelSetup,
  type MatchLogRound,
  type MatchState,
  recordLogRound,
  SPELL_IDS,
  type SpellId,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Busca combinaciones de dos hechizos que rinden más que el segundo solo: "después de A, B
 * pega más". Mira partidas registradas (la base D1 `crisol-partidas`, ver docs/partidas.md) y
 * duelos de Maestros contra Maestros jugados aquí mismo (autojuego). Con `--guardar` escribe
 * `packages/content/src/botCombos.ts`: la IA las prueba como una opción más, no las copia.
 *
 * Uso: pnpm --filter @crisol/balance combinaciones [--autojuego 300] [--d1] [--guardar]
 * `--d1` necesita CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID (como `uso`).
 */

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const numberAfter = (name: string, fallback: number): number => {
  const at = args.indexOf(name);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};
const selfPlay = numberAfter('--autojuego', flag('--d1') ? 0 : 300);

/** Lo que cuenta como "después": 3 s. */
const WINDOW = TICK_RATE * 3;
/** Cuánto vale cada cosa que pasa después de un hechizo, en puntos de vida. */
const VALUE = { combo: 8, fall: 40 };
/** Cuántas veces tiene que verse una combinación para tomarla en serio, y cuánto se desconfía. */
const MIN_SEEN = 15;
const DOUBT = 20;
/** Lo mínimo que tiene que sumar (en vida, ya con la desconfianza) y cuántas por hechizo. */
const MIN_LIFT = 3;
const PER_SPELL = 3;
const MAX_COMBOS = 40;

interface Source {
  readonly rounds: readonly MatchLogRound[];
  readonly teams: ReadonlyMap<number, number>;
  /** De quiénes se aprende: en D1 solo las personas; en el autojuego, todos. */
  readonly learnFrom: ReadonlySet<number>;
}

const sources: Source[] = [];
let fromD1 = 0;

// Autojuego: un Maestro contra un Maestro que improvisa seguido (prueba tejidos que las reglas
// no eligen), con el mismo registro que usa el juego. Así aparecen combinaciones nuevas.
const RULES = rulesForMode({ kind: 'duel' });
const EXPLORER = { ...BOT_PROFILES.master, improvise: 0.3 };
for (let seed = 1; seed <= selfPlay; seed++) {
  const state: MatchState = createMatch(duelSetup(seed, RULES), RULES);
  const bots = new Map(
    state.wizards.map((w, i) => [
      w.id,
      new BotController(seed * 31 + w.id, RULES, i === seed % 2 ? EXPLORER : BOT_PROFILES.master),
    ]),
  );
  const round = createLogRound();
  while (state.winnerTeam === null && state.tick < TICK_RATE * 60 * 6) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, RULES);
    recordLogRound(round, state);
  }
  sources.push({
    rounds: [round],
    teams: new Map(state.wizards.map((w) => [w.id, w.team])),
    learnFrom: new Set(state.wizards.map((w) => w.id)),
  });
}

if (flag('--d1')) fromD1 = await readD1();

// Valor de cada lanzamiento: lo que hizo su mago a los rivales en los 3 s siguientes.
const sum = new Map<string, number>();
const seen = new Map<string, number>();
const add = (key: string, value: number): void => {
  sum.set(key, (sum.get(key) ?? 0) + value);
  seen.set(key, (seen.get(key) ?? 0) + 1);
};
for (const source of sources) {
  for (const round of source.rounds) {
    const rival = (a: number, b: number): boolean =>
      source.teams.get(a) !== undefined && source.teams.get(a) !== source.teams.get(b);
    const valueAfter = (wizard: number, tick: number): number => {
      const inside = (t: number): boolean => t > tick && t <= tick + WINDOW;
      let value = 0;
      for (const [t, from, to, amount] of round.hits) {
        if (from === wizard && rival(wizard, to) && inside(t)) value += amount;
      }
      for (const [t, from, to] of round.combos) {
        if (from === wizard && rival(wizard, to) && inside(t)) value += VALUE.combo;
      }
      for (const [t, who] of round.falls) if (rival(wizard, who) && inside(t)) value += VALUE.fall;
      return value;
    };
    const last = new Map<number, [number, SpellId]>();
    for (const [tick, wizard, spell] of round.casts) {
      if (!source.learnFrom.has(wizard)) continue;
      const value = valueAfter(wizard, tick);
      add(spell, value);
      const before = last.get(wizard);
      if (before && tick - before[0] <= WINDOW) add(`${before[1]}>${spell}`, value);
      last.set(wizard, [tick, spell]);
    }
  }
}

interface Found {
  readonly first: SpellId;
  readonly then: SpellId;
  readonly count: number;
  readonly lift: number;
}
const found: Found[] = [];
for (const [key, count] of seen) {
  const [first, then] = key.split('>') as [SpellId, SpellId | undefined];
  if (!then || count < MIN_SEEN) continue;
  const pair = (sum.get(key) ?? 0) / count;
  const alone = (sum.get(then) ?? 0) / (seen.get(then) ?? 1);
  // Con pocas veces vistas se le cree menos: tira la diferencia hacia cero.
  const lift = ((pair - alone) * count) / (count + DOUBT);
  if (lift >= MIN_LIFT) found.push({ first, then, count, lift });
}
found.sort((a, b) => b.lift - a.lift);
const perSpell = new Map<SpellId, number>();
const chosen = found
  .filter((f) => {
    const n = perSpell.get(f.first) ?? 0;
    if (n >= PER_SPELL) return false;
    perSpell.set(f.first, n + 1);
    return true;
  })
  .slice(0, MAX_COMBOS);

const lines: string[] = [];
const print = (line = ''): void => {
  lines.push(line);
};
const name = (id: SpellId): string => SPELL_NAMES[id];
print(`Combinaciones: ${selfPlay} duelos de autojuego y ${fromD1} partidas registradas`);
print('Después de → conviene (veces vista, cuánto más pega en vida)');
for (const f of chosen) {
  print(
    `  ${name(f.first).padEnd(22)} → ${name(f.then).padEnd(22)} ${String(f.count).padStart(5)}  +${f.lift.toFixed(1)}`,
  );
}
const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);

if (flag('--guardar')) {
  const map = new Map<SpellId, SpellId[]>();
  for (const f of chosen) map.set(f.first, [...(map.get(f.first) ?? []), f.then]);
  const body = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([first, then]) => `  ${first}: [${then.map((t) => `'${t}'`).join(', ')}],`)
    .join('\n');
  writeFileSync(
    new URL('../../../packages/content/src/botCombos.ts', import.meta.url),
    `import type { SpellId } from '@crisol/core';

/**
 * Combinaciones que la IA prueba: después de lanzar un hechizo, cuáles conviene probar justo
 * después porque juntos rinden más que el segundo solo. No son órdenes: la IA las prueba en su
 * copia del duelo y solo las usa si le resultan. Lo escribe
 * \`pnpm --filter @crisol/balance combinaciones --guardar\` (hoy: ${selfPlay} duelos de autojuego y
 * ${fromD1} partidas registradas). No se edita a mano.
 */
export const BOT_COMBOS: Readonly<Partial<Record<SpellId, readonly SpellId[]>>> = {
${body}
};
`,
  );
  console.log('Guardado en packages/content/src/botCombos.ts');
}

/** Lee los registros de D1 y los suma a `sources`. Devuelve cuántas partidas leyó. */
async function readD1(): Promise<number> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    console.error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.');
    process.exit(1);
  }
  const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}${path}`,
      {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );
    const body = (await response.json().catch(() => ({}))) as { success?: boolean; result?: T };
    if (!response.ok || body.success === false)
      throw new Error(`Cloudflare respondió ${response.status}`);
    return body.result as T;
  };
  const databases = await api<{ name: string; uuid: string }[]>(
    '/d1/database?name=crisol-partidas',
  );
  const uuid = databases.find((db) => db.name === 'crisol-partidas')?.uuid;
  if (!uuid) return 0;
  const result = await api<{ results?: { data: string }[] }[]>(`/d1/database/${uuid}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql: 'SELECT data FROM matches WHERE humans > 0' }),
  });
  let count = 0;
  for (const row of result[0]?.results ?? []) {
    try {
      const data = JSON.parse(row.data) as {
        wizards: { id: number; team: number; human: boolean }[];
        rounds: MatchLogRound[];
      };
      const known = new Set<string>(SPELL_IDS);
      const rounds = data.rounds.map((r) => ({
        ...r,
        casts: r.casts.filter(([, , spell]) => known.has(spell)),
      }));
      sources.push({
        rounds,
        teams: new Map(data.wizards.map((w) => [w.id, w.team])),
        learnFrom: new Set(data.wizards.filter((w) => w.human).map((w) => w.id)),
      });
      count++;
    } catch {
      // Un registro roto no suma.
    }
  }
  return count;
}
