import { applyHit, applyStatus, dealDamage } from '../../combat/hit';
import { canAct } from '../../combat/statuses';
import { obstacleAt, placeInArena } from '../../match/obstacles';
import { isAlive, isHiddenFrom, wizardById } from '../../match/queries';
import { withRng } from '../../match/random';
import type {
  Bond,
  Boon,
  Deferred,
  EntityId,
  Field,
  GuidedBolt,
  MatchState,
  Projectile,
  Stepper,
  Wizard,
} from '../../match/state';
import {
  add,
  distance,
  distanceToSegment,
  dot,
  length,
  normalize,
  scale,
  sub,
  type Vec2,
} from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import type { Weave } from '../../weaving/weave';
import { hitArea } from './shared';
import { damageSummon, enemySummonAt } from './summons';

/** Avanza lo que la cuarta tanda dejó en el campo; devuelve false cuando se acaba. */
export function updateField(state: MatchState, field: Field, rules: GameRules): boolean {
  // Un detonador que ya estalló, o algo que se apagó por otro hechizo.
  if (field.ticksLeft <= 0) return false;
  switch (field.mode) {
    case 'volcano':
      throwRocks(state, field, rules);
      break;
    case 'monsoon':
      stormBolts(state, field, rules);
      break;
    case 'smoke':
      // Nadie ve a través del humo: quien está adentro no ve afuera ni lo ven desde afuera.
      for (const wizard of inside(state, field, rules)) {
        applyStatus(state, wizard, 'shrouded', field.ownerId, rules);
        applyStatus(state, wizard, 'blind', field.ownerId, rules, 6);
      }
      break;
    case 'bonfire':
      for (const wizard of inside(state, field, rules)) {
        if (wizard.team === field.team) applyStatus(state, wizard, 'kindled', field.ownerId, rules);
      }
      break;
    case 'wither':
      for (const wizard of inside(state, field, rules)) {
        if (wizard.team !== field.team)
          applyStatus(state, wizard, 'withered', field.ownerId, rules);
      }
      break;
    case 'deluge':
      for (const wizard of inside(state, field, rules)) {
        applyStatus(state, wizard, 'grounded', field.ownerId, rules);
        wizard.leap = null;
      }
      break;
    case 'growth':
      speedUp(state, field, rules);
      break;
    case 'iceTrack':
      slide(state, field, rules);
      break;
    case 'zipline':
      ride(state, field, rules);
      break;
    case 'lilyPads':
      hopPads(state, field, rules);
      break;
    case 'totems':
      shockLines(state, field, rules);
      break;
    case 'mandrake':
      if (field.cooldown > 0) {
        field.cooldown--;
        break;
      }
      if (scream(state, field, rules)) return false;
      break;
    case 'pollen':
    case 'solarOrb':
    case 'shadowMark':
      break;
  }
  return --field.ticksLeft > 0;
}

/** Los magos vivos y en el suelo dentro de un círculo. */
function inside(state: MatchState, field: Field, rules: GameRules): Wizard[] {
  return state.wizards.filter(
    (w) => w.hp > 0 && distance(w.pos, field.pos) <= field.radius + rules.wizard.radius,
  );
}

/** Erupción: cada tanto, una roca ardiente cae en un punto al azar alrededor del volcán. */
function throwRocks(state: MatchState, field: Field, rules: GameRules): void {
  if (--field.cooldown > 0) return;
  const spell = rules.spells.eruption;
  field.cooldown = spell.intervalTicks;
  const at = withRng(state, (rng) => {
    const angle = rng.next() * Math.PI * 2;
    const d = field.radius + 0.8 + rng.next() * (spell.throwRadius - field.radius);
    return add(field.pos, { x: Math.cos(angle) * d, z: Math.sin(angle) * d });
  });
  state.spells.push({
    kind: 'strike',
    id: state.nextEntityId++,
    ownerId: field.ownerId,
    team: field.team,
    pos: at,
    radius: spell.rockRadius,
    line: null,
    delayTicks: spell.rockDelayTicks,
    ticksLeft: spell.rockDelayTicks,
    effect: null,
    payload: field.payload,
  });
}

/** Monzón: cada tanto, un rayo a cada rival dentro de la tormenta. */
function stormBolts(state: MatchState, field: Field, rules: GameRules): void {
  if (--field.cooldown > 0) return;
  field.cooldown = rules.spells.monsoon.intervalTicks;
  for (const wizard of inside(state, field, rules)) {
    if (wizard.team === field.team) continue;
    state.events.push({ type: 'zap', from: add(wizard.pos, { x: 0.3, z: 0.3 }), to: wizard.pos });
    applyHit(state, wizard, field.ownerId, field.payload, rules);
  }
}

