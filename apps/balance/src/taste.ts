import { readFileSync, writeFileSync } from 'node:fs';
import { BOT_PROFILES, BOT_TASTE, rulesForMode } from '@crisol/content';
import {
  BotController,
  createMatch,
  duelSetup,
  type MatchState,
  SPELL_IDS,
  type SpellId,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Recalcula cuánto le gusta a la IA cada hechizo (`packages/content/src/botTaste.ts`) para
 * que elija en proporciones parecidas a las de las personas (`data/uso-humano.json`, que sale
 * del informe `uso`). Juega duelos de Duelistas, compara y corrige el gusto de a poco, varias
 * vueltas. Parte del gusto actual, así que con datos nuevos basta correrlo otra vez.
 * Uso: pnpm --filter @crisol/balance gusto [vueltas] [duelos por vuelta]
 */
const rounds = Number(process.argv[2] ?? 6);
const duels = Number(process.argv[3] ?? 400);
const RULES = rulesForMode({ kind: 'duel' });
const MAX_TICKS = TICK_RATE * 60 * 6;
/** Cuánto corrige por vuelta (1 sería todo de una vez, que oscila) y entre qué límites. */
const STEP = 0.6;
const MIN_TASTE = 0.08;
const MAX_TASTE = 12;
const OUTPUT = new URL('../../../packages/content/src/botTaste.ts', import.meta.url);

const human = JSON.parse(
  readFileSync(new URL('../data/uso-humano.json', import.meta.url), 'utf8'),
) as Partial<Record<SpellId, number>>;
const humanTotal = SPELL_IDS.reduce((sum, id) => sum + (human[id] ?? 0), 0);

let taste: Partial<Record<SpellId, number>> = { ...BOT_TASTE };
for (let round = 0; round < rounds; round++) {
  const counts = new Map<SpellId, number>();
  for (let i = 1; i <= duels; i++) {
    const seed = round * 10_000 + i;
    const state: MatchState = createMatch(duelSetup(seed, RULES), RULES);
    const profile = { ...BOT_PROFILES.duelist, taste };
    const bots = new Map(
      state.wizards.map((w) => [w.id, new BotController(seed * 31 + w.id, RULES, profile)]),
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
  const botTotal = SPELL_IDS.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  let overlap = 0;
  const next: Partial<Record<SpellId, number>> = {};
  for (const id of SPELL_IDS) {
    const people = human[id] ?? 0;
    const bot = counts.get(id) ?? 0;
    overlap += Math.min(people / humanTotal, bot / botTotal);
    // Medio lanzamiento de más a cada lado: un hechizo que nadie usó no se va a cero.
    const ratio = (people + 0.5) / (humanTotal + 77) / ((bot + 0.5) / (botTotal + 77));
    const value = (taste[id] ?? 1) * ratio ** STEP;
    next[id] = Math.min(MAX_TASTE, Math.max(MIN_TASTE, value));
  }
  console.log(`Vuelta ${round + 1}: se parece ${(overlap * 100).toFixed(1)}% a las personas`);
  taste = next;
}

const lines = Object.entries(taste)
  .filter(([, value]) => value !== undefined && Math.abs(value - 1) >= 0.05)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, value]) => `  ${id}: ${Number(value?.toFixed(2))},`);
writeFileSync(
  OUTPUT,
  `import type { SpellId } from '@crisol/core';

/**
 * Cuánto le gusta a la IA cada hechizo (1 si no aparece): multiplica el peso de cada opción
 * pensada, para que elija en proporciones parecidas a las de las personas. Solo lo usa el
 * simulador (para parecerse a una partida real); la IA del juego no lo usa. Lo escribe
 * \`pnpm --filter @crisol/balance gusto\` a partir de \`apps/balance/data/uso-humano.json\`
 * (hoy: 6 jugadores y 72 partidas, al 24 de noviembre de 2026). No se edita a mano.
 */
export const BOT_TASTE: Readonly<Partial<Record<SpellId, number>>> = {
${lines.join('\n')}
};
`,
);
console.log('Gusto guardado en packages/content/src/botTaste.ts');
