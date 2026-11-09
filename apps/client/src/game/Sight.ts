import { MAP_DECOR } from '@crisol/content';
import {
  type GameRules,
  isHiddenFrom,
  lineBlocked,
  liveRules,
  type MatchState,
  type Wizard,
} from '@crisol/core';

const CLOSE = 5;

/** Si un rival escondido (Velo, Bosque maldito, Sombra prestada) no lo ve nadie del equipo, no se dibuja. */
export function veiledFromTeam(
  state: MatchState,
  team: number,
  enemyId: number,
  rules: GameRules,
): boolean {
  const enemy = state.wizards.find((w) => w.id === enemyId);
  const st = enemy?.statuses;
  if (!enemy || !st || enemy.team === team) return false;
  // Velo, Bosque maldito o Sombra prestada: si nadie del equipo lo ve, no se dibuja.
  if (!st.veiled && !st.shrouded && !st.shadowed) return false;
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
 * rocas ni ruinas en medio, los que muestra un Centinela, los marcados con la Huella y, con el
 * Cazador, todos. Quien borró su rastro solo se ve de cerca. Es solo lo que se muestra.
 */
export function visibleEnemies(state: MatchState, team: number, baseRules: GameRules): Set<number> {
  const rules = liveRules(state, baseRules);
  const seen = new Set<number>();
  const range = MAP_DECOR.sightRange;
  const eyes = state.wizards.filter((w) => w.team === team && w.hp > 0);
  const hunting = eyes.some((w) => w.statuses.hunting);
  const ourIds = new Set(state.wizards.filter((w) => w.team === team).map((w) => w.id));
  // Los Centinelas de tu equipo ven todo a su alrededor, árboles incluidos.
  const sentinels = state.spells.filter(
    (s) => s.kind === 'summon' && s.summon === 'sentinel' && s.team === team && s.hp > 0,
  );
  const sentinelSight = rules.spells.sentinel.sightRadius;
  for (const enemy of state.wizards) {
    if (enemy.team === team) continue;
    // La Lluvia que borra y la Alfombra de musgo sacan del minimapa: solo de cerca.
    const unseen = enemy.statuses.unseen !== undefined;
    if (!unseen) {
      const tracked = enemy.statuses.tracked;
      if (hunting || (tracked && ourIds.has(tracked.sourceId))) {
        seen.add(enemy.id);
        continue;
      }
      if (
        sentinels.some(
          (s) =>
            s.kind === 'summon' &&
            Math.hypot(s.pos.x - enemy.pos.x, s.pos.z - enemy.pos.z) <= sentinelSight,
        )
      ) {
        seen.add(enemy.id);
        continue;
      }
    }
    for (const eye of eyes) {
      // Con Velo solo se lo ve muy de cerca.
      if (isHiddenFrom(enemy, eye, rules)) continue;
      const dx = enemy.pos.x - eye.pos.x;
      const dz = enemy.pos.z - eye.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > (unseen ? CLOSE * CLOSE : range * range)) continue;
      // Pegado a uno, se le oye aunque haya un árbol en medio.
      if (d2 > CLOSE * CLOSE && lineBlocked(eye.pos, enemy.pos, rules.map.obstacles)) continue;
      seen.add(enemy.id);
      break;
    }
  }
  return seen;
}
