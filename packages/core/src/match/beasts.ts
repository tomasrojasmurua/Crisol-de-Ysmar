import { dealDamage } from '../combat/hit';
import type { ElementId } from '../elements';
import { ELEMENT_IDS } from '../elements';
import { add, distance, length, normalize, scale, sub, type Vec2, ZERO } from '../math/vec2';
import type { BeastStats, GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { placeInArena } from './obstacles';
import { enemiesOf, isAlive, isHiddenFromServantsOf, wizardById } from './queries';
import { withRng } from './random';
import type { Beast, EntityId, MatchState, Wizard } from './state';

/** Pasos entre cambios de rumbo cuando la bestia deambula. */
const WANDER_TICKS = 90;

/** Cómo se acomoda una manada alrededor del centro del campamento. */
const PACK_SPREAD = 1.4;

/** Lo que pesa al pelear: el Guardián usa sus propios números. */
export function beastStats(beast: Beast, rules: GameRules): BeastStats {
  return beast.guardian ? rules.beasts.guardian : rules.beasts;
}

function createBeast(
  state: MatchState,
  rules: GameRules,
  home: Vec2,
  element: ElementId,
  camp: number | null,
  guardian: boolean,
): Beast {
  const stats = guardian ? rules.beasts.guardian : rules.beasts;
  const pos = placeInArena(home, stats.radius, rules);
  const beast: Beast = {
    id: state.nextEntityId++,
    element,
    camp,
    guardian,
    maxHp: stats.maxHp,
    home: pos,
    pos,
    facing: { x: 0, z: 1 },
    hp: stats.maxHp,
    targetId: null,
    aggroTicks: 0,
    attackCooldown: 0,
    tamedBy: null,
    tamedTicks: 0,
    velocity: ZERO,
  };
  state.beasts.push(beast);
  return beast;
}

/** Puebla un campamento con su manada, repartida en círculo y mirando hacia afuera. */
function spawnPack(state: MatchState, rules: GameRules, index: number): void {
  const camp = rules.map.camps[index];
  if (!camp) return;
  const size = rules.beasts.packSize;
  const outward = Math.atan2(camp.z, camp.x);
  for (let k = 0; k < size; k++) {
    const angle = outward + (k / size) * Math.PI * 2 + Math.PI / 2;
    const spread = size > 1 ? PACK_SPREAD : 0;
    createBeast(
      state,
      rules,
      { x: camp.x + Math.cos(angle) * spread, z: camp.z + Math.sin(angle) * spread },
      camp.element,
      index,
      false,
    );
  }
}

/** Al empezar la ronda: una manada por campamento, o bestias sueltas si el mapa no tiene. */
export function spawnBeasts(state: MatchState, rules: GameRules): void {
  const camps = rules.map.camps;
  if (camps.length > 0) {
    camps.forEach((_, i) => {
      spawnPack(state, rules, i);
    });
    return;
  }
  withRng(state, (rng) => {
    const count = rules.beasts.count;
    const offset = rng.next() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2 + (rng.next() - 0.5) * 0.4;
      const r = rules.arenaRadius * (0.3 + rng.next() * 0.35);
      const element = ELEMENT_IDS[i % ELEMENT_IDS.length] ?? 'brasa';
      createBeast(
        state,
        rules,
        { x: Math.cos(angle) * r, z: Math.sin(angle) * r },
        element,
        null,
        false,
      );
    }
  });
}

/**
 * Campamentos vacíos que vuelven a poblarse y el Guardián que despierta. Un campamento que
 * quedó fuera de la zona ya no se repuebla.
 */
