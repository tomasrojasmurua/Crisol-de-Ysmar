import { applyHit } from '../combat/hit';
import { beastStats, damageBeast } from '../match/beasts';
import { obstacleAt, placeInArena } from '../match/obstacles';
import { enemiesOf } from '../match/queries';
import type { MatchState, Projectile, SpellEntity, Trap, Wall, Wizard } from '../match/state';
import { add, distance, distanceToSegment, length, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { hitArea } from './kit/shared';
import { updateGeyser, updateTether, updateThornRush, updateZone } from './kit/updates';

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
    case 'zone':
      return updateZone(state, spell, rules);
    case 'geyser':
      return updateGeyser(state, spell, rules);
    case 'thornRush':
      return updateThornRush(state, spell, rules);
    case 'tether':
      return updateTether(state, spell, rules);
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
  const radius = projectile.radius;

  for (const wall of walls) {
    // El muro de agua solo frena a los rivales; la muralla sólida, a todos.
    if (wall.team === projectile.team && !wall.solid) continue;
    const a = add(wall.center, scale(wall.along, -wall.halfLength));
    const b = add(wall.center, scale(wall.along, wall.halfLength));
    if (distanceToSegment(projectile.pos, a, b) <= radius + wall.thickness) {
      return impact(state, projectile, rules, true);
    }
  }

  for (const wizard of state.wizards) {
    if (wizard.team === projectile.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, projectile.pos) <= radius + rules.wizard.radius) {
      if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
      applyHit(state, wizard, projectile.ownerId, projectile.payload, rules);
      return false;
    }
  }

  for (const beast of state.beasts) {
    if (distance(beast.pos, projectile.pos) <= radius + beastStats(beast, rules).radius) {
      if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
      damageBeast(state, beast, projectile.ownerId, projectile.payload.damage, rules);
      return false;
    }
  }

  if (obstacleAt(projectile.pos, radius, rules.map.obstacles)) {
    return impact(state, projectile, rules, true);
  }

  const outOfArena = length(projectile.pos) > rules.arenaRadius + 2;
  if (projectile.travelled >= projectile.maxRange && !outOfArena) {
    // La Bola ígnea estalla al final de su vuelo aunque no toque a nadie.
    if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
  }
  return projectile.travelled < projectile.maxRange && !outOfArena;
}

/** Un proyectil choca: si explota, daña en área; si no, solo se deshace contra el muro o el árbol. */
function impact(
  state: MatchState,
  projectile: Projectile,
  rules: GameRules,
  blocked: boolean,
): false {
  const payload = projectile.payload;
  if (payload.blastRadius > 0 && payload.spell) {
    const pos = projectile.pos;
    hitArea(
      state,
      projectile.ownerId,
      projectile.team,
      pos,
      payload.blastRadius,
      payload,
      payload.spell,
      rules,
    );
  } else if (blocked) {
    state.events.push({ type: 'blocked', pos: projectile.pos });
  }
  return false;
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

/** Avanza un salto o desplazamiento; el de Tormenta descarga su impacto al aterrizar. */
export function updateLeap(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const leap = wizard.leap;
  if (!leap) return;
  if (leap.trail === 'fire' && leap.ticksLeft % rules.spells.comet.trailEvery === 0) {
    const comet = rules.spells.comet;
    state.spells.push({
      kind: 'zone',
      id: state.nextEntityId++,
      ownerId: wizard.id,
      team: wizard.team,
      pos: wizard.pos,
      radius: comet.trailRadius,
      effect: 'burn',
      ticksLeft: comet.trailTicks,
    });
  }
  wizard.pos = add(wizard.pos, leap.step);
  const len = length(wizard.pos);
  const maxRadius = rules.arenaRadius - rules.wizard.radius;
  if (len > maxRadius) {
    wizard.pos = scale(wizard.pos, maxRadius / len);
  }
  if (--leap.ticksLeft > 0) return;

  // El salto pasa por encima de árboles y rocas, pero se aterriza en suelo libre.
  wizard.pos = placeInArena(wizard.pos, rules.wizard.radius, rules);
  wizard.leap = null;
  const payload = leap.payload;
  if (!payload) return;
  for (const enemy of enemiesOf(state, wizard)) {
    if (distance(enemy.pos, wizard.pos) <= rules.forms.leap.impactRadius) {
      applyHit(state, enemy, wizard.id, payload, rules);
    }
  }
  for (const beast of state.beasts) {
    if (distance(beast.pos, wizard.pos) <= rules.forms.leap.impactRadius) {
      damageBeast(state, beast, wizard.id, payload.damage, rules);
    }
  }
}
