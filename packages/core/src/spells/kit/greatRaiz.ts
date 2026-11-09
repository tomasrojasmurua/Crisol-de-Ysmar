import { placeInArena } from '../../match/obstacles';
import {
  add,
  clampToCircle,
  distance,
  dot,
  normalize,
  scale,
  sub,
  type Vec2,
} from '../../math/vec2';
import type { Obstacle } from '../../rules';
import { type CastContext, nextId, payloadFor } from './context';
import { groundPoint } from './shared';

/** Catapulta de raíz: una raíz te lanza en arco por encima de todo; al caer, enraízas. */
export function castRootCatapult(ctx: CastContext): void {
  const spell = ctx.rules.spells.rootCatapult;
  ctx.caster.leap = {
    ticksLeft: spell.durationTicks,
    step: scale(ctx.aim, spell.distance / spell.durationTicks),
    trail: null,
    landing: payloadFor(ctx, spell.damage),
  };
}

/** Siembra: seis trampas al instante, una al centro y las demás alrededor. */
export function castSowing(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.sowing;
  // Una sola siembra por mago: la nueva reemplaza a la anterior.
  state.spells = state.spells.filter((s) => !(s.kind === 'trap' && s.ownerId === caster.id));
  const center = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules),
    rules.arenaRadius - 1,
  );
  const payload = payloadFor(ctx, spell.damage);
  const around = spell.count - 1;
  // Las de alrededor giran con la puntería, así se ven igual en todos los celulares.
  const forward = ctx.aim;
  const side = { x: -forward.z, z: forward.x };
  for (let i = 0; i < spell.count; i++) {
    let pos = center;
    if (i > 0) {
      const angle = ((i - 1) / around) * Math.PI * 2;
      const offset = add(
        scale(forward, Math.cos(angle) * spell.spread),
        scale(side, Math.sin(angle) * spell.spread),
      );
      pos = clampToCircle(add(center, offset), rules.arenaRadius - 1);
    }
    state.spells.push({
      kind: 'trap',
      id: nextId(state),
      ownerId: caster.id,
      team: caster.team,
      pos,
      radius: spell.radius,
      armTicks: spell.armTicks,
      ticksLeft: spell.durationTicks,
      payload,
    });
  }
}

/** Anillo de zarzas: un círculo de espinas ardientes; nadie entra ni sale caminando. */
export function castThornRing(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.thornRing;
  const pos = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules),
    rules.arenaRadius,
  );
  state.spells.push({
    kind: 'thornRing',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos,
    radius: spell.radius,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, 0, ['burn']),
  });
}

/** Paso entre árboles: entras en un árbol cercano y sales por otro, hacia donde apuntas. */
export function castTreeStride(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.treeStride;
  const trees = rules.map.obstacles.filter((o) => o.kind === 'tree');
  const entry = nearestTree(trees, caster.pos, spell.entryRange);
  let exit: Obstacle | null = null;
  let bestScore = spell.coneDot;
  if (entry) {
    for (const tree of trees) {
      if (tree === entry) continue;
      const d = distance(tree, caster.pos);
      if (d > spell.range || d < entry.radius + 1) continue;
      // El más alineado con la puntería; a igual dirección, el más lejano.
      const score = dot(normalize(sub(tree, caster.pos)), ctx.aim) + d / 1000;
      if (score > bestScore) {
        exit = tree;
        bestScore = score;
      }
    }
  }
  if (!exit) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const from = caster.pos;
  // Sales del lado del árbol que da hacia donde ibas.
  const out = add(exit, scale(ctx.aim, exit.radius + rules.wizard.radius + 0.1));
  caster.pos = placeInArena(out, rules.wizard.radius, rules);
  caster.leap = null;
  state.events.push({
    type: 'blink',
    spell: 'treeStride',
    wizardId: caster.id,
    from,
    to: caster.pos,
  });
}

function nearestTree(trees: readonly Obstacle[], pos: Vec2, reach: number): Obstacle | null {
  let best: Obstacle | null = null;
  let bestGap = reach;
  for (const tree of trees) {
    const gap = distance(tree, pos) - tree.radius;
    if (gap <= bestGap) {
      best = tree;
      bestGap = gap;
    }
  }
  return best;
}
