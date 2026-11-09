import { GAME_RULES } from '@crisol/content';
import {
  BotController,
  createMatch,
  duelSetup,
  type GameEvent,
  type MatchState,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Juega muchos duelos de bot contra bot con las reglas reales y reporta el resultado.
 * Uso: pnpm balance [partidas] [semilla inicial]
 */
const matches = Number(process.argv[2] ?? 200);
const firstSeed = Number(process.argv[3] ?? 1);
const MAX_TICKS = TICK_RATE * 60 * 6;

interface Result {
  readonly winnerTeam: number | null;
  readonly seconds: number;
  readonly releases: GameEvent[];
}

function playDuel(seed: number): Result {
  const state: MatchState = createMatch(duelSetup(seed, GAME_RULES), GAME_RULES);
  const bots = new Map(
    state.wizards.map((w) => [w.id, new BotController(seed * 31 + w.id, GAME_RULES)]),
  );
  const releases: GameEvent[] = [];
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, GAME_RULES);
    releases.push(...state.events.filter((e) => e.type === 'release'));
  }
  return { winnerTeam: state.winnerTeam, seconds: state.tick / TICK_RATE, releases };
}

const results = Array.from({ length: matches }, (_, i) => playDuel(firstSeed + i));
const wins = [0, 0];
let draws = 0;
let timeouts = 0;
const formCounts = new Map<string, number>();
for (const result of results) {
  if (result.winnerTeam === null) timeouts++;
  else if (result.winnerTeam < 0) draws++;
  else wins[result.winnerTeam] = (wins[result.winnerTeam] ?? 0) + 1;
  for (const event of result.releases) {
    if (event.type !== 'release') continue;
    // Los hechizos propios se cuentan por nombre; los antiguos, por forma.
    const key = event.spell ?? `(${event.form})`;
    formCounts.set(key, (formCounts.get(key) ?? 0) + 1);
  }
}
const average = results.reduce((sum, r) => sum + r.seconds, 0) / results.length;
const pct = (n: number): string => `${((n / matches) * 100).toFixed(1)}%`;

console.log(
  `Duelos bot contra bot: ${matches} (semillas ${firstSeed} a ${firstSeed + matches - 1})`,
);
console.log(`Gana el mago del sur: ${pct(wins[0] ?? 0)} · del norte: ${pct(wins[1] ?? 0)}`);
console.log(`Empates: ${draws} · Sin terminar en 6 min: ${timeouts}`);
console.log(`Duración media de un duelo: ${average.toFixed(1)} s`);
console.log('Hechizos lanzados (entre paréntesis, formas antiguas):');
for (const [form, count] of [...formCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${form.padEnd(16)} ${count}`);
}
