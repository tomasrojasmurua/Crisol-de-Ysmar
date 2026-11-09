import type { GameRules } from '@crisol/core';

/**
 * Todos los números del combate. Valores iniciales del Hito 1: el simulador de balance
 * y las pruebas con amigos dirán cuáles mover. Tiempos en pasos (30 por segundo), distancias en metros.
 */
export const GAME_RULES: GameRules = {
  arenaRadius: 16,
  wizard: {
    maxHp: 180,
    moveSpeed: 5.5,
    radius: 0.45,
    channelMoveMultiplier: 0.45,
  },
  weave: {
    // 1 elemento: 0,1 s · 2 elementos: 0,3 s · 3 elementos: 0,6 s
    castTicksByLength: [3, 9, 18],
    fatigueTicks: 90,
  },
  forms: {
    // Brasa primero: proyectil que vuela recto.
    projectile: { damage: 12, status: null, speed: 16, range: 16, radius: 0.35 },
    // Marea primero: muro que bloquea proyectiles y estalla al levantarse.
    wall: {
      damage: 6,
      status: 'slow',
      halfLength: 1.8,
      distance: 2.2,
      durationTicks: 120,
      pulseRadius: 2.5,
    },
    // Raíz primero: trampa que cae a los pies del rival y lo enraíza.
    trap: {
      damage: 10,
      status: 'root',
      range: 9,
      triggerRadius: 1.3,
      armTicks: 15,
      durationTicks: 300,
    },
    // Tormenta primero: salto que golpea al aterrizar.
    leap: { damage: 8, status: null, distance: 6, durationTicks: 8, impactRadius: 2 },
    // Umbra primero: marca instantánea que maldice y roba vida.
    mark: { damage: 4, status: 'curse', range: 11, coneDot: 0.6 },
  },
  modifiers: {
    brasa: { damageMultiplier: 1.35, status: 'burn', speedMultiplier: 1, rangeMultiplier: 1 },
    tormenta: { damageMultiplier: 1.1, status: null, speedMultiplier: 1.5, rangeMultiplier: 1.3 },
    marea: { damageMultiplier: 1, status: 'slow', speedMultiplier: 0.9, rangeMultiplier: 1 },
    raiz: { damageMultiplier: 1, status: 'root', speedMultiplier: 1, rangeMultiplier: 1 },
    umbra: { damageMultiplier: 1, status: 'curse', speedMultiplier: 1, rangeMultiplier: 1 },
  },
  statuses: {
    burn: { ticks: 90, damagePerSecond: 4 },
    slow: { ticks: 75, moveMultiplier: 0.55 },
    root: { ticks: 36 },
    curse: { ticks: 90, damagePerSecond: 3, lifesteal: 0.5 },
  },
  interactions: {
    stormVsSlowedMultiplier: 1.5,
    tideExtinguishesBurn: true,
  },
};
