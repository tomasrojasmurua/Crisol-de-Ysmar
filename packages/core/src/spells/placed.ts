import type { GameRules } from '../rules';
import type { SpellId } from './catalog';

/**
 * Los hechizos que se dejan en un punto del suelo (los que caen del cielo, las zonas, los muros y
 * las invocaciones): arrastrando ✦ se elige hasta dónde llegan. Los demás solo usan la
 * dirección.
 */
export const PLACED_SPELLS: ReadonlySet<SpellId> = new Set<SpellId>([
  'abyss',
  'acceleratedGrowth',
  'ancientTree',
  'blizzard',
  'bonfire',
  'bonfireSmoke',
  'carnivore',
  'cauldron',
  'cursedGrove',
  'deluge',
  'eruption',
  'geyser',
  'giantMushroom',
  'iceWall',
  'lightningRod',
  'mandrake',
  'mangrove',
  'meteor',
  'mist',
  'monsoon',
  'pollen',
  'portal',
  'rootWall',
  'sentinel',
  'solarGrenade',
  'sowing',
  'spores',
  'spring',
  'thornRing',
  'thrownShadow',
  'totemCircle',
  'treeSprout',
  'voodooDoll',
  'wither',
]);

/** Hasta dónde llega y qué tan grande es lo que deja un hechizo de suelo, para dibujar la mira. */
export function placedShape(
  spell: SpellId,
  rules: GameRules,
): { readonly range: number; readonly radius: number } {
  const numbers = rules.spells[spell] as { range?: number; distance?: number; radius?: number };
  return { range: numbers.range ?? numbers.distance ?? 0, radius: numbers.radius ?? 1.5 };
}
