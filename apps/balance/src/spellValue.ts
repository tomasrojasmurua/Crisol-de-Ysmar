import { BOT_PROFILES, rulesForMode, SPELL_NAMES } from '@crisol/content';
import {
  BotController,
  createMatch,
  duelSetup,
  type MatchState,
  SPELL_IDS,
  SPELL_WEAVES,
  type SpellId,
  spellOf,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Cuánto vale cada hechizo de 2 elementos: un Duelista con los cinco básicos más ese hechizo
 * contra otro con los básicos más el hechizo de referencia (Bola ígnea si no se dice otro;
 * `ninguno` lo compara contra solo los básicos, que mide mejor los de defensa y escape).
 * Cerca de 50% es que vale lo mismo que la referencia; muy abajo, que rinde menos que lo que
 * descansa (o que la IA no lo sabe usar). También cuenta cuántas veces lo lanza por duelo.
 * Uso: pnpm --filter @crisol/balance valor [duelos por hechizo] [semilla inicial] [referencia]
 */
const perSpell = Number(process.argv[2] ?? 200);
const firstSeed = Number(process.argv[3] ?? 3000);
const referenceArg = process.argv[4] ?? 'fireball';
const reference = referenceArg === 'ninguno' ? null : (referenceArg as SpellId);
/** Si se pasan, solo estos hechizos (separados por coma). */
const only = process.argv[5]?.split(',') as SpellId[] | undefined;
const RULES = rulesForMode({ kind: 'duel' });
const MAX_TICKS = TICK_RATE * 60 * 6;
const BASICS = SPELL_IDS.filter((id) => SPELL_WEAVES[id].length === 1);
const WOVEN = SPELL_IDS.filter((id) => SPELL_WEAVES[id].length === 2);

/** Un duelo; devuelve si ganó el que lleva el hechizo extra y cuántas veces lo lanzó. */
function duel(
  seed: number,
  extra: SpellId,
  withExtra: number,
): { won: boolean | null; casts: number } {
  const setup = duelSetup(seed, RULES);
  const state: MatchState = createMatch(setup, RULES);
  const books = [0, 1].map((i) =>
    i === withExtra ? [...BASICS, extra] : reference ? [...BASICS, reference] : BASICS,
  );
  const bots = new Map(
    state.wizards.map((w, i) => [
      w.id,
      new BotController(seed * 31 + w.id, RULES, {
        ...BOT_PROFILES.duelist,
        spellbook: books[i] ?? BASICS,
      }),
    ]),
  );
  const holder = state.wizards[withExtra]?.id;
  let casts = 0;
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, RULES);
    for (const e of state.events) {
      if (e.type === 'cast' && e.wizardId === holder && spellOf(e.weave) === extra) casts++;
    }
  }
  if (state.winnerTeam === null || state.winnerTeam < 0) return { won: null, casts };
  return { won: state.winnerTeam === state.wizards[withExtra]?.team, casts };
}

const rows: { id: SpellId; rate: number; casts: number }[] = [];
for (const id of WOVEN.filter((w) => w !== reference && (!only || only.includes(w)))) {
  let wins = 0;
  let decided = 0;
  let casts = 0;
  for (let k = 0; k < perSpell; k++) {
    const result = duel(firstSeed + k, id, k % 2);
    casts += result.casts;
    if (result.won === null) continue;
    decided++;
    if (result.won) wins++;
  }
  rows.push({ id, rate: (wins / Math.max(1, decided)) * 100, casts: casts / perSpell });
}
const rival = reference ? `básicos + ${SPELL_NAMES[reference]}` : 'solo básicos';
console.log(`Básicos + un hechizo contra ${rival} (${perSpell} duelos cada uno):`);
for (const row of rows.sort((a, b) => b.rate - a.rate)) {
  const weave = SPELL_WEAVES[row.id].join(' → ');
  console.log(
    `  ${SPELL_NAMES[row.id].padEnd(22)} ${row.rate.toFixed(1).padStart(5)}%  ` +
      `${row.casts.toFixed(1).padStart(4)} por duelo  (${weave})`,
  );
}
