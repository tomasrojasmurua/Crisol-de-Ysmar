import { type CastContext, nextId, payloadFor } from './context';
import { hitTarget, targetInCone } from './shared';

/** Zarpa: un golpe instantáneo a quien miras que te devuelve vida. */
export function castClaw(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.claw;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (!target) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const payload = payloadFor(ctx, spell.damage);
  if (target.kind === 'beast') {
    state.events.push({ type: 'markBeast', wizardId: caster.id, beastId: target.beast.id });
  }
  const done = hitTarget(state, caster.id, target, payload, rules);
  heal(ctx, (target.kind === 'beast' ? payload.damage : done) * spell.lifesteal);
}

/** Velo: te vuelves invisible; el primer hechizo que lances desde el velo pega más. */
export function castVeil(ctx: CastContext): void {
  const { caster, rules } = ctx;
  caster.statuses.veiled = { ticks: rules.statuses.veiled.ticks, sourceId: caster.id };
}

/** Drenaje: un hilo de sombra que le roba vida al rival mientras siga cerca y a la vista. */
export function castDrain(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.drain;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  // Un solo hilo por mago: uno nuevo reemplaza al anterior.
  state.spells = state.spells.filter((s) => !(s.kind === 'tether' && s.ownerId === caster.id));
  state.spells.push({
    kind: 'tether',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    targetId: target.wizard.id,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, spell.damagePerSecond),
  });
}

function heal(ctx: CastContext, amount: number): void {
  const caster = ctx.caster;
  if (caster.hp > 0) caster.hp = Math.min(caster.maxHp, caster.hp + amount);
}
