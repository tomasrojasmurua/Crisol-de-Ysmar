import type { GameMode, GameRules } from '@crisol/core';
import { FEATURES } from './features';
import { MAP, MAP_RADIUS, PLAZA_ARENA_RADIUS, PLAZA_MAP } from './map';
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
    // 1 elemento: 0,17 s · 2 elementos: 0,3 s · 3 elementos: 0,6 s.
    // Ningún tejido sale en menos de 0,15 s: el rival alcanza a ver el aviso aunque haya lag.
    castTicksByLength: [5, 9, 18],
    fatigueTicks: 90,
    // Arrastrando ✦: si el objetivo queda a 2 m del punto elegido, el hechizo cae sobre él.
    aimSnap: 2,
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
    // Era de hielo: 1,2 segundos congelado.
    frozen: { ticks: 36 },
    // Pesadilla: 2 segundos dormido, salvo que lo despierten a golpes.
    asleep: { ticks: 60 },
    // Fantasma: 4 segundos atravesando todo.
    phased: { ticks: 120 },
    // Maremoto: 70% más lento por 2 segundos.
    soaked: { ticks: 60, moveMultiplier: 0.3 },
    // Fuente termal: se teje 40% más rápido mientras se esté dentro.
    quickened: { ticks: 6, castMultiplier: 0.6 },
    // Vaho: se teje la mitad de rápido mientras se esté dentro.
    sluggish: { ticks: 6, castMultiplier: 2 },
    // Purificación: 3 segundos sin estados dañinos.
    warded: { ticks: 90 },
    // Ácido: 30% más de daño por 4 segundos.
    exposed: { ticks: 120, damageMultiplier: 1.3 },
    // Combustión: 5 segundos; cada hechizo que teje le hace 10.
    combusting: { ticks: 150, damage: 10 },
    // Plaga: 10 por segundo por 4 segundos; salta a 2 m.
    plague: { ticks: 120, damagePerSecond: 10, spreadRadius: 2 },
    // Vínculo vital: 6 segundos.
    linked: { ticks: 180 },
    insight: { ticks: 300 },
    hunting: { ticks: 180, moveMultiplier: 1.3 },
    tracked: { ticks: 450 },
    unseen: { ticks: 240 },
    shrouded: { ticks: 6 },
    disguised: { ticks: 240 },
    shadowed: { ticks: 180 },
    leeching: { ticks: 150, lifesteal: 0.5 },
    magma: { ticks: 150, moveMultiplier: 0.75, trailEvery: 8 },
    surfing: { ticks: 150, moveMultiplier: 1.8 },
    deepRooted: { ticks: 120, rangeMultiplier: 1.5 },
    panther: { ticks: 180, moveMultiplier: 1.5, damage: 12, reach: 1.8, intervalTicks: 20 },
    // Aturdido: 1 segundo sin moverse ni tejer (cada hechizo da su tiempo).
    stunned: { ticks: 30 },
    // Instante: 1,5 segundos detenido en el tiempo.
    halted: { ticks: 45 },
    // Mil pasos: 1,5 segundos intocable.
    untouchable: { ticks: 45 },
    // Escaldar: 4 segundos sin escudos.
    scalded: { ticks: 120 },
    // Ortiga: 6 segundos devolviendo la mitad del daño.
    thorny: { ticks: 180, reflect: 0.5 },
    // Semilla de fuego: 8 segundos; al recibir un golpe, 40 en 3 m.
    emberSeed: { ticks: 240, damage: 40, radius: 3 },
    // Hoguera: los elementos descansan el doble de rápido mientras se esté cerca.
    kindled: { ticks: 6, restMultiplier: 2 },
    // Marchitar: los elementos no descansan mientras se esté dentro.
    withered: { ticks: 6 },
    // Diluvio: no se salta ni se teletransporta mientras se esté dentro.
    grounded: { ticks: 6 },
    // Hambre de ceniza: 8 segundos; se cumple si cae o baja de 25% de vida.
    ashHunger: { ticks: 240, threshold: 0.25 },
    // Venganza: 6 segundos; si cae o baja de 20%, el marcado recibe 45.
    vengeful: { ticks: 180, threshold: 0.2, damage: 45 },
    // Mal de ojo: 5 segundos con los botones cambiados de lugar.
    hexed: { ticks: 150 },
    // Juramento: 3 segundos sin poder hacerse daño.
    oath: { ticks: 90 },
    // Injerto: 6 segundos repartiendo el daño mitad y mitad.
    grafted: { ticks: 180, share: 0.5 },
    // Podredumbre: 5 segundos en que curarse hace daño.
    rotting: { ticks: 150 },
    // Profundidad: 5 segundos; cada golpe llega repartido en los 5 siguientes.
    depth: { ticks: 150, spreadTicks: 150 },
    // Renacer: 6 segundos; si cae, vuelve con 40% de vida.
    rebirth: { ticks: 180, hpFraction: 0.4 },
    // Forja: 6 segundos para que el próximo hechizo de daño pegue el doble.
    forged: { ticks: 180, damageMultiplier: 2 },
    // Sobrecarga: los próximos 3 hechizos en 5 segundos salen con el aviso mínimo.
    overcharged: { ticks: 150, charges: 3 },
    // Propulsión: 4 segundos; cada hechizo da un salto de 3 m que deja fuego.
    propelled: { ticks: 120, distance: 3, leapTicks: 6 },
    // Rocío: 6 segundos; cada hechizo cura 8 a tu equipo a 8 m.
    dewy: { ticks: 180, heal: 8, radius: 8 },
    // Eco ardiente: 10 segundos para que el próximo hechizo salga dos veces, la segunda 1 s después.
    echoing: { ticks: 300, delayTicks: 30 },
    // Hurto: 6 segundos para robarle el próximo hechizo.
    robbed: { ticks: 180 },
    // Bruma del olvido: 6 segundos sin poder repetir el último hechizo.
    forgetful: { ticks: 180 },
    // Réquiem: 3 segundos en que sus hechizos no hacen daño.
    muted: { ticks: 90 },
    // Pararrayos humano: 3 segundos atrayendo proyectiles a 6 m.
    attracting: { ticks: 90, radius: 6, pull: 0.25 },
    // Espejo de agua: 3 segundos devolviendo proyectiles.
    mirroring: { ticks: 90 },
    // Llanto del abismo: 5 segundos reteniendo los proyectiles a 3 m.
    wailing: { ticks: 150, radius: 3 },
    // Relámpago guiado: quieto mientras dirige el rayo.
    steering: { ticks: 60 },
    // Cosecha de almas: 15 segundos; golpes de 15 o más dan Esencia (hasta 3), y las caídas a 10 m también.
    // Cortocircuito armado: 2 segundos esperando que un rival cercano teja.
    primed: { ticks: 60 },
    harvesting: { ticks: 450, radius: 10, minHit: 15, maxStacks: 3 },
  },
  interactions: {
    tideExtinguishesBurn: true,
    // Choque de tejidos: los proyectiles opuestos chocan con medio metro de margen.
    clash: { margin: 0.5 },
    // Reacciones entre estados. Se revisan en orden; sale solo la primera que calce.
    combos: [
      // Conducción: Tormenta sobre alguien empapado lo aturde 0,6 s y seca el agua.
      {
        id: 'conduction',
        element: 'tormenta',
        status: 'soaked',
        damageMultiplier: 1.2,
        consume: true,
        applies: [{ status: 'stunned', ticks: 18 }],
      },
      // Quiebre: Tormenta sobre alguien congelado rompe el hielo con 50% más de daño.
      {
        id: 'shatter',
        element: 'tormenta',
        status: 'frozen',
        damageMultiplier: 1.5,
        consume: true,
        applies: [],
      },
      // Leña: Brasa sobre alguien enraizado prende la madera: 25% más y quema 3 s.
      {
        id: 'kindling',
        element: 'brasa',
        status: 'root',
        damageMultiplier: 1.25,
        consume: false,
        applies: [{ status: 'burn', ticks: 90 }],
      },
      // Vapor: Marea sobre alguien que arde apaga el fuego y lo escalda: 3 s sin escudos.
      {
        id: 'steam',
        element: 'marea',
        status: 'burn',
        damageMultiplier: 1.2,
        consume: true,
        applies: [{ status: 'scalded', ticks: 90 }],
      },
      // Brasa maldita: Umbra sobre alguien que arde vuelve el fuego maldición (te roba vida).
      {
        id: 'ashenCurse',
        element: 'umbra',
        status: 'burn',
        damageMultiplier: 1.2,
        consume: true,
        applies: [{ status: 'curse', ticks: 90 }],
      },
      // Lodazal: Raíz sobre alguien empapado lo hunde en el barro: enraizado 1 s.
      {
        id: 'mire',
        element: 'raiz',
        status: 'soaked',
        damageMultiplier: 1,
        consume: true,
        applies: [{ status: 'root', ticks: 30 }],
      },
    ],
  },
  round: {
    // Mejor de 3, con tope de 5 por si hay empates.
    roundsToWin: 2,
    maxRounds: 5,
    // Caza hasta el minuto 1, Convergencia hasta el 2 y Duelo final hasta el 3; después,
    // muerte súbita. La ronda no se acaba por tiempo: dura lo que dure el combate.
    durationTicks: 3 * 60 * 30,
    huntEndTick: 1 * 60 * 30,
    convergenceEndTick: 2 * 60 * 30,
    convergenceRadius: 14,
    finalRadius: 4,
    zoneDamagePerSecond: 12,
    // Muerte súbita: la zona se cierra del todo en 20 s y quema 4 más por cada segundo.
    suddenDeath: { shrinkTicks: 20 * 30, damageRampPerSecond: 4 },
  },
  // Los proyectiles básicos llegan a 14 m: más allá no tiene sentido apuntar solo.
  aim: { range: 14, lockRange: 20, frontWeight: 0.6 },
  death: {
    lives: 3,
    // 4 segundos para reaparecer en el borde.
    respawnTicks: 120,
    // Un aliado al lado durante 3 segundos te levanta con 40% de vida.
    revive: { radius: 1.6, ticks: 90, hpFraction: 0.4 },
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
    // Dos bestias por campamento; un campamento vacío vuelve a poblarse en 45 segundos.
    packSize: 2,
    respawnTicks: 45 * 30,
    // El Guardián despierta en la plaza a los 40 segundos de Caza.
    guardian: {
      maxHp: 260,
      radius: 1.3,
      moveSpeed: 3.4,
      damage: 16,
      attackRange: 1.1,
      attackCooldownTicks: 42,
      aggroTicks: 240,
      leash: 8,
      spawnTick: 40 * 30,
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

/**
 * El 1v1 en la plaza: arena chica, sin jungla ni bestias, para que el duelo empiece de inmediato
 * y se lea bien. El resto de los números es el mismo.
 */
export const DUEL_RULES: GameRules = {
  ...GAME_RULES,
  arenaRadius: PLAZA_ARENA_RADIUS,
  map: PLAZA_MAP,
  beasts: { ...GAME_RULES.beasts, count: 0 },
};

/** Las reglas de un modo: el 1v1 va en la plaza; 2v2 en adelante, en la jungla. */
/**
 * Las reglas con el largo de ronda y la cantidad de rondas que eligió la sala. Las fases se
 * reparten igual que en la ronda de 3 minutos (un tercio cada una) y el Guardián despierta en
 * la misma proporción de la Caza.
 */
export function withRoundLength(rules: GameRules, minutes: number, bestOf: number): GameRules {
  const duration = Math.round(minutes * 60 * 30);
  const scale = duration / rules.round.durationTicks;
  return {
    ...rules,
    round: {
      ...rules.round,
      roundsToWin: Math.ceil(bestOf / 2),
      // Con empates (todos caen a la vez) puede hacer falta alguna más.
      maxRounds: bestOf + 2,
      durationTicks: duration,
      huntEndTick: Math.round(rules.round.huntEndTick * scale),
      convergenceEndTick: Math.round(rules.round.convergenceEndTick * scale),
    },
    beasts: {
      ...rules.beasts,
      guardian: {
        ...rules.beasts.guardian,
        spawnTick: Math.round(rules.beasts.guardian.spawnTick * scale),
      },
    },
  };
}

/** Las reglas de una sala en red: su modo, su tiempo por ronda y sus rondas. */
export function rulesForRoom(settings: {
  readonly mode: GameMode;
  readonly minutes: number;
  readonly bestOf: number;
}): GameRules {
  return withRoundLength(rulesForMode(settings.mode), settings.minutes, settings.bestOf);
}

export function rulesForMode(mode: GameMode): GameRules {
  return mode.kind === 'duel' && !FEATURES.duelInJungle ? DUEL_RULES : GAME_RULES;
}
