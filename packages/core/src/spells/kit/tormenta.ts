import { lineBlocked, placeInArena } from '../../match/obstacles';
import { isHiddenFrom } from '../../match/queries';
import type { MatchState, Wizard } from '../../match/state';
import { add, distance, scale, type Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { type CastContext, payloadFor } from './context';
import { hitTarget, type SpellTarget, targetInCone, targetPos } from './shared';

/** Paso: un desplazamiento corto hacia donde apuntas. */
export function castStep(ctx: CastContext): void {
  const rules = ctx.rules.spells.step;
  ctx.caster.leap = {
    ticksLeft: rules.durationTicks,
    step: scale(ctx.aim, rules.distance / rules.durationTicks),
    payload: null,
    trail: null,
  };
}

/** Destello: desapareces y apareces más allá, aunque haya árboles en medio. */
export function castBlink(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const from = caster.pos;
  caster.pos = placeInArena(
    add(from, scale(ctx.aim, rules.spells.blink.distance)),
    rules.wizard.radius,
    rules,
  );
  state.events.push({ type: 'blink', wizardId: caster.id, from, to: caster.pos });
}

/** Rayo en cadena: golpea al primer blanco y salta a los más cercanos, cada vez más débil. */
export function castChainLightning(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.chainLightning;
  const first = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (!first) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const base = spell.damages[0] ?? 0;
  const payload = payloadFor(ctx, base);
  const points: Vec2[] = [caster.pos];
  const struck: SpellTarget[] = [];
  let current: SpellTarget | null = first;
  for (let i = 0; current && i < spell.damages.length; i++) {
    const share = base > 0 ? (spell.damages[i] ?? 0) / base : 0;
    hitTarget(state, caster.id, current, payload, rules, share);
    struck.push(current);
    points.push(targetPos(current));
    current = nextBounce(state, caster, targetPos(current), struck, spell.bounceRange, rules);
  }
  state.events.push({ type: 'chain', points });
}

/** El blanco más cercano que todavía no recibió el rayo, a la vista del último. */
function nextBounce(
  state: MatchState,
  caster: Wizard,
  from: Vec2,
  struck: readonly SpellTarget[],
  range: number,
  rules: GameRules,
): SpellTarget | null {
  const hit = new Set(struck.map((t) => (t.kind === 'wizard' ? t.wizard.id : t.beast.id)));
  let best: SpellTarget | null = null;
  let bestDistance = range;
  const consider = (target: SpellTarget, id: number): void => {
    const pos = targetPos(target);
    const d = distance(pos, from);
    if (hit.has(id) || d > bestDistance || lineBlocked(from, pos, rules.map.obstacles)) return;
    best = target;
    bestDistance = d;
  };
  for (const wizard of state.wizards) {
    if (wizard.team === caster.team || wizard.hp <= 0) continue;
    if (isHiddenFrom(wizard, caster, rules)) continue;
    consider({ kind: 'wizard', wizard }, wizard.id);
  }
  for (const beast of state.beasts) {
    consider({ kind: 'beast', beast }, beast.id);
  }
  return best;
}
