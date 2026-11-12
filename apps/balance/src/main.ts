import { BOT_LEVEL_NAMES, BOT_PROFILES, rulesForMode } from '@crisol/content';
import {
  BotController,
  type BotLevel,
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
/** Las reglas del 1v1 real: en la plaza, salvo que la jungla esté encendida para el duelo. */
const RULES = rulesForMode({ kind: 'duel' });

interface Result {
  readonly winnerTeam: number | null;
  readonly seconds: number;
  readonly releases: GameEvent[];
}

/** Un duelo entre dos bots; por defecto, los dos Duelistas. */
function playDuel(
  seed: number,
  levels: readonly [BotLevel, BotLevel] = ['duelist', 'duelist'],
): Result {
  const state: MatchState = createMatch(duelSetup(seed, RULES), RULES);
  const bots = new Map(
    state.wizards.map((w, i) => [
      w.id,
      new BotController(seed * 31 + w.id, RULES, BOT_PROFILES[levels[i] ?? 'duelist']),
    ]),
  );
  const releases: GameEvent[] = [];
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, RULES);
    releases.push(...state.events.filter((e) => e.type === 'release'));
  }
  return { winnerTeam: state.winnerTeam, seconds: state.tick / TICK_RATE, releases };
}

const results = Array.from({ length: matches }, (_, i) => playDuel(firstSeed + i));
const wins = [0, 0];
let draws = 0;
let timeouts = 0;
const spellCounts = new Map<string, number>();
for (const result of results) {
  if (result.winnerTeam === null) timeouts++;
  else if (result.winnerTeam < 0) draws++;
  else wins[result.winnerTeam] = (wins[result.winnerTeam] ?? 0) + 1;
  for (const event of result.releases) {
    if (event.type !== 'release') continue;
    spellCounts.set(event.spell, (spellCounts.get(event.spell) ?? 0) + 1);
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
console.log('Hechizos lanzados:');
for (const [spell, count] of [...spellCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${spell.padEnd(16)} ${count}`);
}

// Las dificultades entre sí: cada cruce juega en los dos lados, para no premiar al sur.
const PAIRS: readonly [BotLevel, BotLevel][] = [
  ['master', 'duelist'],
  ['duelist', 'apprentice'],
  ['master', 'apprentice'],
];
const perPair = Math.max(20, Math.round(matches / 4));
console.log(`Dificultades (${perPair} duelos por cruce, mitad de cada lado):`);
for (const [strong, weak] of PAIRS) {
  let strongWins = 0;
  for (let i = 0; i < perPair; i++) {
    const swap = i % 2 === 1;
    const result = playDuel(firstSeed + i, swap ? [weak, strong] : [strong, weak]);
    if (result.winnerTeam === (swap ? 1 : 0)) strongWins++;
  }
  const share = ((strongWins / perPair) * 100).toFixed(0);
  console.log(`  ${BOT_LEVEL_NAMES[strong]} le gana a ${BOT_LEVEL_NAMES[weak]}: ${share}%`);
}
