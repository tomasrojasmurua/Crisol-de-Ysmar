import type { GameRules } from '@crisol/core';
import { MAP, MAP_RADIUS } from './map';

/**
 * Todos los números del combate. Valores iniciales del Hito 1: el simulador de balance
 * y las pruebas con amigos dirán cuáles mover. Tiempos en pasos (30 por segundo), distancias en metros.
 */
export const GAME_RULES: GameRules = {
  arenaRadius: MAP_RADIUS,
  map: MAP,
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
    // La bendición de un santuario: 12 segundos con 25% más de daño.
    empowered: { ticks: 360, damageMultiplier: 1.25 },
  },
  interactions: {
    stormVsSlowedMultiplier: 1.5,
    tideExtinguishesBurn: true,
  },
  round: {
    // Mejor de 3, con tope de 5 por si hay empates.
    roundsToWin: 2,
    maxRounds: 5,
    // 6 minutos: Caza hasta el 2, Convergencia hasta el 4 y Duelo final hasta el 6.
    durationTicks: 6 * 60 * 30,
    huntEndTick: 2 * 60 * 30,
    convergenceEndTick: 4 * 60 * 30,
    convergenceRadius: 14,
    finalRadius: 4,
    zoneDamagePerSecond: 12,
  },
  death: {
    lives: 3,
    // 4 segundos para reaparecer en el borde.
    respawnTicks: 120,
    // Un aliado al lado durante 3 segundos te levanta con 40% de vida.
    revive: { radius: 1.6, ticks: 90, hpFraction: 0.4 },
    spectre: { moveMultiplier: 0.8, hauntRange: 7, hauntCooldownTicks: 240 },
  },
  beasts: {
    // Una por elemento en cada ronda.
    count: 5,
    maxHp: 45,
    radius: 0.6,
    moveSpeed: 4.2,
    damage: 7,
    attackRange: 0.7,
    attackCooldownTicks: 36,
    aggroTicks: 180,
    leash: 9,
    // Cada Esencia suma 12% de daño a los conjuros con ese elemento, hasta 3.
    essenceDamagePerStack: 0.12,
    maxEssence: 3,
  },
  shrines: {
    count: 2,
    radius: 1.8,
    // 4 segundos parado encima, sin rivales.
    captureTicks: 120,
    healFraction: 0.35,
  },
};
