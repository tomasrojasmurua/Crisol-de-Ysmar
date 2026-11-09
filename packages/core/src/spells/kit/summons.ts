import { applyHit } from '../../combat/hit';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFrom, wizardById } from '../../match/queries';
import type { MatchState, Summon, Wizard } from '../../match/state';
import { add, distance, normalize, scale, sub, type Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import {
  summonGone,
  updateAncientTree,
  updateCarnivore,
  updateGlacier,
  updateMagmaGolem,
  updateMirage,
  updateShadowTwin,
  updateSwarm,
  updateWanderingSpark,
} from './greatSummons';

/** La invocación rival que toca ese punto, si hay alguna. */
export function enemySummonAt(
  state: MatchState,
  team: number,
  pos: Vec2,
  radius: number,
): Summon | undefined {
  for (const spell of state.spells) {
    if (spell.kind !== 'summon' || spell.team === team || spell.hp <= 0) continue;
    if (distance(spell.pos, pos) <= radius + spell.radius) return spell;
  }
  return undefined;
}

/** Daña una invocación. El Pararrayos no cuenta daño: cae con cierta cantidad de golpes. */
export function damageSummon(state: MatchState, summon: Summon, amount: number): void {
  if (summon.hp <= 0 || amount <= 0) return;
  summon.hp = Math.max(0, summon.hp - (summon.summon === 'lightningRod' ? 1 : amount));
  if (summon.hp === 0) {
    state.events.push({ type: 'summonGone', summon: summon.summon, pos: summon.pos });
  }
}

/** Avanza una invocación; devuelve false cuando desaparece. */
export function updateSummon(state: MatchState, summon: Summon, rules: GameRules): boolean {
  const owner = wizardById(state, summon.ownerId);
  if (summon.hp <= 0) {
    summonGone(state, summon, rules);
    return false;
  }
  if (!owner || owner.hp <= 0 || --summon.ticksLeft <= 0) {
    state.events.push({ type: 'summonGone', summon: summon.summon, pos: summon.pos });
    summonGone(state, summon, rules);
    return false;
  }
  switch (summon.summon) {
    case 'wisp':
      return updateWisp(state, summon, owner, rules);
    case 'lightningRod':
      updateLightningRod(state, summon, owner, rules);
      return true;
    case 'mossGuardian':
      updateMossGuardian(state, summon, owner, rules);
      return true;
    case 'decoy':
      move(summon, summon.facing, rules.spells.decoy.speed, rules);
      return true;
    case 'wanderingSpark':
      return updateWanderingSpark(state, summon, owner, rules);
    case 'magmaGolem':
      updateMagmaGolem(state, summon, owner, rules);
      return true;
    case 'glacier':
      return updateGlacier(state, summon, owner, rules);
    case 'swarm':
      updateSwarm(state, summon, owner, rules);
      return true;
    case 'ancientTree':
      updateAncientTree(state, summon, rules);
      return true;
    case 'shadowTwin':
      updateShadowTwin(state, summon, owner, rules);
      return true;
    case 'carnivore':
      return updateCarnivore(state, summon, rules);
    case 'mirage':
      updateMirage(summon, owner, rules);
      return true;
    case 'sentinel':
      return true;
  }
}

/** El rival vivo y visible más cercano a un punto, dentro de cierto alcance. */
export function nearestVisibleEnemy(
  state: MatchState,
  owner: Wizard,
  from: Vec2,
  range: number,
  rules: GameRules,
): Wizard | undefined {
  let best: Wizard | undefined;
  let bestDistance = range;
  for (const wizard of state.wizards) {
    if (wizard.team === owner.team || wizard.hp <= 0) continue;
    if (isHiddenFrom(wizard, owner, rules)) continue;
    const d = distance(wizard.pos, from);
    if (d <= bestDistance && !lineBlocked(from, wizard.pos, rules.map.obstacles)) {
      best = wizard;
      bestDistance = d;
    }
  }
  return best;
}

export function move(summon: Summon, dir: Vec2, speed: number, rules: GameRules): void {
  const step = scale(normalize(dir), speed / TICK_RATE);
  if (step.x === 0 && step.z === 0) return;
  summon.pos = placeInArena(add(summon.pos, step), summon.radius, rules);
  summon.facing = normalize(dir, summon.facing);
}

/** Fuego fatuo: flota hacia el rival más cercano y explota al tocarlo. */
function updateWisp(state: MatchState, wisp: Summon, owner: Wizard, rules: GameRules): boolean {
  const spell = rules.spells.wisp;
  const prey = nearestVisibleEnemy(state, owner, wisp.pos, spell.seekRange, rules);
  if (!prey) return true;
  if (distance(prey.pos, wisp.pos) <= wisp.radius + rules.wizard.radius) {
    state.events.push({ type: 'burst', spell: 'wisp', pos: wisp.pos, radius: 1.2 });
    applyHit(state, prey, wisp.ownerId, wisp.payload, rules);
    return false;
  }
  // Flota por encima de árboles y rocas: no rodea, va directo.
  const step = scale(normalize(sub(prey.pos, wisp.pos)), spell.speed / TICK_RATE);
  wisp.pos = add(wisp.pos, step);
  wisp.facing = normalize(step, wisp.facing);
  return true;
}

/** Pararrayos: cada tanto, un rayo al rival más cercano que tenga a la vista. */
function updateLightningRod(state: MatchState, rod: Summon, owner: Wizard, rules: GameRules): void {
  if (--rod.cooldown > 0) return;
  const spell = rules.spells.lightningRod;
  const prey = nearestVisibleEnemy(state, owner, rod.pos, spell.range, rules);
  if (!prey) {
    rod.cooldown = 1;
    return;
  }
  rod.cooldown = spell.intervalTicks;
  state.events.push({ type: 'zap', from: rod.pos, to: prey.pos });
  applyHit(state, prey, rod.ownerId, rod.payload, rules);
}

/** Guardián de musgo: sigue a quien lo invocó y pega al rival que se acerque. */
function updateMossGuardian(
  state: MatchState,
  guardian: Summon,
  owner: Wizard,
  rules: GameRules,
): void {
  const spell = rules.spells.mossGuardian;
  if (guardian.cooldown > 0) guardian.cooldown--;
  const prey = nearestVisibleEnemy(state, owner, guardian.pos, spell.aggroRange, rules);
  if (prey) {
    const d = distance(prey.pos, guardian.pos);
    if (d <= spell.attackRange) {
      guardian.facing = normalize(sub(prey.pos, guardian.pos), guardian.facing);
      if (guardian.cooldown === 0) {
        guardian.cooldown = spell.attackCooldownTicks;
        state.events.push({ type: 'burst', spell: 'mossGuardian', pos: prey.pos, radius: 0.8 });
        applyHit(state, prey, guardian.ownerId, guardian.payload, rules);
      }
      return;
    }
    move(guardian, sub(prey.pos, guardian.pos), spell.speed, rules);
    return;
  }
  if (distance(owner.pos, guardian.pos) > spell.followDistance) {
    move(guardian, sub(owner.pos, guardian.pos), spell.speed, rules);
  }
}
