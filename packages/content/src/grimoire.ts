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
};

/** Nombre base de cada forma, según el primer elemento del tejido. */
const BASE: Record<ElementId, { readonly noun: string; readonly alone: string }> = {
  brasa: { noun: 'Dardo', alone: 'Dardo ígneo' },
  tormenta: { noun: 'Salto', alone: 'Salto del rayo' },
  marea: { noun: 'Muro', alone: 'Muro de agua' },
  raiz: { noun: 'Trampa', alone: 'Trampa de raíces' },
  umbra: { noun: 'Marca', alone: 'Marca sombría' },
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
 * Los hechizos propios usan el suyo; un tejido de 3 cuyo Gran hechizo aún no existe es el eco
 * del hechizo de sus dos primeros elementos. El resto sigue la gramática antigua:
 * la forma la da el primer elemento y los siguientes la tiñen, en orden.
 */
export function spellName(weave: Weave): string {
  const [first, second, third] = weave;
  if (!first) return '';
  const own = spellOf(weave);
  if (own) {
    const name = SPELL_NAMES[own];
    return weave.length === 3 && third ? `${name} · eco de ${TOUCH[third]}` : name;
  }
  const base = BASE[first];
  if (!second) return base.alone;
  if (!third) return `${base.noun} de ${TOUCH[second]}`;
  if (second === third) return `${base.noun} de ${TOUCH[second]} doble`;
  return `${base.noun} de ${TOUCH[second]} y ${TOUCH[third]}`;
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
