import type {
  MatchState,
  SpellPayload,
  Summon,
  SummonKind,
  Wizard,
  ZoneEffect,
} from '../../match/state';
import type { Vec2 } from '../../math/vec2';
import type { GameRules, StatusId } from '../../rules';
import type { Weave } from '../../weaving/weave';
import type { SpellId } from '../catalog';
import { empowerPayload, spellPayload } from '../payload';

/** Todo lo que necesita un hechizo para salir. */
export interface CastContext {
  readonly state: MatchState;
  readonly caster: Wizard;
  readonly spell: SpellId;
  /** El tejido completo: un tejido de 3 sin Gran hechizo usa el de sus dos primeros. */
  readonly weave: Weave;
  /** Dirección ya resuelta (la elegida o hacia el objetivo). */
  readonly aim: Vec2;
  readonly rules: GameRules;
  /** Multiplicador extra de daño, como el de salir del Velo. */
  readonly bonus: number;
}

/** Arma el paquete del hechizo con los Glifos, la Esencia y las bendiciones de quien lanza. */
export function payloadFor(
  ctx: CastContext,
  damage: number,
  statuses: readonly StatusId[] = [],
  blastRadius = 0,
): SpellPayload {
  const base = spellPayload(ctx.spell, ctx.weave, damage, statuses, blastRadius);
  return empowerPayload(base, ctx.caster, ctx.rules, ctx.bonus);
}

export function nextId(state: MatchState): number {
  return state.nextEntityId++;
}

/** Deja un efecto en el suelo, a cierta distancia en la dirección apuntada (0: a tus pies). */
export function placeZone(
  ctx: CastContext,
  effect: ZoneEffect,
  spell: { readonly range: number; readonly radius: number; readonly durationTicks: number },
  pos: Vec2,
): void {
  const { state, caster } = ctx;
  state.spells.push({
    kind: 'zone',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos,
    radius: spell.radius,
    effect,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
  });
}

/** Invoca algo que vive un rato y se puede destruir a golpes. */
export function summon(
  ctx: CastContext,
  kind: SummonKind,
  spell: { readonly hp: number; readonly radius: number; readonly durationTicks: number },
  pos: Vec2,
  payload: SpellPayload,
  cooldown = 0,
): Summon {
  const { state, caster } = ctx;
  const created: Summon = {
    kind: 'summon',
    summon: kind,
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos,
    facing: ctx.aim,
    hp: spell.hp,
    maxHp: spell.hp,
    radius: spell.radius,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    cooldown,
    payload,
  };
  state.spells.push(created);
  return created;
}
