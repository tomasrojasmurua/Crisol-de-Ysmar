import { applyStatus } from '../../combat/hit';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFrom } from '../../match/queries';
import type { Wizard } from '../../match/state';
import { clampToCircle, distance } from '../../math/vec2';
import { type CastContext, nextId, payloadFor, placeStrike } from './context';
import { groundPoint, targetInCone } from './shared';

/** Pira de almas: marca a los rivales más cercanos; a los 2 s arden según lo heridos que estén. */
export function castSoulPyre(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.soulPyre;
  const victims = state.wizards
    .filter(
      (w) =>
        w.team !== caster.team &&
        w.hp > 0 &&
        !isHiddenFrom(w, caster, rules) &&
        distance(w.pos, caster.pos) <= spell.range &&
        !lineBlocked(caster.pos, w.pos, rules.map.obstacles),
    )
    .sort((a, b) => distance(a.pos, caster.pos) - distance(b.pos, caster.pos) || a.id - b.id)
    .slice(0, spell.targets);
  if (victims.length === 0) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const payload = payloadFor(ctx, spell.damage);
  for (const victim of victims) {
    state.spells = state.spells.filter((s) => !(s.kind === 'pyre' && s.targetId === victim.id));
    state.spells.push({
      kind: 'pyre',
      id: nextId(state),
      ownerId: caster.id,
      team: caster.team,
      targetId: victim.id,
      ticksLeft: spell.delayTicks,
      payload,
    });
  }
}

/** Portal: una boca a tus pies y otra lejos; cualquiera que entre por una sale por la otra. */
export function castPortal(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.portal;
  // Un solo par de portales por mago.
  state.spells = state.spells.filter((s) => !(s.kind === 'portal' && s.ownerId === caster.id));
  const a = caster.pos;
  const far = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules, ctx.reach),
    rules.arenaRadius,
  );
  const b = placeInArena(far, spell.radius, rules);
  // Quien ya está parado en una boca no cruza hasta salir y volver a entrar.
  const inside = state.wizards
    .filter((w) => distance(w.pos, a) <= spell.radius || distance(w.pos, b) <= spell.radius)
    .map((w) => w.id);
  state.spells.push({
    kind: 'portal',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    a,
    b,
    radius: spell.radius,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    inside,
  });
}

/** Fantasma: por un rato atraviesas magos, muros y árboles caminando. */
export function castPhantom(ctx: CastContext): void {
  const { caster, rules } = ctx;
  caster.statuses.phased = { ticks: rules.statuses.phased.ticks, sourceId: caster.id };
}

/** Abismo: tras el aviso, un vórtice silencia a todos los rivales que sigan dentro. */
export function castAbyss(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.abyss;
  const pos = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules, ctx.reach),
    rules.arenaRadius,
  );
  placeStrike(ctx, pos, spell, 'silence', payloadFor(ctx, spell.damage));
}

/** Pesadilla: el rival se duerme; un golpe lo despierta. */
export function castNightmare(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.nightmare;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const victim: Wizard = target.wizard;
  applyStatus(state, victim, 'asleep', caster.id, rules);
  if (victim.statuses.asleep) {
    victim.channel = null;
    victim.leap = null;
    state.events.push({ type: 'burst', spell: 'nightmare', pos: victim.pos, radius: 1 });
  }
}
