import { add, distance, normalize, scale, sub, type Vec2 } from '../math/vec2';
import type { EntityId, MatchState, Wizard } from './state';

export const isAlive = (wizard: Wizard): boolean => wizard.hp > 0;

export function wizardById(state: MatchState, id: EntityId | null): Wizard | undefined {
  return id === null ? undefined : state.wizards.find((w) => w.id === id);
}

export function enemiesOf(state: MatchState, wizard: Wizard): Wizard[] {
  return state.wizards.filter((w) => w.team !== wizard.team && isAlive(w));
}

export function nearestEnemy(state: MatchState, wizard: Wizard): Wizard | undefined {
  let best: Wizard | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemiesOf(state, wizard)) {
    const d = distance(enemy.pos, wizard.pos);
    if (d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

/** El objetivo fijado si sigue vivo; si no, el enemigo más cercano. */
export function currentTarget(state: MatchState, wizard: Wizard): Wizard | undefined {
  const locked = wizardById(state, wizard.lockTarget);
  if (locked && isAlive(locked) && locked.team !== wizard.team) {
    return locked;
  }
  return nearestEnemy(state, wizard);
}

/**
 * Dirección de lanzamiento: la elegida, o hacia el objetivo si se tocó sin arrastrar.
 * Con `leadSpeed` (proyectiles), el apuntado automático se adelanta al movimiento del rival.
 */
export function resolveAim(
  state: MatchState,
  wizard: Wizard,
  aim: Vec2,
  moveSpeed = 0,
  leadSpeed = 0,
): Vec2 {
  const chosen = normalize(aim);
  if (chosen.x !== 0 || chosen.z !== 0) {
    return chosen;
  }
  const target = currentTarget(state, wizard);
  if (!target) {
    return wizard.facing;
  }
  let aimPoint = target.pos;
  if (leadSpeed > 0) {
    const time = distance(wizard.pos, target.pos) / leadSpeed;
    aimPoint = add(target.pos, scale(target.moveInput, moveSpeed * time));
  }
  return normalize(sub(aimPoint, wizard.pos), wizard.facing);
}
