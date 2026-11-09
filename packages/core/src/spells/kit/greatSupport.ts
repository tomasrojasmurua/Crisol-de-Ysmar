import { applyHit, applyStatus, healWizard } from '../../combat/hit';
import { HARMFUL_STATUSES } from '../../combat/statuses';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isAlive, wizardById } from '../../match/queries';
import { standUp } from '../../match/round';
import type { Aura, Bubble, MatchState, Wizard } from '../../match/state';
import { add, clampToCircle, distance, dot, normalize, scale, sub } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import { launch } from './brasa';
import { type CastContext, nextId, payloadFor, placeZone } from './context';
import { sweeper } from './greatTormenta';
import { groundPoint, targetInCone } from './shared';

/** El aliado vivo más alineado con la puntería, a la vista; sin aliados, null. */
function allyInCone(ctx: CastContext, range: number, coneDot: number): Wizard | null {
  const { state, caster, rules } = ctx;
  let best: Wizard | null = null;
  let bestAlignment = coneDot;
  for (const ally of state.wizards) {
    if (ally.id === caster.id || ally.team !== caster.team || !isAlive(ally)) continue;
    const offset = sub(ally.pos, caster.pos);
    if (distance(ally.pos, caster.pos) > range) continue;
    if (lineBlocked(caster.pos, ally.pos, rules.map.obstacles)) continue;
    const alignment = dot(normalize(offset), ctx.aim);
    if (alignment >= bestAlignment) {
      best = ally;
      bestAlignment = alignment;
    }
  }
  return best;
}

/** El aliado vivo más cercano a cierto alcance, si no hay uno apuntado. */
function nearestAlly(ctx: CastContext, range: number): Wizard | null {
  const { state, caster } = ctx;
  let best: Wizard | null = null;
  let bestDistance = range;
  for (const ally of state.wizards) {
    if (ally.id === caster.id || ally.team !== caster.team || !isAlive(ally)) continue;
    const d = distance(ally.pos, caster.pos);
    if (d <= bestDistance) {
      best = ally;
      bestDistance = d;
    }
  }
  return best;
}

function fizzle(ctx: CastContext): void {
  ctx.state.events.push({ type: 'fizzle', wizardId: ctx.caster.id });
}

/** El rival apuntado; si no hay, el hechizo se pierde. */
function rivalInCone(ctx: CastContext, range: number, coneDot: number): Wizard | null {
  const target = targetInCone(ctx.state, ctx.caster, ctx.aim, range, coneDot, ctx.rules);
  if (target?.kind === 'wizard') return target.wizard;
  fizzle(ctx);
  return null;
}

// Apoyo.

/** Fuente termal: a tus pies, una fuente donde tú y tus aliados tejen más rápido. */
export function castHotSpring(ctx: CastContext): void {
  placeZone(ctx, 'hotSpring', ctx.rules.spells.hotSpring, ctx.caster.pos);
}

/** Viento de cola: tú y los aliados cerca tuyo corren más rápido. */
export function castTailwind(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.tailwind;
  for (const wizard of state.wizards) {
    if (wizard.team !== caster.team || !isAlive(wizard)) continue;
    if (distance(wizard.pos, caster.pos) > spell.radius) continue;
    applyStatus(state, wizard, 'haste', caster.id, rules, spell.hasteTicks);
  }
  state.events.push({ type: 'burst', spell: 'tailwind', pos: caster.pos, radius: spell.radius });
}

/** Burbuja: un escudo sobre el aliado apuntado o, si no hay, sobre ti. */
export function castBubble(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.bubble;
  const target = allyInCone(ctx, spell.range, spell.coneDot) ?? caster;
  state.spells = state.spells.filter((s) => !(s.kind === 'bubble' && s.targetId === target.id));
  target.shield = Math.max(target.shield, spell.shield);
  state.spells.push({
    kind: 'bubble',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    targetId: target.id,
    ticksLeft: spell.durationTicks,
  });
}

/** La Burbuja se deshace al acabarse el tiempo o al romperse. */
export function updateBubble(state: MatchState, bubble: Bubble): boolean {
  const target = wizardById(state, bubble.targetId);
  if (!target || target.hp <= 0 || target.shield <= 0) return false;
  if (--bubble.ticksLeft > 0) return true;
  // Si además lleva la Obsidiana, el escudo queda para ella.
  const armored = state.spells.some((s) => s.kind === 'obsidian' && s.ownerId === target.id);
  if (!armored) target.shield = 0;
  return false;
}

