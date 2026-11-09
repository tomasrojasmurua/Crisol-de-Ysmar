import { applyHit } from '../../combat/hit';
import { beastStats, damageBeast } from '../../match/beasts';
import { lineBlocked } from '../../match/obstacles';
import { currentTarget, enemiesOf, isHiddenFrom } from '../../match/queries';
import type {
  Beast,
  EntityId,
  MatchState,
  Projectile,
  SpellPayload,
  Wizard,
} from '../../match/state';
import { add, distance, dot, length, normalize, scale, sub, type Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import type { SpellId } from '../catalog';
import { damageSummon } from './summons';

/** Un blanco para un hechizo instantáneo: un rival, o si no hay, una bestia. */
export type SpellTarget =
  | { readonly kind: 'wizard'; readonly wizard: Wizard }
  | { readonly kind: 'beast'; readonly beast: Beast };

export function targetPos(target: SpellTarget): Vec2 {
  return target.kind === 'wizard' ? target.wizard.pos : target.beast.pos;
}

/**
 * El blanco más alineado con la puntería dentro de un cono, a la vista (sin árboles en medio)
 * y sin Velo. Los rivales van antes que las bestias.
 */
export function targetInCone(
  state: MatchState,
  caster: Wizard,
  aim: Vec2,
  range: number,
  coneDot: number,
  rules: GameRules,
): SpellTarget | null {
  const seen = (pos: Vec2): boolean => !lineBlocked(caster.pos, pos, rules.map.obstacles);
  const aligned = (pos: Vec2): number => {
    const offset = sub(pos, caster.pos);
    if (length(offset) > range || !seen(pos)) return -2;
    return dot(normalize(offset), aim);
  };
  let best: Wizard | undefined;
  let bestAlignment = coneDot;
  for (const enemy of enemiesOf(state, caster)) {
    if (isHiddenFrom(enemy, caster, rules)) continue;
    const alignment = aligned(enemy.pos);
    if (alignment >= bestAlignment) {
      best = enemy;
      bestAlignment = alignment;
    }
  }
  if (best) return { kind: 'wizard', wizard: best };
  const beast = state.beasts.find((b) => aligned(b.pos) >= coneDot);
  return beast ? { kind: 'beast', beast } : null;
}

/** Golpea un blanco con un hechizo; devuelve el daño hecho a un mago (0 a una bestia). */
export function hitTarget(
  state: MatchState,
  casterId: EntityId,
  target: SpellTarget,
  payload: SpellPayload,
  rules: GameRules,
  /** Proporción del daño del hechizo, por ejemplo en cada salto del rayo. */
  share = 1,
): number {
  if (target.kind === 'beast') {
    damageBeast(state, target.beast, casterId, payload.damage * share, rules);
    return 0;
  }
  const before = target.wizard.hp;
  applyHit(state, target.wizard, casterId, payload, rules, share);
  return before - target.wizard.hp;
}

/** Golpea a todo rival y bestia dentro de un círculo y deja el evento para dibujarlo. */
export function hitArea(
  state: MatchState,
  ownerId: EntityId,
  team: number,
  pos: Vec2,
  radius: number,
  payload: SpellPayload,
  spell: SpellId,
  rules: GameRules,
): void {
  state.events.push({ type: 'burst', spell, pos, radius });
  for (const wizard of state.wizards) {
    if (wizard.team === team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, pos) <= radius + rules.wizard.radius) {
      applyHit(state, wizard, ownerId, payload, rules);
    }
  }
  for (const beast of state.beasts) {
    if (distance(beast.pos, pos) <= radius + beastStats(beast, rules).radius) {
      damageBeast(state, beast, ownerId, payload.damage, rules);
    }
  }
  for (const summon of state.spells) {
    if (summon.kind !== 'summon' || summon.team === team) continue;
    if (distance(summon.pos, pos) <= radius + summon.radius) {
      damageSummon(state, summon, payload.damage);
    }
  }
}

/**
 * La Ventisca tuerce una vez cada proyectil rival que entra en ella, hacia afuera del remolino.
 */
export function deflectInBlizzard(
  state: MatchState,
  projectile: Projectile,
  rules: GameRules,
): void {
  if (projectile.deflected) return;
  for (const zone of state.spells) {
    if (zone.kind !== 'zone' || zone.effect !== 'blizzard' || zone.team === projectile.team) {
      continue;
    }
    if (distance(projectile.pos, zone.pos) > zone.radius) continue;
    const toCenter = sub(zone.pos, projectile.pos);
    const v = projectile.velocity;
    // Gira hacia el lado contrario al centro del remolino.
    const side = v.x * toCenter.z - v.z * toCenter.x >= 0 ? -1 : 1;
    const angle = rules.spells.blizzard.deflectAngle * side;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    projectile.velocity = { x: v.x * cos - v.z * sin, z: v.x * sin + v.z * cos };
    projectile.deflected = true;
    state.events.push({ type: 'blocked', pos: projectile.pos });
    return;
  }
}

/**
 * Dónde cae un hechizo que se lanza a un punto: a los pies del objetivo si está a tiro
 * y en la dirección apuntada; si no, al máximo alcance.
 */
export function groundPoint(
  state: MatchState,
  caster: Wizard,
  aim: Vec2,
  range: number,
  rules: GameRules,
): Vec2 {
  const target = currentTarget(state, caster, rules);
  if (target) {
    const offset = sub(target.pos, caster.pos);
    if (length(offset) <= range && dot(normalize(offset), aim) > 0.9) {
      return target.pos;
    }
  }
  return add(caster.pos, scale(aim, range));
}
