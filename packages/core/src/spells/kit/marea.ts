import { applyHit } from '../../combat/hit';
import { beastStats, damageBeast } from '../../match/beasts';
import { add, clampToCircle, dot, length, normalize, scale, sub } from '../../math/vec2';
import type { StatusId } from '../../rules';
import { type CastContext, nextId, payloadFor } from './context';
import { groundPoint } from './shared';

/** Salpicón: un abanico de agua que moja y frena a todo lo que hay delante. */
export function castSplash(ctx: CastContext): void {
  const { state, caster, aim, rules } = ctx;
  const spell = rules.spells.splash;
  const payload = payloadFor(ctx, spell.damage, ['slow']);
  const inCone = (pos: { x: number; z: number }, reach: number): boolean => {
    const offset = sub(pos, caster.pos);
    const d = length(offset);
    return d <= spell.range + reach && (d < 0.01 || dot(normalize(offset), aim) >= spell.coneDot);
  };
  state.events.push({
    type: 'burst',
    spell: 'splash',
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
}

/** Géiser: marca un punto; tras el aviso, brota y levanta por los aires a quien siga encima. */
export function castGeyser(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.geyser;
  const pos = groundPoint(state, caster, ctx.aim, spell.range, rules);
  state.spells.push({
    kind: 'geyser',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos: clampToCircle(pos, rules.arenaRadius),
    radius: spell.radius,
    delayTicks: spell.delayTicks,
    ticksLeft: spell.delayTicks,
    payload: payloadFor(ctx, spell.damage, ['airborne']),
  });
}

/** Lo que el hielo quita al encerrarte; la bendición de un santuario, la Savia y el Velo se quedan. */
const HARMFUL: readonly StatusId[] = ['burn', 'slow', 'root', 'curse', 'airborne'];

/** Ataúd helado: te encierras en hielo; nada te daña ni te afecta, y sales limpio. */
export function castIceCoffin(ctx: CastContext): void {
  const { caster, rules } = ctx;
  for (const id of HARMFUL) delete caster.statuses[id];
  caster.leap = null;
  caster.statuses.stasis = { ticks: rules.statuses.stasis.ticks, sourceId: caster.id };
}
