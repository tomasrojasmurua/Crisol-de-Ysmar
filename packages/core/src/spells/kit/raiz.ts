import { applyStatus } from '../../combat/hit';
import { placeInArena } from '../../match/obstacles';
import { isHiddenFrom } from '../../match/queries';
import type { Wizard } from '../../match/state';
import {
  add,
  clampToCircle,
  distance,
  dot,
  perpendicular,
  scale,
  sub,
  type Vec2,
} from '../../math/vec2';
import { type CastContext, nextId, payloadFor, placeZone, summon } from './context';
import { groundPoint, placedAt } from './shared';

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
    center: placedAt(ctx, spell.distance),
    along: perpendicular(ctx.aim),
    halfLength: spell.halfLength,
    thickness: spell.thickness,
    solid: true,
    passable: false,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, 0),
  });
}

/** Liana: se engancha al primer árbol, roca o rival en la línea y te lleva hasta ahí. */
export function castVine(ctx: CastContext): void {
  const { state, caster, aim, rules } = ctx;
  const spell = rules.spells.vine;
  const hit = vineHit(ctx);
  const to = hit ? hit.point : add(caster.pos, scale(aim, spell.range));
  state.events.push({ type: 'vine', wizardId: caster.id, to, hit: hit !== null });
  if (!hit) return;
  if (hit.wizard) {
    applyStatus(state, hit.wizard, 'root', caster.id, rules, spell.rootTicks);
  }
  // Te detienes justo antes de lo que enganchaste.
  const stop = hit.reach - rules.wizard.radius;
  if (stop <= 0.2) return;
  const ticks = Math.max(2, Math.round((stop / spell.speed) * 30));
  caster.leap = { ticksLeft: ticks, step: scale(aim, stop / ticks), trail: null };
}

interface VineHit {
  /** Distancia hasta el punto de enganche, a lo largo de la liana. */
  readonly reach: number;
  readonly point: Vec2;
  readonly wizard: Wizard | null;
}

/** Lo primero que toca la liana: un rival visible o un árbol, una roca o una ruina. */
function vineHit(ctx: CastContext): VineHit | null {
  const { state, caster, aim, rules } = ctx;
  const range = rules.spells.vine.range;
  let best: VineHit | null = null;
  const consider = (center: Vec2, radius: number, wizard: Wizard | null): void => {
    const offset = sub(center, caster.pos);
    const along = dot(offset, aim);
    if (along <= 0) return;
    const across = Math.abs(offset.x * aim.z - offset.z * aim.x);
    if (across > radius) return;
    // Donde la línea entra al círculo.
    const reach = along - Math.sqrt(radius * radius - across * across);
    if (reach > range || (best && reach >= best.reach)) return;
    best = { reach, point: add(caster.pos, scale(aim, reach)), wizard };
  };
  for (const enemy of state.wizards) {
    if (enemy.team === caster.team || enemy.hp <= 0 || isHiddenFrom(enemy, caster, rules)) continue;
    consider(enemy.pos, rules.wizard.radius + 0.2, enemy);
  }
  for (const obstacle of rules.map.obstacles) {
    if (distance(obstacle, caster.pos) > range + obstacle.radius) continue;
    consider(obstacle, obstacle.radius, null);
  }
  return best;
}

/** Guardián de musgo: una criatura de piedra que te sigue, pega de cerca y ataja proyectiles. */
export function castMossGuardian(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.mossGuardian;
  const pos = placeInArena(add(caster.pos, scale(ctx.aim, 1.5)), spell.radius, rules);
  summon(ctx, 'mossGuardian', spell, pos, payloadFor(ctx, spell.damage));
}

/** Esporas: una nube que debilita a los rivales que la respiran. */
export function castSpores(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.spores;
  const pos = groundPoint(state, caster, ctx.aim, spell.range, rules, ctx.reach);
  placeZone(ctx, 'spores', spell, clampToCircle(pos, rules.arenaRadius));
}