function repopulate(state: MatchState, rules: GameRules): void {
  rules.map.camps.forEach((camp, i) => {
    const occupied = state.beasts.some((b) => b.camp === i);
    const due = state.campRespawn[i] ?? -1;
    if (occupied) {
      state.campRespawn[i] = -1;
    } else if (due < 0) {
      state.campRespawn[i] = state.tick + rules.beasts.respawnTicks;
    } else if (state.tick >= due && Math.hypot(camp.x, camp.z) < state.zoneRadius) {
      spawnPack(state, rules, i);
      state.campRespawn[i] = -1;
    }
  });

  const lair = rules.map.guardianLair;
  if (lair && !state.guardianAwake && state.tick >= rules.beasts.guardian.spawnTick) {
    state.guardianAwake = true;
    withRng(state, (rng) => {
      const element = ELEMENT_IDS[Math.floor(rng.next() * ELEMENT_IDS.length)] ?? 'brasa';
      const guardian = createBeast(state, rules, lair, element, null, true);
      state.events.push({ type: 'guardianAwake', beastId: guardian.id });
    });
  }
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
  beast.aggroTicks = beastStats(beast, rules).aggroTicks;
  state.events.push({ type: 'beastHit', beastId: beast.id, sourceId, amount });
  if (beast.hp > 0) return;

  const killer = wizardById(state, sourceId);
  if (killer && isAlive(killer)) {
    // El Guardián da Esencia de todos los elementos; una bestia común, la suya.
    const reward = beast.guardian ? rules.beasts.guardian.essenceReward : 1;
    for (const element of beast.guardian ? ELEMENT_IDS : [beast.element]) {
      killer.essence[element] = Math.min(rules.beasts.maxEssence, killer.essence[element] + reward);
    }
  }
  state.events.push({
    type: 'beastSlain',
    beastId: beast.id,
    element: beast.element,
    killerId: killer ? killer.id : null,
    guardian: beast.guardian,
  });
}

/** Avanza las bestias: deambulan cerca de su guarida o persiguen y muerden a quien las atacó. */
export function updateBeasts(state: MatchState, rules: GameRules): void {
  state.beasts = state.beasts.filter((beast) => beast.hp > 0);
  repopulate(state, rules);
  for (const beast of state.beasts) {
    const config = beastStats(beast, rules);
    if (beast.attackCooldown > 0) beast.attackCooldown--;
    if (beast.tamedBy !== null && updateTamed(state, beast, config, rules)) continue;
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
      beast.pos = placeInArena(add(beast.pos, scale(direction, step)), config.radius, rules);
      beast.facing = direction;
    } else if (target && chasing) {
      beast.facing = normalize(sub(target.pos, beast.pos), beast.facing);
    }
  }
}

/**
 * Una bestia domada pelea para su mago: va por el rival más cercano a él y, si no hay, lo
 * sigue. Devuelve false cuando se acaba el tiempo y vuelve a ser salvaje.
 */
function updateTamed(
  state: MatchState,
  beast: Beast,
  config: BeastStats,
  rules: GameRules,
): boolean {
  const tamer = wizardById(state, beast.tamedBy);
  if (!tamer || !isAlive(tamer) || --beast.tamedTicks <= 0) {
    beast.tamedBy = null;
    beast.tamedTicks = 0;
    beast.targetId = null;
    return false;
  }
  let prey: Wizard | undefined;
  let best = 12;
  for (const enemy of enemiesOf(state, tamer)) {
    const d = distance(enemy.pos, beast.pos);
    if (d < best && !isHiddenFromServantsOf(enemy, tamer, rules)) {
      prey = enemy;
      best = d;
    }
  }
  let goal = distance(tamer.pos, beast.pos) > 3 ? tamer.pos : beast.pos;
  if (prey) {
    goal = prey.pos;
    const reach = config.attackRange + rules.wizard.radius + config.radius;
    if (best <= reach) {
      goal = beast.pos;
      beast.facing = normalize(sub(prey.pos, beast.pos), beast.facing);
      if (beast.attackCooldown === 0) {
        beast.attackCooldown = config.attackCooldownTicks;
        dealDamage(state, prey, tamer.id, config.damage, 'beast');
      }
    }
  }
  const offset = sub(goal, beast.pos);
  const step = Math.min(length(offset), config.moveSpeed / TICK_RATE);
  const direction = normalize(offset);
  beast.velocity = scale(direction, step * TICK_RATE);
  if (step > 0) {
    beast.pos = placeInArena(add(beast.pos, scale(direction, step)), config.radius, rules);
    beast.facing = direction;
  }
  return true;
}

/** Punto al que deambula: cambia cada pocos segundos, sin azar, a partir del paso y el id. */
function wanderPoint(beast: Beast, tick: number): Vec2 {
  const slot = Math.floor(tick / WANDER_TICKS);
  const hash = Math.imul(beast.id ^ Math.imul(slot, 0x9e3779b1), 0x85ebca6b) >>> 0;
  const angle = (hash / 4294967296) * Math.PI * 2;
  return add(beast.home, { x: Math.cos(angle) * 2, z: Math.sin(angle) * 2 });
}