/** Crecimiento acelerado: tu equipo teje y corre más rápido; tus invocaciones atacan antes. */
function speedUp(state: MatchState, field: Field, rules: GameRules): void {
  for (const wizard of inside(state, field, rules)) {
    if (wizard.team !== field.team) continue;
    applyStatus(state, wizard, 'quickened', field.ownerId, rules);
    applyStatus(state, wizard, 'haste', field.ownerId, rules);
  }
  for (const s of state.spells) {
    if (s.kind !== 'summon' || s.team !== field.team || s.cooldown <= 1) continue;
    if (distance(s.pos, field.pos) <= field.radius) s.cooldown--;
  }
}

/** Los extremos de un camino o un cable. */
function ends(field: Field): [Vec2, Vec2] {
  return [field.points[0] ?? field.pos, field.points[1] ?? field.pos];
}

/** Hacia dónde va quien entra a una línea: según hacia dónde camina, o al extremo más lejano. */
function travelDir(wizard: Wizard, a: Vec2, b: Vec2): Vec2 {
  const along = normalize(sub(b, a));
  const going = length(wizard.moveInput) > 0.2 ? wizard.moveInput : wizard.facing;
  const forward = dot(going, along);
  if (Math.abs(forward) > 0.1) return forward > 0 ? along : scale(along, -1);
  return distance(wizard.pos, b) >= distance(wizard.pos, a) ? along : scale(along, -1);
}

/** Lanza a un mago por una línea hasta su extremo. */
function launchAlong(wizard: Wizard, a: Vec2, b: Vec2, speed: number): void {
  const dir = travelDir(wizard, a, b);
  const end = dot(dir, sub(b, a)) > 0 ? b : a;
  const remaining = Math.max(0, dot(sub(end, wizard.pos), dir));
  const ticks = Math.max(1, Math.round((remaining / speed) * TICK_RATE));
  wizard.leap = { ticksLeft: ticks, step: scale(dir, speed / TICK_RATE), trail: null };
}

/** Pista de hielo: quien la pisa se desliza recto hasta el final, sin poder girar. */
function slide(state: MatchState, field: Field, rules: GameRules): void {
  const [a, b] = ends(field);
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0) continue;
    const on = distanceToSegment(wizard.pos, a, b) <= field.radius + rules.wizard.radius;
    const was = field.inside.includes(wizard.id);
    if (!on) {
      if (was) field.inside = field.inside.filter((id) => id !== wizard.id);
      continue;
    }
    if (was || wizard.leap || wizard.statuses.deepRooted || wizard.statuses.magma) continue;
    launchAlong(wizard, a, b, rules.spells.iceTrack.slideSpeed);
    field.inside.push(wizard.id);
  }
}

/** Tirolesa: quien de tu equipo toca el cable viaja rápido hasta el otro extremo. */
function ride(state: MatchState, field: Field, rules: GameRules): void {
  const [a, b] = ends(field);
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.team !== field.team) continue;
    const on = distanceToSegment(wizard.pos, a, b) <= field.radius + rules.wizard.radius;
    const was = field.inside.includes(wizard.id);
    if (!on) {
      if (was) field.inside = field.inside.filter((id) => id !== wizard.id);
      continue;
    }
    if (was || wizard.leap || !canAct(wizard) || wizard.statuses.grounded) continue;
    launchAlong(wizard, a, b, rules.spells.zipline.speed);
    field.inside.push(wizard.id);
  }
}

/** Nenúfares: quien de tu equipo pisa una hoja salta a la otra que tenga más adelante. */
function hopPads(state: MatchState, field: Field, rules: GameRules): void {
  const pads = field.points;
  const reach = field.radius + rules.wizard.radius;
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.team !== field.team) continue;
    const on = pads.findIndex((p) => distance(wizard.pos, p) <= reach);
    const was = field.inside.includes(wizard.id);
    if (on < 0) {
      if (was) field.inside = field.inside.filter((id) => id !== wizard.id);
      continue;
    }
    if (was || wizard.leap || !canAct(wizard) || wizard.statuses.grounded) continue;
    const from = pads[on] ?? wizard.pos;
    const going = normalize(wizard.moveInput, wizard.facing);
    let best = (on + 2) % pads.length;
    let bestAlignment = -2;
    pads.forEach((p, i) => {
      if (i === on) return;
      const alignment = dot(normalize(sub(p, from)), going);
      if (alignment > bestAlignment) {
        best = i;
        bestAlignment = alignment;
      }
    });
    const to = pads[best] ?? from;
    const start = wizard.pos;
    wizard.pos = placeInArena(to, rules.wizard.radius, rules);
    field.inside.push(wizard.id);
    state.events.push({
      type: 'blink',
      spell: 'lilyPads',
      wizardId: wizard.id,
      from: start,
      to: wizard.pos,
    });
  }
}

