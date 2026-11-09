import { placeInArena } from '../../match/obstacles';
import { add, scale } from '../../math/vec2';
import type { ProjectileSpell } from '../spellRules';
import { type CastContext, nextId, payloadFor, summon } from './context';
import { targetInCone } from './shared';

/** Chispa: un dardo rápido que quema. */
export function castSpark(ctx: CastContext): void {
  const rules = ctx.rules.spells.spark;
  launch(ctx, rules, payloadFor(ctx, rules.damage, ['burn']));
}

/** Bola ígnea: lenta y grande; explota donde choca y daña a todos alrededor. */
export function castFireball(ctx: CastContext): void {
  const rules = ctx.rules.spells.fireball;
  launch(ctx, rules, payloadFor(ctx, rules.damage, ['burn'], rules.blastRadius));
}

/** Lanza un proyectil propio en la dirección apuntada. */
export function launch(
  ctx: CastContext,
  spell: ProjectileSpell,
  payload: ReturnType<typeof payloadFor>,
): void {
  const { state, caster, aim } = ctx;
  state.spells.push({
    kind: 'projectile',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos: add(caster.pos, scale(aim, ctx.rules.wizard.radius + spell.radius)),
    velocity: scale(aim, spell.speed),
    deflected: false,
    radius: spell.radius,
    travelled: 0,
    maxRange: spell.range,
    payload,
  });
}

/** Cometa: te lanzas envuelto en llamas y el suelo queda ardiendo detrás. */
export function castComet(ctx: CastContext): void {
  const rules = ctx.rules.spells.comet;
  ctx.caster.leap = {
    ticksLeft: rules.durationTicks,
    step: scale(ctx.aim, rules.distance / rules.durationTicks),
    trail: 'fire',
  };
}

/** Obsidiana: una coraza que ataja el daño y estalla al romperse o al terminar. */
export function castObsidian(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.obsidian;
  // Una sola coraza a la vez: la nueva reemplaza a la anterior sin estallar.
  state.spells = state.spells.filter((s) => !(s.kind === 'obsidian' && s.ownerId === caster.id));
  caster.shield = spell.shield;
  state.spells.push({
    kind: 'obsidian',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, spell.damage),
  });
}

/** Fuego fatuo: una llama que persigue al rival más cercano y explota al tocarlo. */
export function castWisp(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.wisp;
  const pos = placeInArena(add(caster.pos, scale(ctx.aim, 1)), spell.radius, rules);
  summon(ctx, 'wisp', spell, pos, payloadFor(ctx, spell.damage, ['burn']));
}

/** Ignición: marca al rival; al terminar, estalla con parte de todo lo que recibió mientras tanto. */
export function castIgnite(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.ignite;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  // Una sola marca por blanco: la nueva reemplaza a la anterior.
  const victim = target.wizard;
  state.spells = state.spells.filter((s) => !(s.kind === 'ignite' && s.targetId === victim.id));
  state.spells.push({
    kind: 'ignite',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    targetId: victim.id,
    takenAtStart: victim.damageTaken,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, spell.fraction),
  });
}
