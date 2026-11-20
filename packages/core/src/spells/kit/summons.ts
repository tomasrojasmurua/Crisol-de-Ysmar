import { applyHit, applyStatus, dealDamage } from '../../combat/hit';
import { beastStats, damageBeast } from '../../match/beasts';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFromServantsOf, summonById, wizardById } from '../../match/queries';
import type { Beast, MatchState, Summon, Wizard } from '../../match/state';
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
import { hitTarget, type SpellTarget, targetPos } from './shared';

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

/**
 * Daña una invocación. El Pararrayos no cuenta daño: cae con cierta cantidad de golpes.
 * El Muñeco vudú no se rompe: el golpe lo recibe el rival marcado.
 */
export function damageSummon(state: MatchState, summon: Summon, amount: number): void {
  if (summon.hp <= 0 || amount <= 0) return;
  if (summon.summon === 'voodooDoll') {
    const victim = wizardById(state, summon.targetId);
    if (victim && victim.hp > 0) {
      state.events.push({ type: 'zap', from: summon.pos, to: victim.pos });
      dealDamage(state, victim, summon.ownerId, amount, 'mark');
    }
    return;
  }
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
    case 'mushroom':
      updateMushroom(state, summon, rules);
      return true;
    case 'voodooDoll': {
      const victim = wizardById(state, summon.targetId);
      return victim !== undefined && victim.hp > 0;
    }
  }
}

/**
 * Hongo gigante: guarda su vida en `cooldown` para notar los golpes; cuando lo golpean,
 * suelta esporas que frenan a los rivales cercanos.
 */
function updateMushroom(state: MatchState, mushroom: Summon, rules: GameRules): void {
  if (mushroom.hp >= mushroom.cooldown) return;
  mushroom.cooldown = mushroom.hp;
  const spell = rules.spells.giantMushroom;
  state.events.push({
    type: 'burst',
    spell: 'giantMushroom',
    pos: mushroom.pos,
    radius: spell.sporeRadius,
  });
  for (const wizard of state.wizards) {
    if (wizard.team === mushroom.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, mushroom.pos) > spell.sporeRadius + rules.wizard.radius) continue;
    applyStatus(state, wizard, 'slow', mushroom.ownerId, rules, spell.slowTicks);
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
    if (isHiddenFromServantsOf(wizard, owner, rules)) continue;
    const d = distance(wizard.pos, from);
    if (d <= bestDistance && !lineBlocked(from, wizard.pos, rules.map.obstacles)) {
      best = wizard;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Una bestia que le hace la guerra al equipo de este mago: persigue a uno de los suyos (un mago
 * o una invocación) o pelea domada por un rival. A las bestias tranquilas no se las toca, para
 * no despertar un campamento sin querer.
 */
function isHostileBeast(state: MatchState, beast: Beast, owner: Wizard): boolean {
  if (beast.hp <= 0) return false;
  if (beast.tamedBy !== null) {
    const tamer = wizardById(state, beast.tamedBy);
    return tamer !== undefined && tamer.team !== owner.team;
  }
  if (beast.aggroTicks <= 0) return false;
  const hunted = wizardById(state, beast.targetId) ?? summonById(state, beast.targetId);
  return hunted !== undefined && hunted.team === owner.team;
}

/**
 * Lo más cercano que una invocación debe atacar: un rival a la vista o una bestia que va contra
 * su equipo.
 */
export function nearestFoe(
  state: MatchState,
  owner: Wizard,
  from: Vec2,
  range: number,
  rules: GameRules,
): SpellTarget | undefined {
  const wizard = nearestVisibleEnemy(state, owner, from, range, rules);
  let best: SpellTarget | undefined = wizard ? { kind: 'wizard', wizard } : undefined;
  let bestDistance = wizard ? distance(wizard.pos, from) : range;
  for (const beast of state.beasts) {
    if (!isHostileBeast(state, beast, owner)) continue;
    const d = distance(beast.pos, from);
    if (d < bestDistance && !lineBlocked(from, beast.pos, rules.map.obstacles)) {
      best = { kind: 'beast', beast };
      bestDistance = d;
    }
  }
  return best;
}

/** Radio de lo que una invocación tiene al frente, para saber si ya lo alcanza. */
export function foeRadius(foe: SpellTarget, rules: GameRules): number {
  return foe.kind === 'wizard' ? rules.wizard.radius : beastStats(foe.beast, rules).radius;
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
  const prey = nearestFoe(state, owner, wisp.pos, spell.seekRange, rules);
  if (!prey) return true;
  const at = targetPos(prey);
  if (distance(at, wisp.pos) <= wisp.radius + foeRadius(prey, rules)) {
    state.events.push({ type: 'burst', spell: 'wisp', pos: wisp.pos, radius: 1.2 });
    hitTarget(state, wisp.ownerId, prey, wisp.payload, rules);
    return false;
  }
  // Flota por encima de árboles y rocas: no rodea, va directo.
  const step = scale(normalize(sub(at, wisp.pos)), spell.speed / TICK_RATE);
  wisp.pos = add(wisp.pos, step);
  wisp.facing = normalize(step, wisp.facing);
  return true;
}

/** Pararrayos: cada tanto, un rayo al rival más cercano que tenga a la vista. */
function updateLightningRod(state: MatchState, rod: Summon, owner: Wizard, rules: GameRules): void {
  if (--rod.cooldown > 0) return;
  const spell = rules.spells.lightningRod;
  const prey = nearestFoe(state, owner, rod.pos, spell.range, rules);
  if (!prey) {
    rod.cooldown = 1;
    return;
  }
  rod.cooldown = spell.intervalTicks;
  state.events.push({ type: 'zap', from: rod.pos, to: targetPos(prey) });
  hitTarget(state, rod.ownerId, prey, rod.payload, rules);
}

/**
 * Guardián de musgo: sigue a quien lo invocó y pega al rival o a la bestia que se acerque. La
 * bestia que golpea se enoja con él y deja en paz a su dueño.
 */
function updateMossGuardian(
  state: MatchState,
  guardian: Summon,
  owner: Wizard,
  rules: GameRules,
): void {
  const spell = rules.spells.mossGuardian;
  if (guardian.cooldown > 0) guardian.cooldown--;
  const prey = nearestFoe(state, owner, guardian.pos, spell.aggroRange, rules);
  if (prey) {
    const at = targetPos(prey);
    const d = distance(at, guardian.pos);
    if (d <= spell.attackRange + foeRadius(prey, rules) - rules.wizard.radius) {
      guardian.facing = normalize(sub(at, guardian.pos), guardian.facing);
      if (guardian.cooldown === 0) {
        guardian.cooldown = spell.attackCooldownTicks;
        state.events.push({ type: 'burst', spell: 'mossGuardian', pos: at, radius: 0.8 });
        if (prey.kind === 'beast') {
          damageBeast(state, prey.beast, guardian.id, guardian.payload.damage, rules);
        } else {
          applyHit(state, prey.wizard, guardian.ownerId, guardian.payload, rules);
        }
      }
      return;
    }
    move(guardian, sub(at, guardian.pos), spell.speed, rules);
    return;
  }
  if (distance(owner.pos, guardian.pos) > spell.followDistance) {
    move(guardian, sub(owner.pos, guardian.pos), spell.speed, rules);
  }
}
