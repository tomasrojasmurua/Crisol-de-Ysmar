import { MAP_DECOR } from '@crisol/content';
import { type GameRules, lineBlocked, type MatchState } from '@crisol/core';

const CLOSE = 5;

/**
 * Qué rivales ve un equipo: los que están cerca de alguno de sus magos vivos y sin árboles,
 * rocas ni ruinas en medio. Es solo lo que se muestra; la simulación no cambia.
 */
export function visibleEnemies(state: MatchState, team: number, rules: GameRules): Set<number> {
  const seen = new Set<number>();
  const range = MAP_DECOR.sightRange;
  const eyes = state.wizards.filter((w) => w.team === team && w.hp > 0);
  for (const enemy of state.wizards) {
    if (enemy.team === team) continue;
    for (const eye of eyes) {
      const dx = enemy.pos.x - eye.pos.x;
      const dz = enemy.pos.z - eye.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > range * range) continue;
      // Pegado a uno, se le oye aunque haya un árbol en medio.
      if (d2 > CLOSE * CLOSE && lineBlocked(eye.pos, enemy.pos, rules.map.obstacles)) continue;
      seen.add(enemy.id);
      break;
    }
  }
  return seen;
}
