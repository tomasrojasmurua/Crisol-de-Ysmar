import { applyHit, applyStatus, dealDamage } from '../../combat/hit';
import { canAct } from '../../combat/statuses';
import { beastStats, damageBeast } from '../../match/beasts';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFrom, wizardById } from '../../match/queries';
import type {
  Drown,
  FireRain,
  MatchState,
  Portal,
  Pyre,
  Strike,
  Sweeper,
  Tempest,
  ThornRing,
  Trap,
  Wizard,
} from '../../match/state';
import {
  add,
  distance,
  distanceToSegment,
  length,
  normalize,
  perpendicular,
  scale,
  type Vec2,
} from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import { scorch } from './context';
import { hitArea } from './shared';
import { damageSummon } from './summons';

/** Por los aires o congelado: lo que estaba tejiendo o saltando se pierde. */
function interrupt(wizard: Wizard): void {
  wizard.channel = null;
  wizard.leap = null;
}

/**
 * Un golpe con aviso: espera y cae sobre todo lo que siga dentro. Según el hechizo, además
 * levanta por los aires, congela, silencia o deja el suelo ardiendo.
 */
export function updateStrike(state: MatchState, strike: Strike, rules: GameRules): boolean {
  if (--strike.ticksLeft > 0) return true;
  const spell = strike.payload.spell;
  const line = strike.line;
  const end = line ? add(strike.pos, scale(line.dir, line.length)) : strike.pos;
  const touches = (pos: Vec2, reach: number): boolean =>
    line
      ? distanceToSegment(pos, strike.pos, end) <= strike.radius + reach
      : distance(pos, strike.pos) <= strike.radius + reach;
  if (line) {
    state.events.push({ type: 'line', spell, from: strike.pos, to: end, halfWidth: strike.radius });
  } else {
    state.events.push({ type: 'burst', spell, pos: strike.pos, radius: strike.radius });
  }
  for (const wizard of state.wizards) {
    if (wizard.team === strike.team || wizard.hp <= 0 || wizard.statuses.stasis) continue;
    if (!touches(wizard.pos, rules.wizard.radius)) continue;
    applyHit(state, wizard, strike.ownerId, strike.payload, rules);
    if (strike.effect === 'lift') {
      applyStatus(state, wizard, 'airborne', strike.ownerId, rules);
      interrupt(wizard);
    } else if (strike.effect === 'freeze') {
      applyStatus(state, wizard, 'frozen', strike.ownerId, rules);
      interrupt(wizard);
    } else if (strike.effect === 'silence') {
      const ticks = rules.spells.abyss.silenceTicks;
      applyStatus(state, wizard, 'silenced', strike.ownerId, rules, ticks);
      wizard.channel = null;
      wizard.weave = [];
    }
  }
  for (const beast of state.beasts) {
    if (touches(beast.pos, beastStats(beast, rules).radius)) {
      damageBeast(state, beast, strike.ownerId, strike.payload.damage, rules);
    }
  }
  for (const summon of state.spells) {
    if (summon.kind !== 'summon' || summon.team === strike.team) continue;
    if (touches(summon.pos, summon.radius)) damageSummon(state, summon, strike.payload.damage);
  }
  if (strike.effect === 'scorch') {
    const meteor = rules.spells.meteor;
    scorch(state, strike.ownerId, strike.team, strike.pos, meteor.scorchRadius, meteor.scorchTicks);
  }
  return false;
}

/** Lo que avanza solo: el Huracán, el Orbe errático y el Maremoto. */
export function updateSweeper(state: MatchState, sweeper: Sweeper, rules: GameRules): boolean {
  const step = scale(sweeper.velocity, 1 / TICK_RATE);
  sweeper.pos = add(sweeper.pos, step);
  sweeper.travelled += length(step);
  if (sweeper.mode === 'orb') {
    zapAround(state, sweeper, rules);
  } else {
    sweep(state, sweeper, rules);
  }
  // El Ave de ceniza da la vuelta a mitad de camino y puede volver a quemar a los mismos.
  if (sweeper.mode === 'bird' && !sweeper.returning && sweeper.travelled >= sweeper.maxRange / 2) {
    sweeper.returning = true;
    sweeper.velocity = scale(sweeper.velocity, -1);
    sweeper.struck.length = 0;
  }
  return sweeper.travelled < sweeper.maxRange && length(sweeper.pos) <= rules.arenaRadius + 1;
}

