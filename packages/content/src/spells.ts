import type { GameRules } from '@crisol/core';

/**
 * Los números de los hechizos. Valores de partida:
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
  // Brasa → Marea · Obsidiana: absorbe 40 por 4 s y estalla en 2,5 m con 15.
  obsidian: { shield: 40, durationTicks: 120, damage: 15, blastRadius: 2.5 },
  // Brasa → Raíz · Fuego fatuo: persigue 6 s, explota con 20; un golpe lo apaga.
  wisp: { hp: 1, radius: 0.4, durationTicks: 180, damage: 20, speed: 4.6, seekRange: 14 },
  // Brasa → Umbra · Ignición: 3 s después devuelve el 40% de lo que recibió.
  ignite: { fraction: 0.4, range: 9, coneDot: 0.75, durationTicks: 90 },
  // Tormenta → Marea · Ventisca: torbellino de 3,5 m por 4 s.
  blizzard: { range: 6, radius: 3.5, durationTicks: 120, deflectAngle: 1 },
  // Tormenta → Raíz · Pararrayos: 8 s, un rayo de 5 por segundo a 7 m; cae con dos golpes.
  lightningRod: {
    hp: 2,
    radius: 0.45,
    durationTicks: 240,
    distance: 1.5,
    damage: 5,
    range: 7,
    intervalTicks: 30,
  },
  // Tormenta → Umbra · Paso sombrío: detrás del rival a 6 m (el silencio lo da `silenced`).
  shadowStep: { range: 6, coneDot: 0.6, behind: 1.3 },
  // Marea → Tormenta · Corriente: río de 10 m por 4 s.
  current: { length: 10, halfWidth: 1.4, durationTicks: 120 },
  // Marea → Marea · Muro de hielo: 5 m por 4 s; solo frena a los rivales.
  iceWall: { distance: 2, halfLength: 2.5, thickness: 0.45, durationTicks: 120 },
  // Marea → Raíz · Manantial: fuente de 3 m por 5 s que cura 6 por segundo.
  spring: { range: 0, radius: 3, durationTicks: 150, healPerSecond: 6 },
  // Raíz → Tormenta · Liana: 9 m; enraíza 0,8 s al rival que toca.
  vine: { range: 9, speed: 24, rootTicks: 24 },
  // Raíz → Marea · Guardián de musgo: 60 de vida por 10 s.
  mossGuardian: {
    hp: 60,
    radius: 0.7,
    durationTicks: 300,
    damage: 6,
    speed: 5,
    attackRange: 1.6,
    attackCooldownTicks: 30,
    aggroRange: 6,
    followDistance: 1.8,
  },
  // Raíz → Umbra · Esporas: nube de 3 m por 4 s (el daño menor lo da `weak`).
  spores: { range: 5, radius: 3, durationTicks: 120 },
  // Umbra → Tormenta · Señuelo: invisible 1,5 s y un doble corre 2,5 s.
  decoy: { hp: 1, radius: 0.5, durationTicks: 75, veilTicks: 45, speed: 5.5 },
  // Umbra → Marea · Ceguera: proyectil de sombra (la ceguera la da `blind`).
  blinding: { damage: 6, speed: 16, range: 12, radius: 0.3 },
  // Umbra → Raíz · Grillete: 4 s atado; si se aleja 4 m, enraizado 1,5 s y 15 de daño.
  shackle: { range: 8, coneDot: 0.7, durationTicks: 120, leash: 4, damage: 15, rootTicks: 45 },
};
