import { applyHit } from '../combat/hit';
import { enemiesOf } from '../match/queries';
import type { MatchState, Projectile, SpellEntity, Trap, Wall, Wizard } from '../match/state';
import { add, distance, distanceToSegment, length, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';

const WALL_THICKNESS = 0.25;

/** Avanza un paso todos los conjuros en el mundo y quita los que terminaron. */
export function updateSpells(state: MatchState, rules: GameRules): void {
  const walls = state.spells.filter((s): s is Wall => s.kind === 'wall');
  state.spells = state.spells.filter((spell) => updateSpell(state, spell, walls, rules));
}

/** Devuelve false si el conjuro debe desaparecer. */
function updateSpell(
  state: MatchState,
  spell: SpellEntity,
  walls: readonly Wall[],
  rules: GameRules,
): boolean {
  switch (spell.kind) {
    case 'projectile':
      return updateProjectile(state, spell, walls, rules);
    case 'wall':
      return --spell.ticksLeft > 0;
    case 'trap':
      return updateTrap(state, spell, rules);
  }
}

function updateProjectile(
  state: MatchState,
  projectile: Projectile,
  walls: readonly Wall[],
  rules: GameRules,
): boolean {
  const step = scale(projectile.velocity, 1 / TICK_RATE);
  projectile.pos = add(projectile.pos, step);
  projectile.travelled += length(step);
  const radius = rules.forms.projectile.radius;

  for (const wall of walls) {
    if (wall.team === projectile.team) continue;
    const halfLength = rules.forms.wall.halfLength;
    const a = add(wall.center, scale(wall.along, -halfLength));
    const b = add(wall.center, scale(wall.along, halfLength));
    if (distanceToSegment(projectile.pos, a, b) <= radius + WALL_THICKNESS) {
      state.events.push({ type: 'blocked', pos: projectile.pos });
      return false;
    }
  }

  for (const wizard of state.wizards) {
    if (wizard.team === projectile.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, projectile.pos) <= radius + rules.wizard.radius) {
      applyHit(state, wizard, projectile.ownerId, projectile.payload, rules);
      return false;
    }
  }

  const outOfArena = length(projectile.pos) > rules.arenaRadius + 2;
  return projectile.travelled < projectile.maxRange && !outOfArena;
}

function updateTrap(state: MatchState, trap: Trap, rules: GameRules): boolean {
  if (trap.armTicks > 0) {
    trap.armTicks--;
    return true;
  }
  const triggerRadius = rules.forms.trap.triggerRadius;
  const victim = state.wizards.find(
    (w) => w.team !== trap.team && w.hp > 0 && distance(w.pos, trap.pos) <= triggerRadius,
  );
  if (victim) {
    applyHit(state, victim, trap.ownerId, trap.payload, rules);
    return false;
  }
  return --trap.ticksLeft > 0;
}

/** Avanza el salto de Tormenta y descarga su impacto al aterrizar. */
export function updateLeap(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const leap = wizard.leap;
  if (!leap) return;
  wizard.pos = add(wizard.pos, leap.step);
  const len = length(wizard.pos);
  const maxRadius = rules.arenaRadius - rules.wizard.radius;
  if (len > maxRadius) {
    wizard.pos = scale(wizard.pos, maxRadius / len);
  }
  if (--leap.ticksLeft > 0) return;

  wizard.leap = null;
  for (const enemy of enemiesOf(state, wizard)) {
    if (distance(enemy.pos, wizard.pos) <= rules.forms.leap.impactRadius) {
      applyHit(state, enemy, wizard.id, leap.payload, rules);
    }
  }
}
