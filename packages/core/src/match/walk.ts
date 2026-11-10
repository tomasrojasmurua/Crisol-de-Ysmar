import { moveMultiplier } from '../combat/statuses';
import { add, clampToCircle, length, scale, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { blockByRings, blockByWalls } from '../spells/solidWalls';
import { placeInArena } from './obstacles';
import type { MatchState, Wizard } from './state';

/**
 * Adónde llega un mago si camina un paso en esta dirección, sin cambiar nada. La usan el paso
 * de la simulación y la predicción del celular en red, para que los dos caminen igual: la
 * velocidad, los estados que frenan, los árboles, los muros, las zarzas y el borde de la arena.
 * `rules` deben ser las del mapa vivo (`liveRules`).
 */
export function walkTarget(
  state: MatchState,
  wizard: Wizard,
  moveInput: Vec2,
  rules: GameRules,
): Vec2 {
  const speed = rules.wizard.moveSpeed * wizard.mods.moveSpeed * moveMultiplier(wizard, rules);
  const move = scale(moveInput, speed / TICK_RATE);
  if (length(move) === 0) return wizard.pos;
  const radius = rules.wizard.radius;
  if (wizard.statuses.phased) {
    // Fantasma: atraviesa árboles, rocas, muros y zarzas; solo lo frena el borde de la arena.
    return clampToCircle(add(wizard.pos, move), rules.arenaRadius - radius);
  }
  const next = placeInArena(add(wizard.pos, move), radius, rules);
  return blockByRings(state, wizard, blockByWalls(state, wizard, next, radius), radius);
}
