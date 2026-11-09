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

  // Grandes hechizos (3 elementos), primera tanda.

  // Brasa → Brasa → Brasa · Meteoro: 1,5 s de aviso, 60 de daño y el cráter arde 4 s.
  meteor: {
    damage: 60,
    range: 14,
    radius: 2.5,
    delayTicks: 45,
    scorchRadius: 2,
    scorchTicks: 120,
  },
  // Brasa → Brasa → Tormenta · Lluvia de fuego: 4 s; 8 por andanada a quien se mueva a 10 m.
  fireRain: {
    damage: 8,
    radius: 10,
    durationTicks: 120,
    intervalTicks: 30,
    scorchRadius: 0.9,
    scorchTicks: 60,
  },
  // Brasa → Umbra → Marea · Llama negra: atraviesa muros, escudos e invocaciones.
  blackFlame: { damage: 28, speed: 16, range: 16, radius: 0.35 },
  // Brasa → Umbra → Tormenta · Paso de ascuas: a un suelo ardiendo a 15 m.
  emberStride: { range: 15 },
  // Brasa → Tormenta → Umbra · Cometa negro: te lleva junto al rival y lo silencia.
  darkComet: { damage: 12, speed: 22, range: 12, radius: 0.3, beside: 1.3 },
  // Tormenta → Tormenta → Brasa · Lanza del cielo: 0,5 s de aviso, línea de 14 m, 45 de daño.
  skySpear: { damage: 45, length: 14, halfWidth: 0.9, delayTicks: 15 },
  // Tormenta → Tormenta → Tormenta · Tempestad: tres destellos de 6 m; 10 de daño al llegar.
  tempest: { jumps: 3, distance: 6, intervalTicks: 30, damage: 10, radius: 2 },
  // Tormenta → Tormenta → Marea · Huracán: avanza 12 m a 4 m/s y levanta por los aires.
  hurricane: { damage: 10, speed: 4, range: 12, radius: 1.4 },
  // Tormenta → Umbra → Tormenta · Intercambio: con cualquier mago a la vista a 12 m.
  swap: { range: 12, coneDot: 0.7 },
  // Tormenta → Brasa → Marea · Orbe errático: 12 m en 4 s, un rayo de 6 cada 0,5 s a 4 m.
  erraticOrb: { damage: 6, speed: 3, range: 12, radius: 0.45, zapRange: 4, intervalTicks: 15 },
  // Marea → Marea → Marea · Era de hielo: 0,8 s de aviso y congela a todos a 6 m.
  iceAge: { damage: 10, radius: 6, delayTicks: 24 },
  // Marea → Brasa → Brasa · Hervidero: 3 s para salir de un círculo de 3 m, o 50 de daño.
  cauldron: { damage: 50, range: 8, radius: 3, delayTicks: 90 },
  // Marea → Brasa → Tormenta · Chorro de vapor: 7 m hacia atrás y 16 de daño hacia adelante.
  steamJet: { distance: 7, durationTicks: 8, damage: 16, range: 4, coneDot: 0.6 },
  // Marea → Umbra → Brasa · Ahogo: 2 s a menos de 6,5 m; luego 30 de daño y 2 s silenciado.
  drown: {
    damage: 30,
    range: 6,
    coneDot: 0.7,
    breakRange: 6.5,
    durationTicks: 60,
    silenceTicks: 60,
  },
  // Marea → Raíz → Brasa · Manglar: 6 m por 6 s; frena proyectiles, no magos.
  mangrove: { distance: 2.5, halfLength: 3, thickness: 0.5, durationTicks: 180 },
  // Marea → Marea → Tormenta · Maremoto: ola de 10 m de ancho que empapa (lo lento lo da `soaked`).
  tidalWave: { damage: 12, speed: 9, range: 18, radius: 0.8, halfWidth: 5 },
  // Raíz → Tormenta → Brasa · Catapulta de raíz: 12 m en arco; enraíza 1,5 s a 3 m al caer.
  rootCatapult: { distance: 12, durationTicks: 18, radius: 3, damage: 10, rootTicks: 45 },
  // Raíz → Tormenta → Marea · Siembra: seis trampas por 15 s; se arman en 0,5 s.
  sowing: {
    range: 8,
    count: 6,
    spread: 2.2,
    radius: 0.6,
    armTicks: 15,
    durationTicks: 450,
    damage: 8,
  },
  // Raíz → Raíz → Brasa · Anillo de zarzas: 6 m de ancho por 4 s.
  thornRing: { range: 8, radius: 3, durationTicks: 120 },
  // Raíz → Umbra → Tormenta · Paso entre árboles: de un árbol a 2,5 m a otro a hasta 20 m.
  treeStride: { entryRange: 2.5, range: 20, coneDot: 0.5 },
  // Umbra → Umbra → Brasa · Pira de almas: hasta 3 rivales; a los 2 s, 25 más 10% de lo que les falta.
  soulPyre: { damage: 25, missingFraction: 0.1, range: 12, targets: 3, delayTicks: 60 },
  // Umbra → Brasa → Tormenta · Portal: una boca a tus pies y otra a 12 m, por 8 s.
  portal: { range: 12, radius: 1.1, durationTicks: 240 },
  // Umbra → Tormenta → Tormenta · Fantasma: sus números están en el estado `phased`.
  phantom: {},
  // Umbra → Tormenta → Marea · Abismo: 1 s de aviso; silencia 1,5 s a todos en 4 m.
  abyss: { damage: 8, range: 10, radius: 4, delayTicks: 30, silenceTicks: 45 },
  // Umbra → Umbra → Marea · Pesadilla: el sueño lo da el estado `asleep`.
  nightmare: { range: 9, coneDot: 0.75 },

  // Grandes hechizos, segunda tanda: invocaciones, apoyo, refuerzo y estados.

  // Brasa → Brasa → Raíz · Ave de ceniza: 12 m de ida y 12 de vuelta; 14 y quema a cada uno, en cada pasada.
  ashBird: { damage: 14, speed: 12, range: 24, radius: 1 },
  // Brasa → Raíz → Tormenta · Chispas errantes: tres por 8 s; salen al rival a 4 m con 10 y quema.
  wanderingSparks: {
    count: 3,
    hp: 1,
    radius: 0.3,
    durationTicks: 240,
    orbitRadius: 1.4,
    seekRange: 4,
    damage: 10,
    speed: 18,
  },
  // Brasa → Raíz → Umbra · Gólem de magma: 70 de vida por 12 s; al caer estalla en 2,5 m con 25.
  magmaGolem: {
    hp: 70,
    radius: 0.8,
    durationTicks: 360,
    damage: 25,
    blastRadius: 2.5,
    speed: 6,
    guardDistance: 1.8,
  },
  // Marea → Raíz → Raíz · Glaciar vivo: 10 s; congela (estado `frozen`) y hace 10 al primero que toca.
  glacier: { hp: 40, radius: 0.7, durationTicks: 300, damage: 10, speed: 3.5, seekRange: 14 },
  // Raíz → Tormenta → Tormenta · Enjambre: 5 s pegado al rival; lo frena y lo ciega mientras esté a 1,3 m.
  swarm: {
    hp: 20,
    radius: 0.6,
    durationTicks: 150,
    speed: 7,
    range: 12,
    coneDot: 0.6,
    reach: 1.3,
  },
  // Raíz → Raíz → Tormenta · Manada de raíces: fila de 4 m de ancho; 10 y 1,5 s enraizado.
  rootPack: { damage: 10, speed: 8, range: 14, radius: 0.7, halfWidth: 2, rootTicks: 45 },
  // Raíz → Raíz → Raíz · Árbol ancestral: 120 de vida por 15 s; cada 2 s, 12 y enraíza a 3 m.
  ancientTree: {
    hp: 120,
    radius: 1.3,
    durationTicks: 450,
    distance: 2.5,
    damage: 12,
    reach: 3,
    intervalTicks: 60,
  },
  // Umbra → Umbra → Tormenta · Gemelo sombrío: 40 de vida por 8 s; un dardo de 6 por segundo.
  shadowTwin: {
    hp: 40,
    radius: 0.5,
    durationTicks: 240,
    speed: 5,
    keepDistance: 6,
    damage: 6,
    boltSpeed: 18,
    boltRange: 12,
    intervalTicks: 30,
  },
  // Raíz → Umbra → Brasa · Planta carnívora: 10 s; se traga 1,5 s al primero a 1,6 m y lo escupe con 20.
  carnivore: {
    hp: 50,
    radius: 0.8,
    durationTicks: 300,
    distance: 3,
    reach: 1.6,
    swallowTicks: 45,
    damage: 20,
  },
  // Brasa → Marea → Raíz · Fuente termal: 4 m por 6 s (lo rápido lo da `quickened`).
  hotSpring: { range: 0, radius: 4, durationTicks: 180 },
  // Tormenta → Marea → Tormenta · Viento de cola: tú y aliados a 8 m, 5 s apurados (estado `haste`).
  tailwind: { radius: 8, hasteTicks: 150 },
  // Marea → Brasa → Marea · Burbuja: absorbe 60 por 4 s.
  bubble: { range: 10, coneDot: 0.6, shield: 60, durationTicks: 120 },
  // Marea → Brasa → Raíz · Agua de vida: revive a un aliado caído a 8 m con 30% de vida.
  lifeWater: { range: 8, hpFraction: 0.3 },
  // Marea → Marea → Raíz · Lluvia de vida: 4 m por 6 s; 6 por segundo y limpia estados.
  healingRain: { range: 6, radius: 4, durationTicks: 180, healPerSecond: 6 },
  // Marea → Umbra → Raíz · Sacrificio: le pasas 40 de tu vida a un aliado a 10 m.
  sacrifice: { range: 10, amount: 40 },
  // Raíz → Raíz → Marea · Jardín: cinco flores por 15 s; cada una cura 20.
  garden: { count: 5, spread: 2.5, radius: 0.6, durationTicks: 450, heal: 20 },
  // Umbra → Brasa → Raíz · Vínculo vital: la duración la da el estado `linked`.
  lifeLink: {},
  // Brasa → Brasa → Umbra · Inmolación: 5 s; 8 por segundo a 2,5 m y te curas con eso.
  immolation: { radius: 2.5, durationTicks: 150, damagePerSecond: 8, intervalTicks: 10 },
  // Tormenta → Marea → Raíz · Ojo del huracán: 4 s; nada entra a 2 m.
  stormEye: { radius: 2, durationTicks: 120 },
  // Marea → Raíz → Marea · Purificación: la inmunidad la da el estado `warded`.
  purify: {},
  // Umbra → Marea → Tormenta · Marea de almas: 12 m; te cura 10 por cada mago que cruza.
  soulTide: { damage: 0, speed: 10, range: 12, radius: 1.5, heal: 10 },
  // Brasa → Umbra → Brasa · Combustión: el daño lo da el estado `combusting`.
  combustion: { range: 10, coneDot: 0.7 },
  // Tormenta → Umbra → Umbra · Robo de velocidad: 4 s lento el rival y apurado tú.
  speedTheft: { range: 9, coneDot: 0.7, durationTicks: 120 },
  // Marea → Brasa → Umbra · Ácido: el daño extra lo da el estado `exposed`.
  acid: { damage: 8, speed: 15, range: 12, radius: 0.35 },
  // Marea → Marea → Brasa · Vaho: 3 m por 5 s (lo lento lo da `sluggish`).
  mist: { range: 7, radius: 3, durationTicks: 150 },
  // Umbra → Umbra → Umbra · Eclipse: 5 s; todos los rivales ven solo de cerca (estado `blind`).
  eclipse: { durationTicks: 150 },
  // Umbra → Marea → Raíz · Plaga: el daño y el contagio los da el estado `plague`.
  plague: { range: 9, coneDot: 0.7 },

  // Grandes hechizos, tercera tanda: mapa vivo, información, sigilo y transformaciones.

  // Brasa → Tormenta → Raíz · Incendio forestal: 14 m de frente de 3 m; 10 y quema a los rivales, y los árboles que toca no vuelven en la ronda.
  forestFire: { damage: 10, speed: 7, range: 14, radius: 1.2, halfWidth: 1.6 },
  // Raíz → Brasa → Brasa · Domar bestia: la bestia apuntada a 10 m pelea para ti 20 s (el Guardián no se doma).
  tameBeast: { range: 10, coneDot: 0.6, durationTicks: 600 },
  // Raíz → Brasa → Raíz · Brote de árbol: a 10 m, hasta el fin de la ronda; con un tercero se va el más viejo.
  treeSprout: { range: 10, radius: 0.8, maxPerWizard: 2 },
  // Tormenta → Marea → Brasa · Barómetro: la duración la da el estado `insight`.
  barometer: {},
  // Tormenta → Raíz → Umbra · Cazador: la duración y la velocidad las da el estado `hunting`.
  hunter: {},
  // Raíz → Tormenta → Umbra · Huella: a 14 m; la duración la da el estado `tracked`.
  track: { range: 14, coneDot: 0.7 },
  // Umbra → Tormenta → Raíz · Centinela: a 10 m por 60 s; ve todo a 8 m. Se rompe a golpes.
  sentinel: { hp: 30, radius: 0.4, durationTicks: 1800, range: 10, sightRadius: 8 },
  // Brasa → Marea → Umbra · Niebla carmesí: 7 m por 5 s a tus pies; adentro los rivales quedan ciegos.
  crimsonMist: { range: 0, radius: 7, durationTicks: 150 },
  // Marea → Tormenta → Raíz · Lluvia que borra: la duración la da el estado `unseen`.
  erasingRain: {},
  // Marea → Umbra → Tormenta · Espejismo: tres copias por 4 s a 2 m; un golpe las deshace.
  mirage: { hp: 1, radius: 0.5, durationTicks: 120, count: 3, spread: 2 },
  // Raíz → Raíz → Umbra · Bosque maldito: 4 m por 6 s (lo invisible lo da `shrouded`).
  cursedGrove: { range: 8, radius: 4, durationTicks: 180 },
  // Raíz → Umbra → Marea · Alfombra de musgo: 6 m por 8 s a tus pies.
  mossCarpet: { range: 0, radius: 6, durationTicks: 240 },
  // Umbra → Tormenta → Umbra · Ilusión de tejido: la duración la da el estado `disguised`.
  weaveIllusion: {},
  // Umbra → Raíz → Umbra · Sombra prestada: a 14 m; la duración la da el estado `shadowed`.
  borrowedShadow: { range: 14, coneDot: 0.7 },
  // Brasa → Marea → Marea · Forma de magma: el suelo que pisas arde 3 s en 1 m.
  magmaForm: { trailRadius: 1, trailTicks: 90 },
  // Marea → Tormenta → Tormenta · Surf: la duración y la velocidad las da el estado `surfing`.
  surf: {},
  // Raíz → Tormenta → Raíz · Raíces profundas: la duración y el alcance los da el estado `deepRooted`.
  deepRoots: {},
  // Umbra → Raíz → Tormenta · Pantera de sombra: la velocidad y los zarpazos los da el estado `panther`.
  shadowPanther: {},

  // Grandes hechizos, cuarta tanda: terreno, detonadores, tiempo, copias, contrahechizos y más.

  // Brasa → Brasa → Marea · Erupción: volcán de 1,4 m por 6 s a 8 m; cada 0,7 s una roca de 15 que quema, a hasta 5 m.
  eruption: {
    range: 8,
    radius: 1.4,
    durationTicks: 180,
    damage: 15,
    rockRadius: 1.3,
    rockDelayTicks: 15,
    intervalTicks: 20,
    throwRadius: 5,
  },
  // Brasa → Tormenta → Brasa · Granada solar: una esfera por 6 s a 8 m; explota con 40 en 3 m si la toca un hechizo tuyo.
  solarGrenade: { range: 8, radius: 0.6, durationTicks: 180, damage: 40, blastRadius: 3 },
  // Brasa → Tormenta → Tormenta · Propulsión: la duración y el salto los da el estado `propelled`.
  propulsion: {},
  // Brasa → Tormenta → Marea · Monzón: tormenta de 6 m por 5 s a 8 m; un rayo de 12 por segundo a cada rival adentro.
  monsoon: { range: 8, radius: 6, durationTicks: 150, damage: 12, intervalTicks: 30 },
  // Brasa → Marea → Brasa · Forja: el doble de daño lo da el estado `forged`.
  forge: {},
  // Brasa → Marea → Tormenta · Escaldar: cono de 6 m; 10, rompe escudos y no deja tener otros (estado `scalded`).
  scald: { damage: 10, range: 6, coneDot: 0.5 },
  // Brasa → Raíz → Brasa · Semilla de fuego: sobre un aliado a 10 m o sobre ti; la explosión la da el estado `emberSeed`.
  emberSeed: { range: 10, coneDot: 0.6 },
  // Brasa → Raíz → Marea · Humo de hoguera: columna de 4 m por 8 s a 6 m.
  bonfireSmoke: { range: 6, radius: 4, durationTicks: 240 },
  // Brasa → Raíz → Raíz · Hoguera: fogata de 3 m por 20 s a tus pies (el descanso lo da `kindled`).
  bonfire: { range: 0, radius: 3, durationTicks: 600 },
  // Brasa → Umbra → Raíz · Hambre de ceniza: marca a 10 m; si cae o baja de 25%, descansas todo y recuperas 30.
  ashHunger: { range: 10, coneDot: 0.6, heal: 30 },
  // Brasa → Umbra → Umbra · Eco ardiente: la espera la da el estado `echoing`.
  burningEcho: {},
  // Tormenta → Brasa → Brasa · Sobrecarga: las cargas las da el estado `overcharged`.
  overload: {},
  // Tormenta → Brasa → Tormenta · Pararrayos humano: el alcance lo da el estado `attracting`.
  humanRod: {},
  // Tormenta → Brasa → Raíz · Cortocircuito: armado 2 s; el primer rival a 8 m que teja pierde su hechizo y queda 1 s aturdido.
  shortCircuit: { range: 8, stunTicks: 30 },
  // Tormenta → Brasa → Umbra · Estruendo: a 6 m, el último elemento que usó cada rival queda 5 s cansado.
  thunderclap: { radius: 6, fatigueTicks: 150 },
  // Tormenta → Tormenta → Raíz · Círculo de tótems: triángulo de 3 m a 6 m por 6 s; cruzar una línea aturde 0,8 s.
  totemCircle: { range: 6, spread: 3, durationTicks: 180, stunTicks: 24, halfWidth: 0.35 },
  // Tormenta → Tormenta → Umbra · Mil pasos: intocable 1,5 s; 4 saltos de 14 entre rivales a 8 m.
  thousandSteps: { damage: 14, range: 8, hops: 4, intervalTicks: 9 },
  // Tormenta → Marea → Marea · Pista de hielo: 12 m por 6 s; quien entra se desliza a 12 m/s hasta el final.
  iceTrack: { length: 12, halfWidth: 1.2, durationTicks: 180, slideSpeed: 12 },
  // Tormenta → Marea → Umbra · Vendaval: cono de 9 m que apaga invocaciones, trampas y zonas rivales.
  gale: { range: 9, coneDot: 0.5 },
  // Tormenta → Raíz → Brasa · Relámpago guiado: 35 de daño; lo diriges 2 s mientras te quedas quieto.
  guidedBolt: { damage: 35, speed: 11, radius: 0.5, durationTicks: 60, turnRate: 0.15 },
  // Tormenta → Raíz → Tormenta · Tirolesa: cable de 14 m por 8 s; se viaja a 20 m/s.
  zipline: { length: 14, durationTicks: 240, speed: 20, grab: 0.8 },
  // Tormenta → Raíz → Marea · Crecimiento acelerado: 5 m por 4 s a tus pies (teje con `quickened`, corre con `haste`).
  acceleratedGrowth: { range: 0, radius: 5, durationTicks: 120 },
  // Tormenta → Raíz → Raíz · Red eléctrica: activa lo tuyo a 12 m; cada invocación da un rayo de 12 a 6 m.
  powerGrid: { radius: 12, damage: 12, reach: 6 },
  // Tormenta → Umbra → Brasa · Retroceso: se guarda dónde estabas cada 0,5 s; vuelves al de hace 3 s.
  rewind: { sampleTicks: 15, samples: 6 },
  // Tormenta → Umbra → Marea · Instante: rival a 9 m; la duración la da el estado `halted`.
  instant: { range: 9, coneDot: 0.7 },
  // Tormenta → Umbra → Raíz · Rayo de enlace: 4 s; si se separan a más de 6 m, el rival queda 1 s aturdido.
  linkBolt: { range: 9, coneDot: 0.6, durationTicks: 120, maxGap: 6, stunTicks: 30 },
  // Marea → Tormenta → Brasa · Sifón: dardo de 8; si acierta, roba una Esencia o un descanso.
  siphon: { damage: 8, speed: 18, range: 12, radius: 0.3 },
  // Marea → Tormenta → Marea · Diluvio: 8 m por 6 s a 6 m; nadie salta ni se teletransporta (estado `grounded`).
  deluge: { range: 6, radius: 8, durationTicks: 180 },
  // Marea → Tormenta → Umbra · Reflejo: el hechizo copiado espera 8 s tu próximo lanzamiento.
  reflection: { heldTicks: 240 },
  // Marea → Marea → Umbra · Espejo de agua: la duración la da el estado `mirroring`.
  waterMirror: {},
  // Marea → Raíz → Tormenta · Nenúfares: cuatro hojas en rombo de 10 m por 10 s.
  lilyPads: { count: 4, spread: 5, radius: 0.7, durationTicks: 300 },
  // Marea → Raíz → Umbra · Renacer: la duración y la vida las da el estado `rebirth`.
  rebirth: {},
  // Marea → Umbra → Marea · Profundidad: la duración y el reparto los da el estado `depth`.
  depth: {},
  // Marea → Umbra → Umbra · Bruma del olvido: a 6 m; el olvido lo da el estado `forgetful`.
  oblivionMist: { radius: 6 },
  // Raíz → Brasa → Tormenta · Polen: nube de 5 m por 6 s a 7 m; con Brasa explota con 50.
  pollen: { range: 7, radius: 5, durationTicks: 180, damage: 50 },
  // Raíz → Brasa → Marea · Hongo gigante: 80 de vida por 10 s a 6 m; al golpearlo frena 1,5 s a quien esté a 3 m.
  giantMushroom: {
    hp: 80,
    radius: 1.5,
    durationTicks: 300,
    range: 6,
    sporeRadius: 3,
    slowTicks: 45,
  },
  // Raíz → Brasa → Umbra · Ortiga: la duración y la devolución las da el estado `thorny`.
  nettle: {},
  // Raíz → Marea → Brasa · Fertilizar: tus invocaciones a 8 m, el doble de vida y daño por 6 s.
  fertilize: { radius: 8, durationTicks: 180, multiplier: 2 },
  // Raíz → Marea → Tormenta · Rocío: la duración y la cura las da el estado `dewy`.
  dew: {},
  // Raíz → Marea → Marea · Sequía: seca todo a 8 m y te cura 8 por cada cosa.
  drought: { radius: 8, healPerItem: 8 },
  // Raíz → Marea → Raíz · Injerto: un aliado a 10 m; el reparto lo da el estado `grafted`.
  graft: { range: 10, coneDot: 0.6 },
  // Raíz → Marea → Umbra · Podredumbre: rival a 9 m; la duración la da el estado `rotting`.
  rot: { range: 9, coneDot: 0.7 },
  // Raíz → Umbra → Raíz · Marchitar: 6 m por 6 s a 7 m (estado `withered`).
  wither: { range: 7, radius: 6, durationTicks: 180 },
  // Raíz → Umbra → Umbra · Hurto: rival a 10 m; lo robado espera 8 s tu próximo lanzamiento.
  pickpocket: { range: 10, coneDot: 0.6, heldTicks: 240 },
  // Umbra → Brasa → Brasa · Sombra fatal: rival a 10 m con menos de 25% de vida.
  fatalShadow: { range: 10, coneDot: 0.7, threshold: 0.25 },
  // Umbra → Brasa → Marea · Mal de ojo: rival a 10 m; la duración la da el estado `hexed`.
  evilEye: { range: 10, coneDot: 0.7 },
  // Umbra → Brasa → Umbra · Juramento: rival a 9 m; la duración la da el estado `oath`.
  oath: { range: 9, coneDot: 0.7 },
  // Umbra → Tormenta → Brasa · Sombra lanzada: a 10 m; 4 s para tocar ✦ sin tejer y aparecer en ella.
  thrownShadow: { distance: 10, durationTicks: 120 },
  // Umbra → Marea → Brasa · Réquiem: cono de 6 m; lo mudo lo da el estado `muted`.
  lament: { range: 6, coneDot: 0.5 },
  // Umbra → Marea → Marea · Llanto del abismo: la duración y el alcance los da el estado `wailing`.
  abyssWail: {},
  // Umbra → Marea → Umbra · Transfusión: rival a 10 m; una vez por ronda.
  transfusion: { range: 10, coneDot: 0.6 },
  // Umbra → Raíz → Brasa · Muñeco vudú: a 3 m por 6 s; el rival marcado a 10 m recibe lo que le pegues.
  voodooDoll: { hp: 1000, radius: 0.5, durationTicks: 180, range: 10, coneDot: 0.6, distance: 3 },
  // Umbra → Raíz → Marea · Cosecha de almas: la duración y los golpes los da el estado `harvesting`.
  soulHarvest: {},
  // Umbra → Raíz → Raíz · Mandrágora: escondida a 6 m por 30 s; se arma en 1 s y silencia 2 s.
  mandrake: { range: 6, radius: 0.7, durationTicks: 900, armTicks: 30, silenceTicks: 60 },
  // Umbra → Umbra → Raíz · Venganza: rival a 12 m; el golpe lo da el estado `vengeful`.
  vengeance: { range: 12, coneDot: 0.6 },
};
