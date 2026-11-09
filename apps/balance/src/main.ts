import { ELEMENTS } from '@crisol/content';
import { baseSpellCount, ELEMENT_IDS, SeededRng } from '@crisol/core';

/**
 * Hito 0: solo comprueba que el núcleo corre sin pantalla y de forma determinista.
 * En el Hito 6 aquí se juegan miles de partidas de bots y se reportan tasas de victoria.
 */
const seed = Number(process.argv[2] ?? 1);
const rng = new SeededRng(seed);
const tally = new Map(ELEMENT_IDS.map((id) => [id, 0]));

for (let i = 0; i < 10_000; i++) {
  const element = ELEMENT_IDS[rng.int(0, ELEMENT_IDS.length - 1)];
  if (element !== undefined) {
    tally.set(element, (tally.get(element) ?? 0) + 1);
  }
}

console.log(`Semilla ${seed} · ${baseSpellCount()} conjuros base`);
for (const element of ELEMENTS) {
  console.log(`${element.name.padEnd(9)} ${tally.get(element.id)}`);
}
