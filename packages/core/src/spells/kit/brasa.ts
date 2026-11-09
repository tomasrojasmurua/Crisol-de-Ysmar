import { add, scale } from '../../math/vec2';
import type { ProjectileSpell } from '../spellRules';
import { type CastContext, nextId, payloadFor } from './context';

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

function launch(
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
    payload: null,
    trail: 'fire',
  };
}
