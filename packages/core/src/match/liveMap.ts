import type { Vec2 } from '../math/vec2';
import type { GameRules, Obstacle } from '../rules';
import type { MatchState } from './state';

const LIVE = new WeakMap<GameRules, { key: string; live: GameRules }>();

/** Lo que crece o se levanta en la ronda y corta el paso, los hechizos y la vista. */
interface Growth {
  readonly id: number;
  readonly pos: Vec2;
  readonly radius: number;
  readonly kind: string;
}

/** Los árboles del Brote de árbol, el volcán de la Erupción y el Hongo gigante. */
function growths(state: MatchState): Growth[] {
  const found: Growth[] = [];
  for (const s of state.spells) {
    if (s.kind === 'grownTree')
      found.push({ id: s.id, pos: s.pos, radius: s.radius, kind: 'tree' });
    else if (s.kind === 'field' && s.mode === 'volcano' && s.ticksLeft > 0) {
      found.push({ id: s.id, pos: s.pos, radius: s.radius, kind: 'rock' });
    } else if (s.kind === 'summon' && s.summon === 'mushroom' && s.hp > 0) {
      found.push({ id: s.id, pos: s.pos, radius: s.radius, kind: 'tree' });
    }
  }
  return found;
}

/**
 * Las reglas con la jungla de esta ronda: sin los árboles que quemó el Incendio forestal y con
 * lo que creció: el Brote de árbol, el volcán de la Erupción y el Hongo gigante.
 * Si nada cambió, son las mismas reglas.
 */
export function liveRules(state: MatchState, rules: GameRules): GameRules {
  const grown = growths(state);
  if (state.burnedTrees.length === 0 && grown.length === 0) return rules;
  const key = `${state.burnedTrees.length}|${grown.map((g) => g.id).join(',')}`;
  const cached = LIVE.get(rules);
  if (cached?.key === key) return cached.live;
  const obstacles: Obstacle[] = rules.map.obstacles.filter((o) => !isBurned(state, o));
  for (const g of grown) {
    obstacles.push({ x: g.pos.x, z: g.pos.z, radius: g.radius, kind: g.kind });
  }
  const live: GameRules = { ...rules, map: { ...rules.map, obstacles } };
  LIVE.set(rules, { key, live });
  return live;
}

/** Si el Incendio forestal ya quemó ese árbol de la jungla. */
export function isBurned(state: MatchState, o: { x: number; z: number }): boolean {
  return state.burnedTrees.some((b) => b.x === o.x && b.z === o.z);
}
