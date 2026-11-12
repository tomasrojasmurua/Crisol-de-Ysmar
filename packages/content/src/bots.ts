import type { BotLevel, BotProfile } from '@crisol/core';

/**
 * Las tres dificultades de la IA. Juegan con las mismas reglas que una persona; cambia qué tan
 * rápido piensan, qué tan bien apuntan, cuánto esquivan y leen al rival, y cuánto se repiten.
 */
export const BOT_PROFILES: Readonly<Record<BotLevel, BotProfile>> = {
  // Aprendiz: piensa lento, apunta con error, esquiva poco y no lee los Grandes hechizos.
  apprentice: {
    reactionTicks: [28, 52],
    aimError: 0.3,
    preferredDistance: 7,
    dodgeProjectiles: 0.25,
    dodgeStrikes: 0.3,
    readWeave: 0,
    repeatPenalty: 0.7,
    improvise: 0.35,
    memoryTicks: 30,
  },
  // Duelista: el rival de siempre, ahora sin quedarse quieto ciego y saliendo de los avisos.
  duelist: {
    reactionTicks: [14, 32],
    aimError: 0.14,
    preferredDistance: 7,
    dodgeProjectiles: 0.7,
    dodgeStrikes: 0.75,
    readWeave: 0.4,
    repeatPenalty: 0.45,
    improvise: 0.2,
    memoryTicks: 90,
  },
  // Maestro: rápido, certero, casi siempre esquiva y se corre al ver un Gran hechizo.
  master: {
    reactionTicks: [8, 18],
    aimError: 0.06,
    preferredDistance: 7.5,
    dodgeProjectiles: 0.9,
    dodgeStrikes: 0.95,
    readWeave: 0.85,
    repeatPenalty: 0.3,
    improvise: 0.06,
    memoryTicks: 150,
  },
};

/** Cómo se llama cada dificultad en el menú y en la sala. */
export const BOT_LEVEL_NAMES: Readonly<Record<BotLevel, string>> = {
  apprentice: 'Aprendiz',
  duelist: 'Duelista',
  master: 'Maestro',
};
