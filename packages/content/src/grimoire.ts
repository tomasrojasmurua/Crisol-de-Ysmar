import {
  ELEMENT_IDS,
  type ElementId,
  SPELL_WEAVES,
  type SpellId,
  spellOf,
  type Weave,
} from '@crisol/core';

/** Los nombres de los hechizos propios. */
export const SPELL_NAMES: Readonly<Record<SpellId, string>> = {
  spark: 'Chispa',
  step: 'Paso',
  splash: 'Salpicón',
  sap: 'Savia',
  claw: 'Zarpa',
  fireball: 'Bola ígnea',
  comet: 'Cometa',
  blink: 'Destello',
  chainLightning: 'Rayo en cadena',
  geyser: 'Géiser',
  iceCoffin: 'Ataúd helado',
  thornRush: 'Estampida de espinas',
  rootWall: 'Muralla de raíces',
  veil: 'Velo',
  drain: 'Drenaje',
  obsidian: 'Obsidiana',
  wisp: 'Fuego fatuo',
  ignite: 'Ignición',
  blizzard: 'Ventisca',
  lightningRod: 'Pararrayos',
  shadowStep: 'Paso sombrío',
  current: 'Corriente',
  iceWall: 'Muro de hielo',
  spring: 'Manantial',
  vine: 'Liana',
  mossGuardian: 'Guardián de musgo',
  spores: 'Esporas',
  decoy: 'Señuelo',
  blinding: 'Ceguera',
  shackle: 'Grillete',
  meteor: 'Meteoro',
  fireRain: 'Lluvia de fuego',
  blackFlame: 'Llama negra',
  emberStride: 'Paso de ascuas',
  darkComet: 'Cometa negro',
  skySpear: 'Lanza del cielo',
  tempest: 'Tempestad',
  hurricane: 'Huracán',
  swap: 'Intercambio',
  erraticOrb: 'Orbe errático',
  iceAge: 'Era de hielo',
  cauldron: 'Hervidero',
  steamJet: 'Chorro de vapor',
  drown: 'Ahogo',
  mangrove: 'Manglar',
  tidalWave: 'Maremoto',
  rootCatapult: 'Catapulta de raíz',
  sowing: 'Siembra',
  thornRing: 'Anillo de zarzas',
  treeStride: 'Paso entre árboles',
  soulPyre: 'Pira de almas',
  portal: 'Portal',
  phantom: 'Fantasma',
  abyss: 'Abismo',
  nightmare: 'Pesadilla',
  ashBird: 'Ave de ceniza',
  wanderingSparks: 'Chispas errantes',
  magmaGolem: 'Gólem de magma',
  glacier: 'Glaciar vivo',
  swarm: 'Enjambre',
  rootPack: 'Manada de raíces',
  ancientTree: 'Árbol ancestral',
  shadowTwin: 'Gemelo sombrío',
  carnivore: 'Planta carnívora',
  hotSpring: 'Fuente termal',
  tailwind: 'Viento de cola',
  bubble: 'Burbuja',
  lifeWater: 'Agua de vida',
  healingRain: 'Lluvia de vida',
  sacrifice: 'Sacrificio',
  garden: 'Jardín',
  lifeLink: 'Vínculo vital',
  immolation: 'Inmolación',
  stormEye: 'Ojo del huracán',
  purify: 'Purificación',
  soulTide: 'Marea de almas',
  combustion: 'Combustión',
  speedTheft: 'Robo de velocidad',
  acid: 'Ácido',
  mist: 'Vaho',
  eclipse: 'Eclipse',
  plague: 'Plaga',
};

/** Lo que agrega cada elemento cuando no va primero. */
const TOUCH: Record<ElementId, string> = {
  brasa: 'brasas',
  tormenta: 'trueno',
  marea: 'escarcha',
  raiz: 'espinas',
  umbra: 'sombra',
};

/**
 * El nombre de un conjuro en el Grimorio. Cada uno de los 155 tejidos tiene un nombre propio.
 * Cada tejido usa el nombre de su hechizo; un tejido de 3 cuyo Gran hechizo aún no existe
 * es el eco del hechizo de sus dos primeros elementos, teñido por el tercero.
 */
export function spellName(weave: Weave): string {
  const own = spellOf(weave);
  if (!own) return '';
  const name = SPELL_NAMES[own];
  const third = weave[2];
  const isEcho = third !== undefined && SPELL_WEAVES[own].length < weave.length;
  return isEcho ? `${name} · eco de ${TOUCH[third]}` : name;
}

/** Clave estable de un tejido, para guardarlo en el Grimorio. */
export function weaveKey(weave: Weave): string {
  return weave.join('-');
}

/** Todos los tejidos posibles, de 1 a 3 elementos, ordenados por largo. */
export const ALL_WEAVES: readonly Weave[] = (() => {
  const weaves: ElementId[][] = ELEMENT_IDS.map((e) => [e]);
  for (const length of [2, 3]) {
    for (const prefix of weaves.filter((w) => w.length === length - 1)) {
      for (const e of ELEMENT_IDS) weaves.push([...prefix, e]);
    }
  }
  return weaves;
})();
