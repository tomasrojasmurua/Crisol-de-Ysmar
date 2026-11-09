import { applyHit, applyStatus } from '../combat/hit';
import { beastStats, damageBeast } from '../match/beasts';
import { obstacleAt, placeInArena } from '../match/obstacles';
import { wizardById } from '../match/queries';
import type {
  MatchState,
  Projectile,
  SpellEntity,
  SpellPayload,
  Wall,
  Wizard,
} from '../match/state';
import { add, distance, distanceToSegment, length, normalize, scale, sub } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import {
  attractProjectile,
  catchProjectile,
  holdProjectile,
  siphonHit,
  touchTriggers,
  updateBond,
  updateBoon,
  updateDeferred,
  updateField,
  updateGuidedBolt,
  updateStepper,
} from './kit/greatFieldUpdates';
import { updateEcho } from './kit/greatReactions';
import { insideStormEye, updateAura, updateBubble } from './kit/greatSupport';
import { updateGrownTree } from './kit/greatThird';
import {
  updateDrown,
  updateFireRain,
  updatePortal,
  updatePyre,
  updateStrike,
  updateSweeper,
  updateTempest,
  updateThornRing,
  updateTrap,
} from './kit/greatUpdates';
import { deflectInBlizzard, hitArea } from './kit/shared';
import { damageSummon, enemySummonAt, updateSummon } from './kit/summons';
import {
  updateCurrent,
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
  const spells = state.spells;
  const count = spells.length;
  // Lo que nace en este paso (el cráter del Meteoro, un charco de la Lluvia de fuego)
  // se agrega al final y empieza a avanzar en el paso siguiente.
  const kept = spells.filter((spell) => updateSpell(state, spell, walls, rules));
  state.spells = kept.concat(spells.slice(count));
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
    case 'strike':
      return updateStrike(state, spell, rules);
    case 'sweeper':
      return updateSweeper(state, spell, rules);
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
    case 'pyre':
      return updatePyre(state, spell, rules);
    case 'drown':
      return updateDrown(state, spell, rules);
    case 'fireRain':
      return updateFireRain(state, spell, rules);
    case 'tempest':
      return updateTempest(state, spell, rules);
    case 'portal':
      return updatePortal(state, spell, rules);
    case 'thornRing':
      return updateThornRing(state, spell, rules);
    case 'trap':
      return updateTrap(state, spell, rules);
    case 'bubble':
      return updateBubble(state, spell);
    case 'aura':
      return updateAura(state, spell, rules);
    case 'grownTree':
      return updateGrownTree(spell);
    case 'summon':
      return updateSummon(state, spell, rules);
    case 'field':
      return updateField(state, spell, rules);
    case 'guidedBolt':
      return updateGuidedBolt(state, spell, rules);
    case 'stepper':
      return updateStepper(state, spell, rules);
    case 'echo':
      return updateEcho(spell);
    case 'deferred':
      return updateDeferred(state, spell);
    case 'bond':
      return updateBond(state, spell, rules);
    case 'boon':
      return updateBoon(state, spell);
  }
}

function updateProjectile(
  state: MatchState,
  projectile: Projectile,
  walls: readonly Wall[],
  rules: GameRules,
): boolean {
  // Flotando en el Llanto del abismo, no avanza.
  if (holdProjectile(state, projectile, rules)) return true;
  deflectInBlizzard(state, projectile, rules);
  attractProjectile(state, projectile, rules);
  const step = scale(projectile.velocity, 1 / TICK_RATE);
  projectile.pos = add(projectile.pos, step);
  projectile.travelled += length(step);
  touchTriggers(
    state,
    projectile.team,
    projectile.pos,
    projectile.radius,
    projectile.payload.weave,
    rules,
  );
  const radius = projectile.radius;
  // La Llama negra no se detiene en muros, invocaciones ni árboles.
  const pierce = projectile.trait === 'pierce';
  // El Ojo del huracán deshace todo proyectil rival que entra.
  if (insideStormEye(state, projectile.team, projectile.pos)) {
    state.events.push({ type: 'blocked', pos: projectile.pos });
    return false;
  }

  for (const wall of pierce ? [] : walls) {
    // El Muro de hielo solo frena a los rivales; la Muralla de raíces, a todos.
    if (wall.team === projectile.team && !wall.solid) continue;
    const a = add(wall.center, scale(wall.along, -wall.halfLength));
    const b = add(wall.center, scale(wall.along, wall.halfLength));
    if (distanceToSegment(projectile.pos, a, b) <= radius + wall.thickness) {
      return impact(state, projectile, rules, true);
    }
  }

  // El Guardián de musgo, el Pararrayos y los demás atajan los proyectiles rivales.
  const summon = pierce ? undefined : enemySummonAt(state, projectile.team, projectile.pos, radius);
  if (summon) {
    if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
    damageSummon(state, summon, projectile.payload.damage);
    return false;
  }

  for (const wizard of state.wizards) {
    if (wizard.team === projectile.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, projectile.pos) <= radius + rules.wizard.radius) {
      const caught = catchProjectile(state, projectile, wizard);
      if (caught === 'absorbed') return false;
      if (caught === 'returned') return true;
      if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
      if (projectile.trait === 'pull') pullCaster(state, projectile, wizard, rules);
      applyHit(state, wizard, projectile.ownerId, projectile.payload, rules);
      if (projectile.payload.spell === 'siphon')
        siphonHit(state, projectile.ownerId, wizard, rules);
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

  if (!pierce && obstacleAt(projectile.pos, radius, rules.map.obstacles)) {
    return impact(state, projectile, rules, true);
  }

  const outOfArena = length(projectile.pos) > rules.arenaRadius + 2;
  if (projectile.travelled >= projectile.maxRange && !outOfArena) {
    // La Bola ígnea estalla al final de su vuelo aunque no toque a nadie.
    if (projectile.payload.blastRadius > 0) return impact(state, projectile, rules, false);
  }
  return projectile.travelled < projectile.maxRange && !outOfArena;
}

/** Cometa negro: quien lo lanzó aparece junto al rival que tocó. */
function pullCaster(
  state: MatchState,
  projectile: Projectile,
  victim: Wizard,
  rules: GameRules,
): void {
  const caster = wizardById(state, projectile.ownerId);
  if (!caster || caster.hp <= 0 || victim.statuses.stasis || caster.statuses.grounded) return;
  const from = caster.pos;
  const back = normalize(sub(from, victim.pos), scale(projectile.velocity, -1));
  const beside = rules.spells.darkComet.beside;
  caster.pos = placeInArena(add(victim.pos, scale(back, beside)), rules.wizard.radius, rules);
  caster.leap = null;
  caster.facing = normalize(sub(victim.pos, caster.pos), caster.facing);
  state.events.push({
    type: 'blink',
    spell: 'darkComet',
    wizardId: caster.id,
    from,
    to: caster.pos,
  });
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
  if (leap.landing) land(state, wizard, leap.landing, rules);
}

/** La Catapulta de raíz: al caer, golpea y enraíza alrededor. */
function land(state: MatchState, wizard: Wizard, payload: SpellPayload, rules: GameRules): void {
  const spell = rules.spells.rootCatapult;
  hitArea(state, wizard.id, wizard.team, wizard.pos, spell.radius, payload, payload.spell, rules);
  for (const enemy of state.wizards) {
    if (enemy.team === wizard.team || enemy.hp <= 0) continue;
    if (distance(enemy.pos, wizard.pos) <= spell.radius + rules.wizard.radius) {
      applyStatus(state, enemy, 'root', wizard.id, rules, spell.rootTicks);
      enemy.leap = null;
    }
  }
}