/** Círculo de tótems: quien cruza una línea de rayo queda aturdido una vez por cruce. */
function shockLines(state: MatchState, field: Field, rules: GameRules): void {
  const pts = field.points;
  const spell = rules.spells.totemCircle;
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.team === field.team) continue;
    let touching = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue;
      if (distanceToSegment(wizard.pos, a, b) <= field.radius + rules.wizard.radius) {
        touching = true;
        break;
      }
    }
    const was = field.inside.includes(wizard.id);
    if (!touching) {
      if (was) field.inside = field.inside.filter((id) => id !== wizard.id);
      continue;
    }
    if (was || wizard.leap) continue;
    field.inside.push(wizard.id);
    applyStatus(state, wizard, 'stunned', field.ownerId, rules, spell.stunTicks);
    wizard.channel = null;
    state.events.push({ type: 'burst', spell: 'totemCircle', pos: wizard.pos, radius: 0.8 });
  }
}

/** Mandrágora: grita con el primer rival que la pisa; lo silencia y lo deja a la vista. */
function scream(state: MatchState, field: Field, rules: GameRules): boolean {
  const victim = state.wizards.find(
    (w) =>
      w.hp > 0 &&
      w.team !== field.team &&
      !w.leap &&
      distance(w.pos, field.pos) <= field.radius + rules.wizard.radius,
  );
  if (!victim) return false;
  const spell = rules.spells.mandrake;
  applyStatus(state, victim, 'silenced', field.ownerId, rules, spell.silenceTicks);
  applyStatus(state, victim, 'tracked', field.ownerId, rules);
  victim.weave = [];
  victim.channel = null;
  state.events.push({ type: 'burst', spell: 'mandrake', pos: field.pos, radius: 2 });
  return true;
}

// Detonadores.

/** La Granada solar estalla. */
export function detonateOrb(state: MatchState, orb: Field, rules: GameRules): void {
  if (orb.ticksLeft <= 0) return;
  orb.ticksLeft = 0;
  const radius = orb.payload.blastRadius || rules.spells.solarGrenade.blastRadius;
  hitArea(state, orb.ownerId, orb.team, orb.pos, radius, orb.payload, 'solarGrenade', rules);
}

/**
 * Lo que dispara un hechizo al pasar: tu Granada solar estalla si la toca un hechizo tuyo,
 * y el Polen explota si lo toca cualquier hechizo con Brasa.
 */
export function touchTriggers(
  state: MatchState,
  team: number,
  pos: Vec2,
  radius: number,
  weave: Weave,
  rules: GameRules,
): void {
  for (const s of state.spells) {
    if (s.kind !== 'field' || s.ticksLeft <= 0) continue;
    if (distance(pos, s.pos) > radius + s.radius) continue;
    if (s.mode === 'solarOrb' && s.team === team) {
      detonateOrb(state, s, rules);
    } else if (s.mode === 'pollen' && weave.includes('brasa')) {
      s.ticksLeft = 0;
      hitArea(state, s.ownerId, s.team, s.pos, s.radius, s.payload, 'pollen', rules);
    }
  }
}

// Lo que se mueve.

/** Relámpago guiado: avanza hacia donde lo lleva el pulgar de moverte de quien lo lanzó. */
export function updateGuidedBolt(state: MatchState, bolt: GuidedBolt, rules: GameRules): boolean {
  const owner = wizardById(state, bolt.ownerId);
  const spell = rules.spells.guidedBolt;
  const done = (): false => {
    if (owner) delete owner.statuses.steering;
    return false;
  };
  if (!owner || owner.hp <= 0) return done();
  const input = owner.moveInput;
  if (owner.statuses.steering && length(input) > 0.2) {
    const wanted = normalize(input);
    bolt.dir = normalize(add(bolt.dir, scale(sub(wanted, bolt.dir), spell.turnRate)), bolt.dir);
  }
  bolt.pos = add(bolt.pos, scale(bolt.dir, spell.speed / TICK_RATE));
  touchTriggers(state, bolt.team, bolt.pos, spell.radius, bolt.payload.weave, rules);
  for (const wizard of state.wizards) {
    if (wizard.team === bolt.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, bolt.pos) <= spell.radius + rules.wizard.radius) {
      state.events.push({ type: 'burst', spell: 'guidedBolt', pos: bolt.pos, radius: 1.2 });
      applyHit(state, wizard, bolt.ownerId, bolt.payload, rules);
      return done();
    }
  }
  const blocker = enemySummonAt(state, bolt.team, bolt.pos, spell.radius);
  if (blocker) {
    damageSummon(state, blocker, bolt.payload.damage);
    return done();
  }
  if (
    obstacleAt(bolt.pos, spell.radius, rules.map.obstacles) ||
    length(bolt.pos) > rules.arenaRadius
  ) {
    state.events.push({ type: 'blocked', pos: bolt.pos });
    return done();
  }
  return --bolt.ticksLeft > 0 ? true : done();
}

