import type { GameRules } from '@crisol/core';
import { MAP, MAP_RADIUS } from './map';
import { SPELL_RULES } from './spells';

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
  spells: SPELL_RULES,
  statuses: {
    burn: { ticks: 90, damagePerSecond: 4 },
    slow: { ticks: 75, moveMultiplier: 0.55 },
    root: { ticks: 36 },
    curse: { ticks: 90, damagePerSecond: 3, lifesteal: 0.5 },
    // La bendición de un santuario: 12 segundos con 25% más de daño.
    empowered: { ticks: 360, damageMultiplier: 1.25 },
    // Géiser: 1 segundo por los aires.
    airborne: { ticks: 30 },
    // Ataúd helado: 1,5 segundos dentro del hielo.
    stasis: { ticks: 45 },
    // Velo: 4 segundos invisible; te ven a 2 m y el primer ataque hace 30% más.
    veiled: { ticks: 120, revealRadius: 2, damageMultiplier: 1.3 },
    // Savia: 15 de vida en 3 segundos.
    regen: { ticks: 90, healPerSecond: 5 },
    // Paso sombrío: 1,2 segundos sin poder tejer.
    silenced: { ticks: 36 },
    // Esporas: 30% menos de daño por 3 segundos.
    weak: { ticks: 90, damageMultiplier: 0.7 },
    // Ceguera: 3 segundos viendo solo 3 m alrededor.
    blind: { ticks: 90, sightRadius: 3 },
    // Corriente: 50% más rápido mientras vas a favor del río.
    haste: { ticks: 6, moveMultiplier: 1.5 },
  },
  interactions: {
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
    // Solo en mapas sin campamentos: una por elemento.
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
    // Dos bestias por campamento; un campamento vacío vuelve a poblarse en 75 segundos.
    packSize: 2,
    respawnTicks: 75 * 30,
    // El Guardián despierta en la plaza al minuto de Caza.
    guardian: {
      maxHp: 260,
      radius: 1.3,
      moveSpeed: 3.4,
      damage: 16,
      attackRange: 1.1,
      attackCooldownTicks: 42,
      aggroTicks: 240,
      leash: 8,
      spawnTick: 60 * 30,
      essenceReward: 1,
    },
  },
  shrines: {
    count: 2,
    radius: 1.8,
    // 4 segundos parado encima, sin rivales.
    captureTicks: 120,
    healFraction: 0.35,
  },
};
