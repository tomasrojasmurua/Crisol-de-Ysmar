import { ELEMENT_IDS, type ElementId, type SpellId, spellOf, type Weave } from '@crisol/core';

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
 * Los de 1 y 2 elementos usan el de su hechizo; un tejido de 3 cuyo Gran hechizo aún no existe
 * es el eco del hechizo de sus dos primeros elementos, teñido por el tercero.
 */
export function spellName(weave: Weave): string {
  const own = spellOf(weave);
  if (!own) return '';
  const name = SPELL_NAMES[own];
  const third = weave[2];
  return third ? `${name} · eco de ${TOUCH[third]}` : name;
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