/** El Huracán y el Maremoto golpean una sola vez a cada uno que tocan. */
function sweep(state: MatchState, sweeper: Sweeper, rules: GameRules): void {
  const side = scale(perpendicular(normalize(sweeper.velocity)), sweeper.halfWidth);
  const a = add(sweeper.pos, scale(side, -1));
  const b = add(sweeper.pos, side);
  const touches = (pos: Vec2, reach: number): boolean =>
    distanceToSegment(pos, a, b) <= sweeper.radius + reach;
  const soulTide = sweeper.mode === 'soulTide';
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.id === sweeper.ownerId) continue;
    // La Marea de almas cruza a todos, aliados también; lo demás solo toca rivales.
    if (wizard.team === sweeper.team && !soulTide) continue;
    if (sweeper.struck.includes(wizard.id) || !touches(wizard.pos, rules.wizard.radius)) continue;
    sweeper.struck.push(wizard.id);
    if (soulTide) {
      const owner = wizardById(state, sweeper.ownerId);
      if (owner && owner.hp > 0) {
        owner.hp = Math.min(owner.maxHp, owner.hp + rules.spells.soulTide.heal);
      }
    }
    if (wizard.statuses.stasis || soulTide) continue;
    applyHit(state, wizard, sweeper.ownerId, sweeper.payload, rules);
    if (sweeper.mode === 'tornado') {
      applyStatus(state, wizard, 'airborne', sweeper.ownerId, rules);
      interrupt(wizard);
    } else if (sweeper.mode === 'wave') {
      applyStatus(state, wizard, 'soaked', sweeper.ownerId, rules);
    } else if (sweeper.mode === 'stampede') {
      applyStatus(state, wizard, 'root', sweeper.ownerId, rules, rules.spells.rootPack.rootTicks);
      wizard.leap = null;
    }
    state.events.push({
      type: 'burst',
      spell: sweeper.payload.spell,
      pos: wizard.pos,
      radius: 1,
    });
  }
  for (const beast of soulTide ? [] : state.beasts) {
    if (sweeper.struck.includes(beast.id)) continue;
    if (!touches(beast.pos, beastStats(beast, rules).radius)) continue;
    sweeper.struck.push(beast.id);
    damageBeast(state, beast, sweeper.ownerId, sweeper.payload.damage, rules);
  }
}

/** El Orbe errático: cada tanto, un rayo a cada rival y bestia cerca, a la vista. */
function zapAround(state: MatchState, orb: Sweeper, rules: GameRules): void {
  if (--orb.cooldown > 0) return;
  const spell = rules.spells.erraticOrb;
  orb.cooldown = spell.intervalTicks;
  const owner = wizardById(state, orb.ownerId);
  const seen = (pos: Vec2): boolean => !lineBlocked(orb.pos, pos, rules.map.obstacles);
  for (const wizard of state.wizards) {
    if (wizard.team === orb.team || wizard.hp <= 0) continue;
    if (owner && isHiddenFrom(wizard, owner, rules)) continue;
    if (distance(wizard.pos, orb.pos) > spell.zapRange || !seen(wizard.pos)) continue;
    state.events.push({ type: 'zap', from: orb.pos, to: wizard.pos });
    applyHit(state, wizard, orb.ownerId, orb.payload, rules);
  }
  for (const beast of state.beasts) {
    if (distance(beast.pos, orb.pos) > spell.zapRange || !seen(beast.pos)) continue;
    state.events.push({ type: 'zap', from: orb.pos, to: beast.pos });
    damageBeast(state, beast, orb.ownerId, orb.payload.damage, rules);
  }
}

/** Pira de almas: a su tiempo, el marcado arde más cuanto más herido esté. */
export function updatePyre(state: MatchState, pyre: Pyre, rules: GameRules): boolean {
  const target = wizardById(state, pyre.targetId);
  if (!target || target.hp <= 0) return false;
  if (--pyre.ticksLeft > 0) return true;
  const missing = target.maxHp - target.hp;
  const amount = pyre.payload.damage + missing * rules.spells.soulPyre.missingFraction;
  state.events.push({ type: 'burst', spell: 'soulPyre', pos: target.pos, radius: 1.4 });
  dealDamage(state, target, pyre.ownerId, amount, pyre.payload.form);
  return false;
}

/** Ahogo: si el rival no sale del alcance ni se esconde tras un árbol, lo silencia y lo daña. */
export function updateDrown(state: MatchState, drown: Drown, rules: GameRules): boolean {
  const caster = wizardById(state, drown.ownerId);
  const target = wizardById(state, drown.targetId);
  if (!caster || !target || caster.hp <= 0 || target.hp <= 0 || target.statuses.stasis) {
    return false;
  }
  const spell = rules.spells.drown;
  if (distance(caster.pos, target.pos) > spell.breakRange) return false;
  if (lineBlocked(caster.pos, target.pos, rules.map.obstacles)) return false;
  if (--drown.ticksLeft > 0) return true;
  state.events.push({ type: 'burst', spell: 'drown', pos: target.pos, radius: 1.2 });
  applyHit(state, target, drown.ownerId, drown.payload, rules);
  applyStatus(state, target, 'silenced', drown.ownerId, rules, spell.silenceTicks);
  target.channel = null;
  target.weave = [];
  return false;
}