/** Mil pasos: salta junto al rival más cercano que aún no golpeó y le pega. */
export function updateStepper(state: MatchState, stepper: Stepper, rules: GameRules): boolean {
  const owner = wizardById(state, stepper.ownerId);
  if (!owner || owner.hp <= 0 || !canAct(owner)) return false;
  if (--stepper.ticksToNext > 0) return true;
  const range = rules.spells.thousandSteps.range;
  const prey = state.wizards
    .filter(
      (w) =>
        w.team !== owner.team &&
        isAlive(w) &&
        !stepper.struck.includes(w.id) &&
        !isHiddenFrom(w, owner, rules) &&
        distance(w.pos, owner.pos) <= range,
    )
    .sort((a, b) => distance(a.pos, owner.pos) - distance(b.pos, owner.pos))[0];
  if (!prey) return false;
  const from = owner.pos;
  const back = normalize(sub(owner.pos, prey.pos), scale(prey.facing, -1));
  owner.pos = placeInArena(add(prey.pos, scale(back, 1.2)), rules.wizard.radius, rules);
  owner.facing = normalize(sub(prey.pos, owner.pos), owner.facing);
  owner.leap = null;
  state.events.push({
    type: 'blink',
    spell: 'thousandSteps',
    wizardId: owner.id,
    from,
    to: owner.pos,
  });
  applyHit(state, prey, owner.id, stepper.payload, rules);
  stepper.struck.push(prey.id);
  stepper.hopsLeft--;
  stepper.ticksToNext = rules.spells.thousandSteps.intervalTicks;
  // Con un solo rival, vuelve a pegarle en cada salto.
  if (
    state.wizards.filter((w) => w.team !== owner.team && isAlive(w)).length <= stepper.struck.length
  ) {
    stepper.struck.length = 0;
  }
  return stepper.hopsLeft > 0;
}

/** Profundidad: un pedazo del golpe guardado llega en cada paso. */
export function updateDeferred(state: MatchState, deferred: Deferred): boolean {
  const target = wizardById(state, deferred.targetId);
  if (!target || target.hp <= 0) return false;
  dealDamage(state, target, deferred.ownerId, deferred.perTick, 'mark', true, true);
  return --deferred.ticksLeft > 0;
}

/** Rayo de enlace: si los unidos se separan demasiado, los rivales quedan aturdidos. */
export function updateBond(state: MatchState, bond: Bond, rules: GameRules): boolean {
  const a = wizardById(state, bond.aId);
  const b = wizardById(state, bond.bId);
  if (!a || !b || a.hp <= 0 || b.hp <= 0) return false;
  const spell = rules.spells.linkBolt;
  if (distance(a.pos, b.pos) > spell.maxGap) {
    for (const w of [a, b]) {
      if (w.team === bond.team) continue;
      applyStatus(state, w, 'stunned', bond.ownerId, rules, spell.stunTicks);
      w.channel = null;
      w.leap = null;
      state.events.push({ type: 'burst', spell: 'linkBolt', pos: w.pos, radius: 1 });
    }
    return false;
  }
  return --bond.ticksLeft > 0;
}

/** Fertilizar: al acabarse, las invocaciones vuelven a pegar como antes. */
export function updateBoon(state: MatchState, boon: Boon): boolean {
  if (--boon.ticksLeft > 0) return true;
  for (const { id, damage } of boon.summons) {
    const s = state.spells.find((e) => e.kind === 'summon' && e.id === id);
    if (s?.kind === 'summon') s.payload = { ...s.payload, damage };
  }
  return false;
}

// Proyectiles.

