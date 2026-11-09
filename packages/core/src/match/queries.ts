import { add, distance, normalize, scale, sub, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import type { EntityId, MatchState, Wizard } from './state';

export const isAlive = (wizard: Wizard): boolean => wizard.hp > 0;

export function wizardById(state: MatchState, id: EntityId | null): Wizard | undefined {
  return id === null ? undefined : state.wizards.find((w) => w.id === id);
}

export function enemiesOf(state: MatchState, wizard: Wizard): Wizard[] {
  return state.wizards.filter((w) => w.team !== wizard.team && isAlive(w));
}

/**
 * Un rival con Velo no se puede elegir como blanco salvo de muy cerca,
 * y un mago cegado no ve a ningún rival más allá de unos pocos metros.
 */
export function isHiddenFrom(target: Wizard, viewer: Wizard, rules: GameRules): boolean {
  if (target.team === viewer.team) return false;
  const d = distance(target.pos, viewer.pos);
  if (target.statuses.veiled && d > rules.statuses.veiled.revealRadius) return true;
  return viewer.statuses.blind !== undefined && d > rules.statuses.blind.sightRadius;
}

export function nearestEnemy(
  state: MatchState,
  wizard: Wizard,
  rules: GameRules,
): Wizard | undefined {
  let best: Wizard | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemiesOf(state, wizard)) {
    if (isHiddenFrom(enemy, wizard, rules)) continue;
    const d = distance(enemy.pos, wizard.pos);
    if (d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

/** El objetivo fijado si sigue vivo y a la vista; si no, el enemigo visible más cercano. */
export function currentTarget(
  state: MatchState,
  wizard: Wizard,
  rules: GameRules,
): Wizard | undefined {
  const locked = wizardById(state, wizard.lockTarget);
  if (
    locked &&
    isAlive(locked) &&
    locked.team !== wizard.team &&
    !isHiddenFrom(locked, wizard, rules)
  ) {
    return locked;
  }
  return nearestEnemy(state, wizard, rules);
}

/**
 * Dirección de lanzamiento: la elegida, o hacia el objetivo si se tocó sin arrastrar.
 * Con `leadSpeed` (proyectiles), el apuntado automático se adelanta al movimiento del rival.
 */
export function resolveAim(
  state: MatchState,
  wizard: Wizard,
  aim: Vec2,
  rules: GameRules,
  leadSpeed = 0,
): Vec2 {
  const moveSpeed = rules.wizard.moveSpeed;
  const chosen = normalize(aim);
  if (chosen.x !== 0 || chosen.z !== 0) {
    return chosen;
  }
  // Una bestia fijada a mano tiene prioridad; si no, el rival.
  const beast = state.beasts.find((b) => b.id === wizard.lockTarget && b.hp > 0);
  const target = currentTarget(state, wizard, rules);
  if (!beast && !target) {
    return wizard.facing;
  }
  const targetPos = beast ? beast.pos : (target?.pos ?? wizard.pos);
  const velocity = beast ? beast.velocity : scale(target?.moveInput ?? { x: 0, z: 0 }, moveSpeed);
  let aimPoint = targetPos;
  if (leadSpeed > 0) {
    const time = distance(wizard.pos, targetPos) / leadSpeed;
    aimPoint = add(targetPos, scale(velocity, time));
  }
  return normalize(sub(aimPoint, wizard.pos), wizard.facing);
}