/** Agua de vida: levantas al instante al aliado caído más cercano. */
export function castLifeWater(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.lifeWater;
  let best: Wizard | null = null;
  let bestDistance = spell.range;
  for (const wizard of state.wizards) {
    if (wizard.team !== caster.team || wizard.id === caster.id || !wizard.fallen) continue;
    const d = distance(wizard.pos, caster.pos);
    if (d <= bestDistance) {
      best = wizard;
      bestDistance = d;
    }
  }
  if (!best) {
    fizzle(ctx);
    return;
  }
  standUp(best, best.maxHp * spell.hpFraction);
  best.pos = placeInArena(best.pos, rules.wizard.radius, rules);
  state.events.push({ type: 'revived', wizardId: best.id, byId: caster.id });
}

/** Lluvia de vida: sobre el aliado apuntado o sobre ti; cura y limpia estados. */
export function castHealingRain(ctx: CastContext): void {
  const spell = ctx.rules.spells.healingRain;
  const ally = allyInCone(ctx, spell.range, 0.7);
  placeZone(ctx, 'healingRain', spell, ally ? ally.pos : ctx.caster.pos);
}

/** Sacrificio: le pasas vida tuya a un aliado; nunca te deja en cero. */
export function castSacrifice(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.sacrifice;
  const ally = allyInCone(ctx, spell.range, 0.7) ?? nearestAlly(ctx, spell.range);
  const amount = ally ? Math.min(spell.amount, caster.hp - 1, ally.maxHp - ally.hp) : 0;
  if (!ally || amount <= 0) {
    fizzle(ctx);
    return;
  }
  caster.hp -= amount;
  healWizard(state, ally, amount);
  state.events.push({ type: 'zap', from: caster.pos, to: ally.pos });
  state.events.push({ type: 'burst', spell: 'sacrifice', pos: ally.pos, radius: 1 });
}

/** Jardín: flores a tu alrededor; cada una cura al primer aliado herido que la pisa. */
export function castGarden(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.garden;
  state.spells = state.spells.filter(
    (s) => !(s.kind === 'trap' && s.ownerId === caster.id && s.friendly),
  );
  const payload = { ...payloadFor(ctx, 0), damage: spell.heal };
  const forward = ctx.aim;
  const side = { x: -forward.z, z: forward.x };
  for (let i = 0; i < spell.count; i++) {
    const angle = (i / spell.count) * Math.PI * 2;
    const offset = add(
      scale(forward, Math.cos(angle) * spell.spread),
      scale(side, Math.sin(angle) * spell.spread),
    );
    state.spells.push({
      kind: 'trap',
      id: nextId(state),
      ownerId: caster.id,
      team: caster.team,
      pos: clampToCircle(add(caster.pos, offset), rules.arenaRadius - 1),
      radius: spell.radius,
      armTicks: 0,
      friendly: true,
      ticksLeft: spell.durationTicks,
      payload,
    });
  }
}

/** Vínculo vital: por un rato, lo que pegas cura lo mismo a tu aliado más cercano. */
export function castLifeLink(ctx: CastContext): void {
  applyStatus(ctx.state, ctx.caster, 'linked', ctx.caster.id, ctx.rules);
}

// Refuerzo.

/** Inmolación: ardes; quemas a quien esté cerca y te curas con ese daño. */
export function castImmolation(ctx: CastContext): void {
  const spell = ctx.rules.spells.immolation;
  const pulse = (spell.damagePerSecond * spell.intervalTicks) / TICK_RATE;
  aura(ctx, 'immolation', spell.radius, spell.durationTicks, spell.intervalTicks, pulse);
}

/** Ojo del huracán: por un rato, ni magos ni proyectiles rivales entran cerca tuyo. */
export function castStormEye(ctx: CastContext): void {
  const spell = ctx.rules.spells.stormEye;
  aura(ctx, 'stormEye', spell.radius, spell.durationTicks, 0, 0);
}

function aura(
  ctx: CastContext,
  mode: Aura['mode'],
  radius: number,
  durationTicks: number,
  cooldown: number,
  damage: number,
): void {
  const { state, caster } = ctx;
  state.spells = state.spells.filter(
    (s) => !(s.kind === 'aura' && s.mode === mode && s.ownerId === caster.id),
  );
  state.spells.push({
    kind: 'aura',
    mode,
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    radius,
    durationTicks,
    ticksLeft: durationTicks,
    cooldown,
    payload: payloadFor(ctx, damage),
  });
}

