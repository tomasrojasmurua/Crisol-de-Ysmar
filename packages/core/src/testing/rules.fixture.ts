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
  },
  interactions: { stormVsSlowedMultiplier: 2, tideExtinguishesBurn: true },
};
