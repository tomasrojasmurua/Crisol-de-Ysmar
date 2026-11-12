import { applyHit } from '../../combat/hit';
import { beastStats, damageBeast } from '../../match/beasts';
import {
  add,
  clampToCircle,
  dot,
  length,
  normalize,
  perpendicular,
  scale,
  sub,
} from '../../math/vec2';
import { type CastContext, nextId, payloadFor, placeStrike } from './context';
import { sweeper } from './greatTormenta';
import { groundPoint, placedAt, targetInCone } from './shared';

/** Era de hielo: tras un aviso, congela a todos los rivales alrededor de donde la lanzaste. */
export function castIceAge(ctx: CastContext): void {
  const spell = ctx.rules.spells.iceAge;
  placeStrike(ctx, ctx.caster.pos, spell, 'freeze', payloadFor(ctx, spell.damage));
}

/** Hervidero: el suelo empieza a hervir; quien siga encima al final recibe mucho daño. */
export function castCauldron(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.cauldron;
  const pos = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules, ctx.reach),
    rules.arenaRadius,
  );
  placeStrike(ctx, pos, spell, null, payloadFor(ctx, spell.damage));
}

/** Chorro de vapor: te impulsas hacia atrás y el chorro quema a lo que tienes delante. */
export function castSteamJet(ctx: CastContext): void {
  const { state, caster, aim, rules } = ctx;
  const spell = rules.spells.steamJet;
  const payload = payloadFor(ctx, spell.damage, ['burn']);
  const inCone = (pos: { x: number; z: number }, reach: number): boolean => {
    const offset = sub(pos, caster.pos);
    const d = length(offset);
    return d <= spell.range + reach && (d < 0.01 || dot(normalize(offset), aim) >= spell.coneDot);
  };
  state.events.push({
    type: 'burst',
    spell: 'steamJet',
    pos: add(caster.pos, scale(aim, spell.range / 2)),
    radius: spell.range / 2,
  });
  for (const wizard of state.wizards) {
    if (wizard.team === caster.team || wizard.hp <= 0) continue;
    if (inCone(wizard.pos, rules.wizard.radius)) applyHit(state, wizard, caster.id, payload, rules);
  }
  for (const beast of state.beasts) {
    if (inCone(beast.pos, beastStats(beast, rules).radius)) {
      damageBeast(state, beast, caster.id, payload.damage, rules);
    }
  }
  caster.leap = {
    ticksLeft: spell.durationTicks,
    step: scale(aim, -spell.distance / spell.durationTicks),
    trail: null,
  };
}

/** Ahogo: el agua sube por el rival; si no sale del alcance a tiempo, queda silenciado. */
export function castDrown(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.drown;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const victim = target.wizard;
  state.spells = state.spells.filter((s) => !(s.kind === 'drown' && s.targetId === victim.id));
  state.spells.push({
    kind: 'drown',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    targetId: victim.id,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, spell.damage),
  });
}

/** Manglar: un muro de raíces y agua que ataja proyectiles rivales y deja pasar a los magos. */
export function castMangrove(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.mangrove;
  state.spells.push({
    kind: 'wall',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    center: placedAt(ctx, spell.distance),
    along: perpendicular(ctx.aim),
    halfLength: spell.halfLength,
    thickness: spell.thickness,
    solid: false,
    passable: true,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, 0),
  });
}

/** Maremoto: una ola ancha cruza el campo y empapa a todo lo que toca. */
export function castTidalWave(ctx: CastContext): void {
  const spell = ctx.rules.spells.tidalWave;
  sweeper(ctx, 'wave', spell, spell.halfWidth, 0);
}
