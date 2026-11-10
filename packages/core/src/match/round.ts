import { applyStatus, dealDamage } from '../combat/hit';
import { add, clampToCircle, distance, length, normalize, scale, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { placeInArena } from './obstacles';
import { currentTarget, enemiesOf, isAlive } from './queries';
import { spawnShrines } from './shrines';
import type { MatchState, RoundPhase, Wizard } from './state';

/** Fase de la ronda según el paso. */
export function roundPhase(tick: number, rules: GameRules): RoundPhase {
  if (tick < rules.round.huntEndTick) return 'hunt';
  if (tick < rules.round.convergenceEndTick) return 'convergence';
  return 'final';
}

/** Radio de la zona: abierta en la Caza y cerrándose en línea recta después. */
export function zoneRadiusAt(tick: number, rules: GameRules): number {
  const { huntEndTick, convergenceEndTick, durationTicks, convergenceRadius, finalRadius } =
    rules.round;
  if (tick <= huntEndTick) {
    return rules.arenaRadius;
  }
  if (tick <= convergenceEndTick) {
    const t = (tick - huntEndTick) / (convergenceEndTick - huntEndTick);
    return lerp(rules.arenaRadius, convergenceRadius, t);
  }
  const t = Math.min(1, (tick - convergenceEndTick) / (durationTicks - convergenceEndTick));
  return lerp(convergenceRadius, finalRadius, t);
}

/** Achica la zona, avisa los cambios de fase y daña a quien quedó afuera. */
export function updateZone(state: MatchState, rules: GameRules): void {
  const before = roundPhase(state.tick, rules);
  const after = roundPhase(state.tick + 1, rules);
  if (before !== after) {
    state.events.push({ type: 'phase', phase: after });
    if (after === 'convergence') spawnShrines(state, rules);
  }
  state.zoneRadius = zoneRadiusAt(state.tick + 1, rules);
  const damage = rules.round.zoneDamagePerSecond / TICK_RATE;
  for (const wizard of state.wizards) {
    if (isAlive(wizard) && length(wizard.pos) > state.zoneRadius) {
      dealDamage(state, wizard, wizard.id, damage, 'zone');
    }
  }
}

/** Convierte en caídos a los magos que quedaron sin vida en este paso. */
export function processFalls(state: MatchState, rules: GameRules): void {
  for (const wizard of state.wizards) {
    if (wizard.hp > 0 || wizard.fallen) continue;
    wizard.lives = Math.max(0, wizard.lives - 1);
    wizard.statuses = {};
    wizard.shield = 0;
    wizard.moveInput = { x: 0, z: 0 };
    const canRespawn = state.deathRule === 'lives' && wizard.lives > 0;
    wizard.fallen = {
      respawnTicks: canRespawn ? rules.death.respawnTicks : null,
      reviveProgress: 0,
      hauntCooldown: rules.death.spectre.hauntCooldownTicks,
    };
  }
}

/** Un caído espera para reaparecer o, en modo Espectro, deambula. */
export function updateFallen(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const fallen = wizard.fallen;
  if (!fallen) return;
  if (fallen.hauntCooldown > 0) fallen.hauntCooldown--;

  if (fallen.respawnTicks !== null && --fallen.respawnTicks <= 0) {
    standUp(wizard, wizard.maxHp);
    wizard.pos = placeInArena(respawnPoint(state, wizard), rules.wizard.radius, rules);
    state.events.push({ type: 'respawned', wizardId: wizard.id });
    return;
  }
  if (isSpectre(state, wizard)) {
    const speed = rules.wizard.moveSpeed * rules.death.spectre.moveMultiplier;
    const move = scale(wizard.moveInput, speed / TICK_RATE);
    if (length(move) > 0) {
      wizard.pos = clampToCircle(add(wizard.pos, move), rules.arenaRadius - rules.wizard.radius);
      wizard.facing = normalize(wizard.moveInput, wizard.facing);
    }
  }
}

/** El espectro solo se mueve y lanza su Lamento: no teje ni recibe daño. */
export function isSpectre(state: MatchState, wizard: Wizard): boolean {
  return state.deathRule === 'spectre' && wizard.fallen !== null;
}

/** Lamento: el espectro ralentiza a su objetivo o al enemigo más cercano a su alcance. */
export function haunt(state: MatchState, spectre: Wizard, rules: GameRules): void {
  const fallen = spectre.fallen;
  if (!fallen || fallen.hauntCooldown > 0 || !isSpectre(state, spectre)) return;
  const range = rules.death.spectre.hauntRange;
  const locked = currentTarget(state, spectre, rules);
  const target =
    locked && distance(locked.pos, spectre.pos) <= range
      ? locked
      : enemiesOf(state, spectre).find((e) => distance(e.pos, spectre.pos) <= range);
  if (!target) return;
  applyStatus(state, target, 'slow', spectre.id, rules);
  fallen.hauntCooldown = rules.death.spectre.hauntCooldownTicks;
  state.events.push({ type: 'haunt', wizardId: spectre.id, targetId: target.id });
}

/** Un aliado de pie junto a un caído lo va levantando; si se aleja, se pierde el avance. */
export function updateRevives(state: MatchState, rules: GameRules): void {
  const { radius, ticks, hpFraction } = rules.death.revive;
  // Con la regla "fuera", quien cae no vuelve en la ronda.
  if (state.deathRule === 'out') return;
  for (const wizard of state.wizards) {
    const fallen = wizard.fallen;
    if (!fallen) continue;
    const helper = state.wizards.find(
      (ally) =>
        ally.id !== wizard.id &&
        ally.team === wizard.team &&
        isAlive(ally) &&
        distance(ally.pos, wizard.pos) <= radius,
    );
    if (!helper) {
      fallen.reviveProgress = 0;
      continue;
    }
    if (++fallen.reviveProgress >= ticks) {
      standUp(wizard, wizard.maxHp * hpFraction);
      state.events.push({ type: 'revived', wizardId: wizard.id, byId: helper.id });
    }
  }
}

/** Sigue en la ronda quien está vivo o espera para reaparecer. */
export function isStanding(wizard: Wizard): boolean {
  return isAlive(wizard) || (wizard.fallen !== null && wizard.fallen.respawnTicks !== null);
}

/**
 * Gana la ronda el último equipo en pie. Si se acaba el tiempo, gana el equipo con más vida.
 * Devuelve -1 si hay empate y null si la ronda sigue.
 */
export function decideRoundWinner(state: MatchState, rules: GameRules): number | null {
  const standing = new Set(state.wizards.filter(isStanding).map((w) => w.team));
  if (standing.size === 0) return -1;
  if (standing.size === 1) return [...standing][0] ?? -1;
  if (state.tick < rules.round.durationTicks) return null;

  const hpByTeam = new Map<number, number>();
  for (const wizard of state.wizards) {
    hpByTeam.set(wizard.team, (hpByTeam.get(wizard.team) ?? 0) + wizard.hp);
  }
  const best = Math.max(...hpByTeam.values());
  const leaders = [...hpByTeam].filter(([, hp]) => hp === best);
  return leaders.length === 1 ? (leaders[0]?.[0] ?? -1) : -1;
}

/** Pone de pie a un caído con cierta vida. */
export function standUp(wizard: Wizard, hp: number): void {
  wizard.hp = hp;
  wizard.fallen = null;
  wizard.weave = [];
  wizard.channel = null;
  wizard.leap = null;
}

/** Reaparece en el borde de la zona, en el punto más lejano de sus enemigos. */
function respawnPoint(state: MatchState, wizard: Wizard): Vec2 {
  const radius = state.zoneRadius * 0.85;
  const enemies = enemiesOf(state, wizard);
  let best: Vec2 = { x: 0, z: -radius };
  let bestDistance = -1;
  const candidates = 12;
  for (let i = 0; i < candidates; i++) {
    const angle = (i / candidates) * Math.PI * 2;
    const point = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    const nearest = Math.min(
      Number.POSITIVE_INFINITY,
      ...enemies.map((e) => distance(e.pos, point)),
    );
    if (nearest > bestDistance) {
      best = point;
      bestDistance = nearest;
    }
  }
  return best;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
