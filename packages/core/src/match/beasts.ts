import { dealDamage } from '../combat/hit';
import { ELEMENT_IDS } from '../elements';
import { add, distance, length, normalize, scale, sub, type Vec2, ZERO } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { placeInArena } from './obstacles';
import { isAlive, wizardById } from './queries';
import { withRng } from './random';
import type { Beast, EntityId, MatchState } from './state';

/** Pasos entre cambios de rumbo cuando la bestia deambula. */
const WANDER_TICKS = 90;

/** Al empezar la ronda, las bestias aparecen repartidas por la arena, una por elemento en ronda. */
export function spawnBeasts(state: MatchState, rules: GameRules): void {
  withRng(state, (rng) => {
    // Con campamentos en el mapa, cada uno tiene su bestia; si no, se reparten en ronda.
    const camps = rules.map.camps;
    const count = camps.length > 0 ? camps.length : rules.beasts.count;
    const offset = rng.next() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const camp = camps[i];
      const angle = offset + (i / count) * Math.PI * 2 + (rng.next() - 0.5) * 0.4;
      const r = rules.arenaRadius * (0.3 + rng.next() * 0.35);
      const home = placeInArena(
        camp ? { x: camp.x, z: camp.z } : { x: Math.cos(angle) * r, z: Math.sin(angle) * r },
        rules.beasts.radius,
        rules,
      );
      const element = camp?.element ?? ELEMENT_IDS[i % ELEMENT_IDS.length] ?? 'brasa';
      state.beasts.push({
        id: state.nextEntityId++,
        element,
        home,
        pos: home,
        facing: { x: 0, z: 1 },
        hp: rules.beasts.maxHp,
        targetId: null,
        aggroTicks: 0,
        attackCooldown: 0,
        velocity: ZERO,
      });
    }
  });
}

export function beastById(state: MatchState, id: EntityId | null): Beast | undefined {
  return id === null ? undefined : state.beasts.find((b) => b.id === id);
}

/**
 * Daña a una bestia. Se enoja con quien la atacó; si muere, su Esencia
 * pasa al mago que le dio el último golpe.
 */
export function damageBeast(
  state: MatchState,
  beast: Beast,
  sourceId: EntityId,
  amount: number,
  rules: GameRules,
): void {
  if (beast.hp <= 0 || amount <= 0) return;
  beast.hp = Math.max(0, beast.hp - amount);
  beast.targetId = sourceId;
  beast.aggroTicks = rules.beasts.aggroTicks;
  state.events.push({ type: 'beastHit', beastId: beast.id, sourceId, amount });
  if (beast.hp > 0) return;

  const killer = wizardById(state, sourceId);
  if (killer && isAlive(killer)) {
    killer.essence[beast.element] = Math.min(
      rules.beasts.maxEssence,
      killer.essence[beast.element] + 1,
    );
  }
  state.events.push({
    type: 'beastSlain',
    beastId: beast.id,
    element: beast.element,
    killerId: killer ? killer.id : null,
  });
}

/** Avanza las bestias: deambulan cerca de su guarida o persiguen y muerden a quien las atacó. */
export function updateBeasts(state: MatchState, rules: GameRules): void {
  state.beasts = state.beasts.filter((beast) => beast.hp > 0);
  const config = rules.beasts;
  for (const beast of state.beasts) {
    if (beast.attackCooldown > 0) beast.attackCooldown--;
    const target = wizardById(state, beast.targetId);
    const chasing =
      target !== undefined &&
      isAlive(target) &&
      beast.aggroTicks > 0 &&
      distance(beast.pos, beast.home) <= config.leash;

    let goal: Vec2;
    let speed = config.moveSpeed;
    if (chasing && target) {
      beast.aggroTicks--;
      goal = target.pos;
      const reach = config.attackRange + rules.wizard.radius + config.radius;
      if (distance(beast.pos, target.pos) <= reach) {
        goal = beast.pos;
        if (beast.attackCooldown === 0) {
          beast.attackCooldown = config.attackCooldownTicks;
          dealDamage(state, target, beast.id, config.damage, 'beast');
        }
      }
    } else {
      beast.targetId = null;
      beast.aggroTicks = 0;
      goal = wanderPoint(beast, state.tick);
      speed *= 0.35;
    }

    const offset = sub(goal, beast.pos);
    const step = Math.min(length(offset), speed / TICK_RATE);
    const direction = normalize(offset);
    beast.velocity = scale(direction, step * TICK_RATE);
    if (step > 0) {
      beast.pos = placeInArena(add(beast.pos, scale(direction, step)), rules.beasts.radius, rules);
      beast.facing = direction;
    } else if (target && chasing) {
      beast.facing = normalize(sub(target.pos, beast.pos), beast.facing);
    }
  }
}

/** Punto al que deambula: cambia cada pocos segundos, sin azar, a partir del paso y el id. */
function wanderPoint(beast: Beast, tick: number): Vec2 {
  const slot = Math.floor(tick / WANDER_TICKS);
  const hash = Math.imul(beast.id ^ Math.imul(slot, 0x9e3779b1), 0x85ebca6b) >>> 0;
  const angle = (hash / 4294967296) * Math.PI * 2;
  return add(beast.home, { x: Math.cos(angle) * 2, z: Math.sin(angle) * 2 });
}