/**
 * Llanto del abismo: un proyectil rival que entra al alcance queda flotando; cuando el llanto
 * termina, sale hacia donde mira quien lo retuvo, ya de su lado. Devuelve true si sigue flotando.
 */
export function holdProjectile(
  state: MatchState,
  projectile: Projectile,
  rules: GameRules,
): boolean {
  const held = projectile.held;
  if (held) {
    const holder = wizardById(state, held.byId);
    if (holder && holder.hp > 0 && holder.statuses.wailing) return true;
    projectile.held = null;
    if (!holder || holder.hp <= 0) return false;
    projectile.ownerId = holder.id;
    projectile.team = holder.team;
    projectile.velocity = scale(holder.facing, held.speed);
    projectile.travelled = 0;
    return false;
  }
  for (const wizard of state.wizards) {
    const wail = wizard.statuses.wailing;
    if (!wail || wizard.team === projectile.team || wizard.hp <= 0) continue;
    const reach = rules.statuses.wailing.radius;
    if (distance(wizard.pos, projectile.pos) > reach) continue;
    projectile.held = { byId: wizard.id, speed: length(projectile.velocity) };
    return true;
  }
  return false;
}

/** Pararrayos humano: los proyectiles rivales cercanos se tuercen hacia quien lo lleva. */
export function attractProjectile(
  state: MatchState,
  projectile: Projectile,
  rules: GameRules,
): void {
  const spec = rules.statuses.attracting;
  for (const wizard of state.wizards) {
    if (!wizard.statuses.attracting || wizard.team === projectile.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, projectile.pos) > spec.radius) continue;
    const speed = length(projectile.velocity);
    const current = normalize(projectile.velocity);
    const toward = normalize(sub(wizard.pos, projectile.pos), current);
    const dir = normalize(add(current, scale(sub(toward, current), spec.pull)), current);
    projectile.velocity = scale(dir, speed);
    return;
  }
}

/**
 * Lo que pasa cuando un proyectil toca a quien tiene un truco: con el Pararrayos humano se vuelve
 * escudo; con el Espejo de agua vuelve hacia quien lo lanzó. Null si el golpe sigue normal.
 */
export function catchProjectile(
  state: MatchState,
  projectile: Projectile,
  wizard: Wizard,
): 'absorbed' | 'returned' | null {
  if (wizard.statuses.attracting || wizard.statuses.mirroring) {
    state.events.push({ type: 'attacked', targetId: wizard.id, sourceId: projectile.ownerId });
  }
  if (wizard.statuses.attracting) {
    wizard.shield += projectile.payload.damage;
    state.events.push({ type: 'burst', spell: 'humanRod', pos: wizard.pos, radius: 1 });
    return 'absorbed';
  }
  if (wizard.statuses.mirroring) {
    const thrower = wizardById(state, projectile.ownerId);
    const speed = length(projectile.velocity);
    const back = thrower
      ? normalize(sub(thrower.pos, projectile.pos), scale(projectile.velocity, -1))
      : normalize(scale(projectile.velocity, -1));
    projectile.velocity = scale(back, speed);
    projectile.ownerId = wizard.id;
    projectile.team = wizard.team;
    projectile.travelled = 0;
    state.events.push({ type: 'blocked', pos: projectile.pos });
    return 'returned';
  }
  return null;
}

/** Sifón: si el proyectil acierta, roba una Esencia o, si el rival no tiene, descanso. */
export function siphonHit(
  state: MatchState,
  casterId: EntityId,
  victim: Wizard,
  rules: GameRules,
): void {
  const caster = wizardById(state, casterId);
  if (!caster || caster.hp <= 0 || victim.statuses.halted || victim.statuses.stasis) return;
  const elements = Object.keys(victim.essence) as (keyof Wizard['essence'])[];
  const richest = elements.reduce((a, b) => (victim.essence[b] > victim.essence[a] ? b : a));
  if (victim.essence[richest] > 0) {
    victim.essence[richest]--;
    caster.essence[richest] = Math.min(rules.beasts.maxEssence, caster.essence[richest] + 1);
  } else {
    const freshest = elements.reduce((a, b) => (victim.fatigue[b] < victim.fatigue[a] ? b : a));
    const tiredest = elements.reduce((a, b) => (caster.fatigue[b] > caster.fatigue[a] ? b : a));
    victim.fatigue[freshest] = Math.max(victim.fatigue[freshest], rules.weave.fatigueTicks);
    caster.fatigue[tiredest] = 0;
  }
  state.events.push({ type: 'zap', from: victim.pos, to: caster.pos });
}