/** Lluvia de fuego: cada tanto cae fuego sobre los rivales cercanos que se están moviendo. */
export function updateFireRain(state: MatchState, rain: FireRain, rules: GameRules): boolean {
  const owner = wizardById(state, rain.ownerId);
  if (!owner || owner.hp <= 0) return false;
  if (--rain.cooldown <= 0) {
    const spell = rules.spells.fireRain;
    rain.cooldown = spell.intervalTicks;
    for (const wizard of state.wizards) {
      if (wizard.team === rain.team || wizard.hp <= 0) continue;
      if (distance(wizard.pos, owner.pos) > spell.radius) continue;
      // Quedarse quieto lo salva.
      const moving = wizard.leap !== null || length(wizard.moveInput) > 0.1;
      if (!moving) continue;
      state.events.push({ type: 'burst', spell: 'fireRain', pos: wizard.pos, radius: 0.9 });
      applyHit(state, wizard, rain.ownerId, rain.payload, rules);
      scorch(state, rain.ownerId, rain.team, wizard.pos, spell.scorchRadius, spell.scorchTicks);
    }
  }
  return --rain.ticksLeft > 0;
}

/** Destella a quien lanzó la Tempestad y descarga donde llega. */
export function tempestJump(
  state: MatchState,
  tempest: Tempest,
  wizard: Wizard,
  dir: Vec2,
  rules: GameRules,
): void {
  const spell = rules.spells.tempest;
  const from = wizard.pos;
  wizard.pos = placeInArena(add(from, scale(dir, spell.distance)), rules.wizard.radius, rules);
  wizard.leap = null;
  wizard.facing = dir;
  state.events.push({ type: 'blink', spell: 'tempest', wizardId: wizard.id, from, to: wizard.pos });
  hitArea(
    state,
    wizard.id,
    wizard.team,
    wizard.pos,
    spell.radius,
    tempest.payload,
    'tempest',
    rules,
  );
}

/** Tempestad: los destellos que quedan salen solos, hacia donde mueves al mago. */
export function updateTempest(state: MatchState, tempest: Tempest, rules: GameRules): boolean {
  const owner = wizardById(state, tempest.ownerId);
  if (!owner || owner.hp <= 0 || !canAct(owner)) return false;
  if (--tempest.ticksToNext > 0) return true;
  tempestJump(state, tempest, owner, normalize(owner.moveInput, owner.facing), rules);
  tempest.jumpsLeft--;
  tempest.ticksToNext = rules.spells.tempest.intervalTicks;
  return tempest.jumpsLeft > 0;
}

/** Portal: quien pisa una boca sale por la otra; para volver a cruzar, tiene que salir antes. */
export function updatePortal(state: MatchState, portal: Portal, rules: GameRules): boolean {
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.leap) continue;
    const inA = distance(wizard.pos, portal.a) <= portal.radius;
    const inB = distance(wizard.pos, portal.b) <= portal.radius;
    const waiting = portal.inside.includes(wizard.id);
    if (!inA && !inB) {
      if (waiting) portal.inside = portal.inside.filter((id) => id !== wizard.id);
      continue;
    }
    if (waiting || !canAct(wizard)) continue;
    const from = wizard.pos;
    wizard.pos = placeInArena(inA ? portal.b : portal.a, rules.wizard.radius, rules);
    portal.inside.push(wizard.id);
    state.events.push({
      type: 'blink',
      spell: 'portal',
      wizardId: wizard.id,
      from,
      to: wizard.pos,
    });
  }
  return --portal.ticksLeft > 0;
}

/** Anillo de zarzas: las espinas queman a los rivales que se apoyan en ellas. */
export function updateThornRing(state: MatchState, ring: ThornRing, rules: GameRules): boolean {
  for (const wizard of state.wizards) {
    if (wizard.team === ring.team || wizard.hp <= 0) continue;
    const fromEdge = Math.abs(distance(wizard.pos, ring.pos) - ring.radius);
    if (fromEdge <= rules.wizard.radius + 0.15) {
      applyStatus(state, wizard, 'burn', ring.ownerId, rules);
    }
  }
  return --ring.ticksLeft > 0;
}

/** Una trampa de la Siembra salta con el primer rival que la pisa; una flor del Jardín cura. */
export function updateTrap(state: MatchState, trap: Trap, rules: GameRules): boolean {
  if (trap.armTicks > 0) {
    trap.armTicks--;
    return --trap.ticksLeft > 0;
  }
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.leap) continue;
    if (distance(wizard.pos, trap.pos) > trap.radius + rules.wizard.radius) continue;
    if (trap.friendly) {
      // Una flor del Jardín: solo la usa un aliado herido.
      if (wizard.team !== trap.team || wizard.hp >= wizard.maxHp) continue;
      wizard.hp = Math.min(wizard.maxHp, wizard.hp + trap.payload.damage);
      state.events.push({ type: 'burst', spell: 'garden', pos: trap.pos, radius: 0.8 });
      return false;
    }
    if (wizard.team === trap.team) continue;
    state.events.push({ type: 'burst', spell: 'sowing', pos: trap.pos, radius: 1 });
    applyHit(state, wizard, trap.ownerId, trap.payload, rules);
    applyStatus(state, wizard, 'root', trap.ownerId, rules);
    return false;
  }
  return --trap.ticksLeft > 0;
}
