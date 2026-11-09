import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFrom } from '../../match/queries';
import type { SpellPayload, SweeperMode, Wizard } from '../../match/state';
import { add, distance, dot, normalize, scale, sub } from '../../math/vec2';
import { type CastContext, nextId, payloadFor, placeStrike } from './context';
import { tempestJump } from './greatUpdates';

/** Lanza del cielo: tras un instante, un rayo cae a lo largo de toda la línea apuntada. */
export function castSkySpear(ctx: CastContext): void {
  const spell = ctx.rules.spells.skySpear;
  placeStrike(
    ctx,
    ctx.caster.pos,
    { radius: spell.halfWidth, delayTicks: spell.delayTicks },
    null,
    payloadFor(ctx, spell.damage),
    { dir: ctx.aim, length: spell.length },
  );
}

/** Tempestad: un destello ahora y dos más que salen solos hacia donde muevas al mago. */
export function castTempest(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.tempest;
  state.spells = state.spells.filter((s) => !(s.kind === 'tempest' && s.ownerId === caster.id));
  const tempest = {
    kind: 'tempest' as const,
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    jumpsLeft: spell.jumps - 1,
    ticksToNext: spell.intervalTicks,
    payload: payloadFor(ctx, spell.damage),
  };
  tempestJump(state, tempest, caster, ctx.aim, rules);
  if (tempest.jumpsLeft > 0) state.spells.push(tempest);
}

/** Huracán: un tornado que avanza lento y levanta por los aires a quien toca. */
export function castHurricane(ctx: CastContext): void {
  const spell = ctx.rules.spells.hurricane;
  sweeper(ctx, 'tornado', spell, 0, 0);
}

/** Orbe errático: un orbe lento que da rayos a todo rival que pase cerca. */
export function castErraticOrb(ctx: CastContext): void {
  const spell = ctx.rules.spells.erraticOrb;
  sweeper(ctx, 'orb', spell, 0, 1);
}

/** Lanza algo que avanza solo desde quien lo lanza. */
export function sweeper(
  ctx: CastContext,
  mode: SweeperMode,
  spell: {
    readonly damage: number;
    readonly speed: number;
    readonly range: number;
    readonly radius: number;
  },
  halfWidth: number,
  cooldown: number,
  payload: SpellPayload = payloadFor(ctx, spell.damage),
): void {
  const { state, caster, aim, rules } = ctx;
  state.spells.push({
    kind: 'sweeper',
    mode,
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos: add(caster.pos, scale(aim, rules.wizard.radius + spell.radius)),
    velocity: scale(aim, spell.speed),
    radius: spell.radius,
    halfWidth,
    travelled: 0,
    maxRange: spell.range,
    cooldown,
    struck: [],
    returning: false,
    payload,
  });
}

/** Intercambio: cambias de lugar con el mago más alineado con tu puntería, aliado o rival. */
export function castSwap(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.swap;
  let best: Wizard | null = null;
  let bestAlignment = spell.coneDot;
  for (const other of state.wizards) {
    if (other.id === caster.id || other.hp <= 0 || other.statuses.stasis) continue;
    if (isHiddenFrom(other, caster, rules)) continue;
    const offset = sub(other.pos, caster.pos);
    if (distance(other.pos, caster.pos) > spell.range) continue;
    if (lineBlocked(caster.pos, other.pos, rules.map.obstacles)) continue;
    const alignment = dot(normalize(offset), ctx.aim);
    if (alignment >= bestAlignment) {
      best = other;
      bestAlignment = alignment;
    }
  }
  if (!best) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const mine = caster.pos;
  const theirs = best.pos;
  caster.pos = placeInArena(theirs, rules.wizard.radius, rules);
  best.pos = placeInArena(mine, rules.wizard.radius, rules);
  caster.leap = null;
  best.leap = null;
  state.events.push({
    type: 'blink',
    spell: 'swap',
    wizardId: caster.id,
    from: mine,
    to: caster.pos,
  });
  state.events.push({
    type: 'blink',
    spell: 'swap',
    wizardId: best.id,
    from: theirs,
    to: best.pos,
  });
}
