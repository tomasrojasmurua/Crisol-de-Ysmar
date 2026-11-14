import {
  AFFINITY_RULES,
  BOT_PROFILES,
  rulesForMode,
  SCHOOLS,
  schoolSpellbook,
} from '@crisol/content';
import {
  affinityPatch,
  BotController,
  combineMods,
  createMatch,
  duelSetup,
  type ElementId,
  type MatchState,
  stepMatch,
  TICK_RATE,
} from '@crisol/core';

/**
 * Balance de las escuelas: duelos de Duelistas que solo tejen su set (más Paso), con la
 * Afinidad en su elemento. Cada escuela debería ganar entre 45% y 55% contra las otras cuatro.
 * Uso: pnpm --filter @crisol/balance schools [duelos por cruce] [semilla inicial]
 */
const perPair = Number(process.argv[2] ?? 200);
const firstSeed = Number(process.argv[3] ?? 1000);
const RULES = rulesForMode({ kind: 'duel' });
const MAX_TICKS = TICK_RATE * 60 * 6;

/** Un duelo entre dos escuelas; devuelve el equipo ganador (0: la primera) o null. */
function duel(seed: number, a: ElementId, b: ElementId): number | null {
  const setup = duelSetup(seed, RULES);
  const sides = [a, b];
  const state: MatchState = createMatch(
    {
      ...setup,
      // La Afinidad de cada uno en su elemento, igual que en una partida (ver LocalMatch).
      wizards: setup.wizards.map((w, i) => {
        const affinity = sides[i] ?? 'brasa';
        const patch = affinityPatch(
          affinity,
          AFFINITY_RULES.ownFatigueMultiplier,
          AFFINITY_RULES.opposingFatigueMultiplier,
        );
        return { ...w, affinity, mods: combineMods(patch) };
      }),
    },
    RULES,
  );
  const bots = new Map(
    state.wizards.map((w, i) => [
      w.id,
      new BotController(seed * 31 + w.id, RULES, {
        ...BOT_PROFILES.duelist,
        spellbook: schoolSpellbook(sides[i] ?? 'brasa'),
      }),
    ]),
  );
  while (state.winnerTeam === null && state.tick < MAX_TICKS) {
    const intents = new Map(
      state.wizards.map((w) => [w.id, bots.get(w.id)?.intentsFor(state, w) ?? []]),
    );
    stepMatch(state, intents, RULES);
  }
  return state.winnerTeam !== null && state.winnerTeam >= 0 ? state.winnerTeam : null;
}

const elements = SCHOOLS.map((s) => s.element);
const wins = new Map(elements.map((e) => [e, 0]));
const played = new Map(elements.map((e) => [e, 0]));
console.log(`Escuelas (${perPair} duelos por cruce, mitad de cada lado):`);
elements.forEach((x, i) => {
  for (const y of elements.slice(i + 1)) {
    let xWins = 0;
    let decided = 0;
    for (let k = 0; k < perPair; k++) {
      const swap = k % 2 === 1;
      const winner = swap ? duel(firstSeed + k, y, x) : duel(firstSeed + k, x, y);
      if (winner === null) continue;
      decided++;
      if (winner === (swap ? 1 : 0)) xWins++;
    }
    wins.set(x, (wins.get(x) ?? 0) + xWins);
    wins.set(y, (wins.get(y) ?? 0) + decided - xWins);
    played.set(x, (played.get(x) ?? 0) + decided);
    played.set(y, (played.get(y) ?? 0) + decided);
    const share = ((xWins / Math.max(1, decided)) * 100).toFixed(0);
    console.log(`  ${x} contra ${y}: ${share}%`);
  }
});
console.log('Victorias por escuela (meta: 45% a 55%):');
for (const element of elements) {
  const rate = ((wins.get(element) ?? 0) / Math.max(1, played.get(element) ?? 0)) * 100;
  console.log(`  ${element.padEnd(9)} ${rate.toFixed(1)}%`);
}
