import { applyHit } from '../combat/hit';
import { beastStats, damageBeast } from '../match/beasts';
import { obstacleAt, placeInArena } from '../match/obstacles';
import type { MatchState, Projectile, SpellEntity, Wall, Wizard } from '../match/state';
import { add, distance, distanceToSegment, length, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { deflectInBlizzard, hitArea } from './kit/shared';
import { damageSummon, enemySummonAt, updateSummon } from './kit/summons';
import {
  updateCurrent,
  updateGeyser,
  updateIgnite,
  updateObsidian,
  updateShackle,
  updateTether,
  updateThornRush,
  updateZone,
} from './kit/updates';

/** Avanza un paso todos los hechizos en el mundo y quita los que terminaron. */
export function updateSpells(state: MatchState, rules: GameRules): void {
  const walls = state.spells.filter((s): s is Wall => s.kind === 'wall');
  state.spells = state.spells.filter((spell) => updateSpell(state, spell, walls, rules));
}

/** Devuelve false si el hechizo debe desaparecer. */
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
    case 'zone':
      return updateZone(state, spell, rules);
    case 'current':
      return updateCurrent(state, spell, rules);
    case 'geyser':
      return updateGeyser(state, spell, rules);
    case 'thornRush':
      return updateThornRush(state, spell, rules);
    case 'tether':
      return updateTether(state, spell, rules);
    case 'obsidian':
      return updateObsidian(state, spell, rules);
    case 'ignite':
      return updateIgnite(state, spell);
    case 'shackle':
      return updateShackle(state, spell, rules);
    case 'summon':
      return updateSummon(state, spell, rules);
  }
}

function updateProjectile(
  state: MatchState,
  projectile: Projectile,
  walls: readonly Wall[],
  rules: GameRules,
): boolean {
  deflectInBlizzard(state, projectile, rules);
  const step = scale(projectile.velocity, 1 / TICK_RATE);
  projectile.pos = add(projectile.pos, step);
  projectile.travelled += length(step);
  const radius = projectile.radius;

  for (const wall of walls) {
    // El Muro de hielo solo frena a los rivales; la Muralla de raíces, a todos.
    if (wall.team === projectile.team && !wall.solid) continue;
    const a = add(wall.center, scale(wall.along, -wall.halfLength));
    const b = add(wall.center, scale(wall.along, wall.halfLength));
    if (distanceToSegment(projectile.pos, a, b) <= radius + wall.thickness) {
      return impact(state, projectile, rules, true);
    }
  }

  // El Guardián de musgo, el Pararrayos y los demás atajan los proyectiles rivales.
  const summon = enemySummonAt(state, projectile.team, projectile.pos, radius);
  if (summon) {
    if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
    damageSummon(state, summon, projectile.payload.damage);
    return false;
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
  if (payload.blastRadius > 0) {
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

/** Avanza un desplazamiento: el Paso, el Cometa (que deja fuego) o el tirón de la Liana. */
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
      durationTicks: comet.trailTicks,
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
}
