import type { MatchState, SpellPayload, Wizard } from '../../match/state';
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
