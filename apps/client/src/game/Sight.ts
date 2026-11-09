import { MAP_DECOR } from '@crisol/content';
import {
  type GameRules,
  isHiddenFrom,
  lineBlocked,
  type MatchState,
  type Wizard,
} from '@crisol/core';

const CLOSE = 5;

/** Si un rival con Velo está escondido de todo el equipo, no se dibuja en absoluto. */
export function veiledFromTeam(
  state: MatchState,
  team: number,
  enemyId: number,
  rules: GameRules,
): boolean {
  const enemy = state.wizards.find((w) => w.id === enemyId);
  if (!enemy || enemy.team === team || !enemy.statuses.veiled) return false;
  const eyes = state.wizards.filter((w) => w.team === team && w.hp > 0);
  return eyes.every((eye) => isHiddenFrom(enemy, eye, rules));
}

/** Si estás cegado, los rivales más allá de tu vista corta no se dibujan. */
export function blindedFrom(player: Wizard, other: Wizard, rules: GameRules): boolean {
  if (!player.statuses.blind || other.team === player.team) return false;
  const d = Math.hypot(other.pos.x - player.pos.x, other.pos.z - player.pos.z);
  return d > rules.statuses.blind.sightRadius;
}

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
      // Con Velo solo se lo ve muy de cerca.
      if (isHiddenFrom(enemy, eye, rules)) continue;
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
