import type { GameRules } from '../rules';

/**
 * Reglas fijas para las pruebas del núcleo. El núcleo no puede depender de `content`,
 * así que las pruebas usan esta copia: si cambian los valores reales, estas pruebas no se rompen.
 */
export const TEST_RULES: GameRules = {
  arenaRadius: 16,
  wizard: { maxHp: 100, moveSpeed: 6, radius: 0.5, channelMoveMultiplier: 0.5 },
  weave: { castTicksByLength: [3, 9, 18], fatigueTicks: 90 },
  forms: {
    projectile: { damage: 10, status: null, speed: 15, range: 15, radius: 0.3 },
    wall: {
      damage: 5,
      status: 'slow',
      halfLength: 2,
      distance: 2,
      durationTicks: 120,
      pulseRadius: 2.5,
    },
    trap: {
      damage: 10,
      status: 'root',
      range: 9,
      triggerRadius: 1.3,
      armTicks: 5,
      durationTicks: 300,
    },
    leap: { damage: 8, status: null, distance: 6, durationTicks: 6, impactRadius: 2 },
    mark: { damage: 6, status: 'curse', range: 11, coneDot: 0.5 },
  },
  modifiers: {
    brasa: { damageMultiplier: 1.5, status: 'burn', speedMultiplier: 1, rangeMultiplier: 1 },
    tormenta: { damageMultiplier: 1, status: null, speedMultiplier: 2, rangeMultiplier: 1.5 },
    marea: { damageMultiplier: 1, status: 'slow', speedMultiplier: 1, rangeMultiplier: 1 },
    raiz: { damageMultiplier: 1, status: 'root', speedMultiplier: 1, rangeMultiplier: 1 },
    umbra: { damageMultiplier: 1, status: 'curse', speedMultiplier: 1, rangeMultiplier: 1 },
  },
  statuses: {
    burn: { ticks: 60, damagePerSecond: 3 },
    slow: { ticks: 60, moveMultiplier: 0.5 },
    root: { ticks: 30 },
    curse: { ticks: 90, damagePerSecond: 3, lifesteal: 1 },
    empowered: { ticks: 300, damageMultiplier: 1.5 },
  },
  interactions: { stormVsSlowedMultiplier: 2, tideExtinguishesBurn: true },
  round: {
    roundsToWin: 2,
    maxRounds: 5,
    durationTicks: 3600,
    huntEndTick: 1200,
    convergenceEndTick: 2400,
    convergenceRadius: 10,
    finalRadius: 4,
    zoneDamagePerSecond: 10,
  },
  death: {
    lives: 3,
    respawnTicks: 90,
    revive: { radius: 1.5, ticks: 60, hpFraction: 0.5 },
    spectre: { moveMultiplier: 0.7, hauntRange: 6, hauntCooldownTicks: 150 },
  },
  beasts: {
    count: 0,
    maxHp: 30,
    radius: 0.6,
    moveSpeed: 4,
    damage: 5,
    attackRange: 0.6,
    attackCooldownTicks: 30,
    aggroTicks: 150,
    leash: 10,
    essenceDamagePerStack: 0.5,
    maxEssence: 2,
  },
  shrines: { count: 2, radius: 1.5, captureTicks: 60, healFraction: 0.5 },
};
