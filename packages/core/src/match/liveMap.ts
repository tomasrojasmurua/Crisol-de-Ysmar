import type { GameRules, Obstacle } from '../rules';
import type { GrownTree, MatchState } from './state';

const LIVE = new WeakMap<GameRules, { key: string; live: GameRules }>();

/**
 * Las reglas con la jungla de esta ronda: sin los árboles que quemó el Incendio forestal y con
 * los del Brote de árbol. Si nada cambió, son las mismas reglas.
 */
export function liveRules(state: MatchState, rules: GameRules): GameRules {
  const grown = state.spells.filter((s): s is GrownTree => s.kind === 'grownTree');
  if (state.burnedTrees.length === 0 && grown.length === 0) return rules;
  const key = `${state.burnedTrees.length}|${grown.map((g) => g.id).join(',')}`;
  const cached = LIVE.get(rules);
  if (cached?.key === key) return cached.live;
  const obstacles: Obstacle[] = rules.map.obstacles.filter((o) => !isBurned(state, o));
  for (const tree of grown) {
    obstacles.push({ x: tree.pos.x, z: tree.pos.z, radius: tree.radius, kind: 'tree' });
  }
  const live: GameRules = { ...rules, map: { ...rules.map, obstacles } };
  LIVE.set(rules, { key, live });
  return live;
}

/** Si el Incendio forestal ya quemó ese árbol de la jungla. */
export function isBurned(state: MatchState, o: { x: number; z: number }): boolean {
  return state.burnedTrees.some((b) => b.x === o.x && b.z === o.z);
}
