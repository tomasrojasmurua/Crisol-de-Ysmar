import type { GameRules } from '@crisol/core';

/**
 * Los números de los hechizos propios (primera tanda). Valores de partida:
 * se ajustan jugando y con el simulador de balance. Tiempos en pasos (30 por segundo).
 */
export const SPELL_RULES: GameRules['spells'] = {
  // Brasa · Chispa: dardo rápido que quema.
  spark: { damage: 10, speed: 20, range: 14, radius: 0.25 },
  // Tormenta · Paso: 4 m hacia donde apuntas.
  step: { distance: 4, durationTicks: 4 },
  // Marea · Salpicón: cono corto que moja y ralentiza.
  splash: { damage: 6, range: 3.2, coneDot: 0.5 },
  // Raíz · Savia: la curación la da el estado `regen`.
  sap: {},
  // Umbra · Zarpa: golpe instantáneo que devuelve todo el daño como vida.
  claw: { damage: 6, range: 6, coneDot: 0.7, lifesteal: 1 },
  // Brasa → Brasa · Bola ígnea: lenta, grande y explota en 3 m.
  fireball: { damage: 30, speed: 10, range: 14, radius: 0.55, blastRadius: 3 },
  // Brasa → Tormenta · Cometa: 8 m envuelto en llamas; el rastro arde 3 s.
  comet: { distance: 8, durationTicks: 10, trailRadius: 0.9, trailTicks: 90, trailEvery: 2 },
  // Tormenta → Tormenta · Destello: 7 m al instante, también a través de árboles.
  blink: { distance: 7 },
  // Tormenta → Brasa · Rayo en cadena: 18, 12 y 8 de daño.
  chainLightning: { damages: [18, 12, 8], range: 9, coneDot: 0.75, bounceRange: 5 },
  // Marea → Brasa · Géiser: 0,6 s de aviso y por los aires 1 s.
  geyser: { damage: 12, range: 8, radius: 2, delayTicks: 18 },
  // Marea → Umbra · Ataúd helado: la duración la da el estado `stasis`.
  iceCoffin: {},
  // Raíz → Brasa · Estampida de espinas: 5 brotes de 8 en línea, uno cada 0,1 s.
  thornRush: { damage: 8, bursts: 5, spacing: 2, radius: 1.4, intervalTicks: 3 },
  // Raíz → Raíz · Muralla de raíces: 8 m de largo por 5 s.
  rootWall: { distance: 2.5, halfLength: 4, thickness: 0.4, durationTicks: 150 },
  // Umbra → Umbra · Velo: sus números están en el estado `veiled`.
  veil: {},
  // Umbra → Brasa · Drenaje: 8 por segundo hasta 3 s.
  drain: { damagePerSecond: 8, range: 7, coneDot: 0.7, breakRange: 9, durationTicks: 90 },
};
