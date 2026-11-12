import { dealDamage } from '../combat/hit';
import { distance, length, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { placeInArena } from './obstacles';
import { enemiesOf, isAlive } from './queries';
import { spawnShrines } from './shrines';
import type { MatchState, RoundPhase, Wizard } from './state';

/** Fase de la ronda según el paso. */
export function roundPhase(tick: number, rules: GameRules): RoundPhase {
  if (tick < rules.round.huntEndTick) return 'hunt';
  if (tick < rules.round.convergenceEndTick) return 'convergence';
  if (tick < rules.round.durationTicks) return 'final';
  return 'sudden';
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
  if (tick <= durationTicks) {
    const t = (tick - convergenceEndTick) / (durationTicks - convergenceEndTick);
    return lerp(convergenceRadius, finalRadius, t);
  }
  // Muerte súbita: se cierra hasta desaparecer.
  const t = Math.min(1, (tick - durationTicks) / rules.round.suddenDeath.shrinkTicks);
  return lerp(finalRadius, 0, t);
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
  const damage = zoneDamageAt(state.tick, rules) / TICK_RATE;
  for (const wizard of state.wizards) {
    if (isAlive(wizard) && length(wizard.pos) > state.zoneRadius) {
      dealDamage(state, wizard, wizard.id, damage, 'zone');
    }
  }
}

/** Daño por segundo fuera de la zona: sube sin tope durante la muerte súbita. */
export function zoneDamageAt(tick: number, rules: GameRules): number {
  const { zoneDamagePerSecond, durationTicks, suddenDeath } = rules.round;
  const seconds = Math.max(0, tick - durationTicks) / TICK_RATE;
  return zoneDamagePerSecond + suddenDeath.damageRampPerSecond * seconds;
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
    };
  }
}

/** Un caído en modo Vidas espera para reaparecer. */
export function updateFallen(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const fallen = wizard.fallen;
  if (!fallen) return;

  if (fallen.respawnTicks !== null && --fallen.respawnTicks <= 0) {
    standUp(wizard, wizard.maxHp);
    wizard.pos = placeInArena(respawnPoint(state, wizard), rules.wizard.radius, rules);
    state.events.push({ type: 'respawned', wizardId: wizard.id });
    return;
  }
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
 * Gana la ronda el último equipo en pie; la ronda no se acaba por tiempo (la muerte súbita la
 * cierra). Devuelve -1 si caen todos a la vez y null si la ronda sigue.
 */
export function decideRoundWinner(state: MatchState): number | null {
  const standing = new Set(state.wizards.filter(isStanding).map((w) => w.team));
  if (standing.size === 0) return -1;
  if (standing.size === 1) return [...standing][0] ?? -1;
  return null;
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
