import { add, perpendicular, scale } from '../../math/vec2';
import { type CastContext, nextId, payloadFor } from './context';

/** Savia: hojas que giran a tu alrededor y te curan de a poco. */
export function castSap(ctx: CastContext): void {
  const { caster, rules } = ctx;
  caster.statuses.regen = { ticks: rules.statuses.regen.ticks, sourceId: caster.id };
}

/** Estampida de espinas: brotes que revientan del suelo en fila, uno tras otro. */
export function castThornRush(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.thornRush;
  state.spells.push({
    kind: 'thornRush',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    origin: caster.pos,
    dir: ctx.aim,
    bursts: 0,
    // El primer brote sale enseguida.
    ticksToNext: 1,
    payload: payloadFor(ctx, spell.damage),
  });
}

/** Muralla de raíces: golpeas el suelo y brota un muro largo que corta el paso a todos. */
export function castRootWall(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.rootWall;
  state.spells.push({
    kind: 'wall',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    center: add(caster.pos, scale(ctx.aim, spell.distance)),
    along: perpendicular(ctx.aim),
    halfLength: spell.halfLength,
    thickness: spell.thickness,
    solid: true,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, 0),
  });
}