/** La Inmolación quema alrededor y cura; el Ojo del huracán empuja afuera a los rivales. */
export function updateAura(state: MatchState, aura: Aura, rules: GameRules): boolean {
  const owner = wizardById(state, aura.ownerId);
  if (!owner || owner.hp <= 0) return false;
  if (aura.mode === 'immolation') {
    if (--aura.cooldown <= 0) {
      aura.cooldown = rules.spells.immolation.intervalTicks;
      burnAround(state, aura, owner, rules);
    }
  } else {
    pushOut(state, aura, owner, rules);
  }
  return --aura.ticksLeft > 0;
}

function burnAround(state: MatchState, aura: Aura, owner: Wizard, rules: GameRules): void {
  let dealt = 0;
  for (const wizard of state.wizards) {
    if (wizard.team === aura.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, owner.pos) > aura.radius + rules.wizard.radius) continue;
    const before = wizard.hp;
    applyHit(state, wizard, owner.id, aura.payload, rules);
    dealt += before - wizard.hp;
  }
  healWizard(state, owner, dealt);
}

function pushOut(state: MatchState, aura: Aura, owner: Wizard, rules: GameRules): void {
  const edge = aura.radius + rules.wizard.radius;
  for (const wizard of state.wizards) {
    if (wizard.team === aura.team || wizard.hp <= 0 || wizard.statuses.stasis) continue;
    const gap = distance(wizard.pos, owner.pos);
    if (gap >= edge) continue;
    const out = normalize(sub(wizard.pos, owner.pos), scale(owner.facing, -1));
    wizard.pos = placeInArena(add(owner.pos, scale(out, edge)), rules.wizard.radius, rules);
    wizard.leap = null;
  }
}

/** El Ojo del huracán deshace los proyectiles rivales que entran en él. */
export function insideStormEye(
  state: MatchState,
  team: number,
  pos: { x: number; z: number },
): boolean {
  for (const s of state.spells) {
    if (s.kind !== 'aura' || s.mode !== 'stormEye' || s.team === team) continue;
    const owner = wizardById(state, s.ownerId);
    if (owner && distance(owner.pos, pos) <= s.radius) return true;
  }
  return false;
}

/** Purificación: te quitas todo lo dañino y por un rato no te entra nada dañino. */
export function castPurify(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  for (const id of HARMFUL_STATUSES) delete caster.statuses[id];
  applyStatus(state, caster, 'warded', caster.id, rules);
  state.events.push({ type: 'burst', spell: 'purify', pos: caster.pos, radius: 1.2 });
}

/** Marea de almas: una ola que te cura por cada mago que atraviesa. */
export function castSoulTide(ctx: CastContext): void {
  const spell = ctx.rules.spells.soulTide;
  sweeper(ctx, 'soulTide', spell, spell.radius, 0);
}

// Estados.

/** Combustión: cada hechizo que teja el rival le quema. */
export function castCombustion(ctx: CastContext): void {
  const spell = ctx.rules.spells.combustion;
  const victim = rivalInCone(ctx, spell.range, spell.coneDot);
  if (victim) applyStatus(ctx.state, victim, 'combusting', ctx.caster.id, ctx.rules);
}

/** Robo de velocidad: el rival va más lento y tú más rápido. */
export function castSpeedTheft(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.speedTheft;
  const victim = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!victim) return;
  applyStatus(state, victim, 'slow', caster.id, rules, spell.durationTicks);
  applyStatus(state, caster, 'haste', caster.id, rules, spell.durationTicks);
  state.events.push({ type: 'zap', from: victim.pos, to: caster.pos });
}

/** Ácido: un proyectil que deja al rival recibiendo más daño de todo. */
export function castAcid(ctx: CastContext): void {
  const spell = ctx.rules.spells.acid;
  launch(ctx, spell, payloadFor(ctx, spell.damage, ['exposed']));
}

/** Vaho: una nube donde los rivales tejen más lento. */
export function castMist(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.mist;
  const pos = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules),
    rules.arenaRadius,
  );
  placeZone(ctx, 'mist', spell, pos);
}

/** Eclipse: todos los rivales, donde estén, solo ven de cerca por un rato. */
export function castEclipse(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const ticks = rules.spells.eclipse.durationTicks;
  for (const wizard of state.wizards) {
    if (wizard.team === caster.team || !isAlive(wizard)) continue;
    applyStatus(state, wizard, 'blind', caster.id, rules, ticks);
  }
  state.events.push({ type: 'burst', spell: 'eclipse', pos: caster.pos, radius: 3 });
}

/** Plaga: daño en el tiempo que salta a los rivales que se le acercan al enfermo. */
export function castPlague(ctx: CastContext): void {
  const spell = ctx.rules.spells.plague;
  const victim = rivalInCone(ctx, spell.range, spell.coneDot);
  if (victim) applyStatus(ctx.state, victim, 'plague', ctx.caster.id, ctx.rules);
}
