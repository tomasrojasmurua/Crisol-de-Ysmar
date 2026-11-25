import type { BotLevel, BotProfile } from '@crisol/core';
import { BOT_TASTE } from './botTaste';

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
    improvise: 0.25,
    memoryTicks: 30,
    // Toca un elemento cada 0,2 s y tarda 0,4 s en reaccionar a lo que viene.
    tapTicks: 6,
    dodgeDelayTicks: 12,
    patience: 0.3,
    taste: BOT_TASTE,
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
    improvise: 0.1,
    memoryTicks: 90,
    // Un toque cada 0,13 s y 0,27 s para reaccionar: lo de una persona atenta.
    tapTicks: 4,
    dodgeDelayTicks: 8,
    patience: 0.6,
    // Antes de elegir prueba sus 2 mejores opciones jugando 1,5 s hacia adelante.
    lookahead: 2,
    taste: BOT_TASTE,
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
    improvise: 0.04,
    memoryTicks: 150,
    // Un toque cada 0,1 s y 0,17 s para reaccionar: lo mejor que hace una persona.
    tapTicks: 3,
    dodgeDelayTicks: 5,
    patience: 0.8,
    // Prueba sus 4 mejores opciones: así gana por pensar mejor, no por tocar más rápido.
    lookahead: 4,
    taste: BOT_TASTE,
  },
};

/** Cómo se llama cada dificultad en el menú y en la sala. */
export const BOT_LEVEL_NAMES: Readonly<Record<BotLevel, string>> = {
  apprentice: 'Aprendiz',
  duelist: 'Duelista',
  master: 'Maestro',
};
