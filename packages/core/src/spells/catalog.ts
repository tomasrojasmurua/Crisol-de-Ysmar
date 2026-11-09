import { type Weave, weaveKey } from '../weaving/weave';

/**
 * Los hechizos propios: cada uno tiene su efecto, su visual y su lugar en el Grimorio.
 * Primera tanda: los 5 básicos (1 elemento) y 10 hechizos de 2 elementos.
 * Los tejidos que aún no tienen hechizo propio usan la gramática antigua de formas.
 */
export const SPELL_IDS = [
  'spark',
  'step',
  'splash',
  'sap',
  'claw',
  'fireball',
  'comet',
  'blink',
  'chainLightning',
  'geyser',
  'iceCoffin',
  'thornRush',
  'rootWall',
  'veil',
  'drain',
] as const;

export type SpellId = (typeof SPELL_IDS)[number];

/** El tejido exacto de cada hechizo. */
export const SPELL_WEAVES: Readonly<Record<SpellId, Weave>> = {
  spark: ['brasa'],
  step: ['tormenta'],
  splash: ['marea'],
  sap: ['raiz'],
  claw: ['umbra'],
  fireball: ['brasa', 'brasa'],
  comet: ['brasa', 'tormenta'],
  blink: ['tormenta', 'tormenta'],
  chainLightning: ['tormenta', 'brasa'],
  geyser: ['marea', 'brasa'],
  iceCoffin: ['marea', 'umbra'],
  thornRush: ['raiz', 'brasa'],
  rootWall: ['raiz', 'raiz'],
  veil: ['umbra', 'umbra'],
  drain: ['umbra', 'brasa'],
};

const SPELL_BY_KEY = new Map<string, SpellId>(
  (Object.entries(SPELL_WEAVES) as [SpellId, Weave][]).map(([id, weave]) => [weaveKey(weave), id]),
);

/**
 * El hechizo propio de un tejido. Mientras un Gran hechizo de 3 elementos no exista,
 * ese tejido lanza el hechizo de sus dos primeros elementos. Null: usa la gramática antigua.
 */
export function spellOf(weave: Weave): SpellId | null {
  const exact = SPELL_BY_KEY.get(weaveKey(weave));
  if (exact) return exact;
  if (weave.length === 3) {
    return SPELL_BY_KEY.get(weaveKey(weave.slice(0, 2))) ?? null;
  }
  return null;
}
