import { readFileSync } from 'node:fs';
import { BOT_PROFILES, BOT_TASTE, rulesForMode, SPELL_NAMES } from '@crisol/content';
import {
  BotController,
  type BotLevel,
  createMatch,
  duelSetup,
  type MatchState,
  SPELL_IDS,
  SPELL_WEAVES,
  type SpellId,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Cuánto se parece la IA a las personas al elegir hechizos: juega duelos de IA contra IA y
 * compara qué lanza con el uso real de `data/uso-humano.json` (los totales del informe
 * `uso`, sin nadie en particular). El parecido es la parte del uso que coincide: 100% sería
 * lanzar cada hechizo en la misma proporción que la gente.
 * Uso: pnpm --filter @crisol/balance parecido [duelos] [dificultad] [sin]
 */
const matches = Number(process.argv[2] ?? 200);
const level = (process.argv[3] ?? 'duelist') as BotLevel;
/** La IA del juego no usa el gusto; acá se prueba con y sin él (`sin` como tercer argumento). */
const taste = process.argv[4] === 'sin' ? {} : BOT_TASTE;
const RULES = rulesForMode({ kind: 'duel' });
const MAX_TICKS = TICK_RATE * 60 * 6;

const human = JSON.parse(
  readFileSync(new URL('../data/uso-humano.json', import.meta.url), 'utf8'),
) as Partial<Record<SpellId, number>>;

const counts = new Map<SpellId, number>();
for (let seed = 1; seed <= matches; seed++) {
  const state: MatchState = createMatch(duelSetup(seed, RULES), RULES);
  const bots = new Map(
    state.wizards.map((w) => [
      w.id,
      new BotController(seed * 31 + w.id, RULES, { ...BOT_PROFILES[level], taste }),
    ]),
  );
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, RULES);
    for (const event of state.events) {
      if (event.type === 'release') counts.set(event.spell, (counts.get(event.spell) ?? 0) + 1);
    }
  }
}

const shares = (source: (id: SpellId) => number): Map<SpellId, number> => {
  const total = SPELL_IDS.reduce((sum, id) => sum + source(id), 0);
  return new Map(SPELL_IDS.map((id) => [id, total > 0 ? source(id) / total : 0]));
};
const bot = shares((id) => counts.get(id) ?? 0);
const people = shares((id) => human[id] ?? 0);
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const great = (m: Map<SpellId, number>): number =>
  SPELL_IDS.filter((id) => SPELL_WEAVES[id].length === 3).reduce(
    (s, id) => s + (m.get(id) ?? 0),
    0,
  );
const overlap = SPELL_IDS.reduce((s, id) => s + Math.min(bot.get(id) ?? 0, people.get(id) ?? 0), 0);

console.log(`IA ${level} en ${matches} duelos contra el uso real de las personas`);
console.log(`Parecido: ${pct(overlap)}`);
console.log(`Grandes hechizos: IA ${pct(great(bot))} · personas ${pct(great(people))}`);
const row = (id: SpellId): string =>
  `  ${SPELL_NAMES[id].padEnd(22)} IA ${pct(bot.get(id) ?? 0).padStart(6)}   personas ${pct(people.get(id) ?? 0).padStart(6)}`;
console.log('Lo que más usan las personas:');
for (const id of [...SPELL_IDS]
  .sort((a, b) => (people.get(b) ?? 0) - (people.get(a) ?? 0))
  .slice(0, 15)) {
  console.log(row(id));
}
console.log('Lo que la IA usa de más:');
const excess = (id: SpellId): number => (bot.get(id) ?? 0) - (people.get(id) ?? 0);
for (const id of [...SPELL_IDS].sort((a, b) => excess(b) - excess(a)).slice(0, 12)) {
  console.log(row(id));
}
