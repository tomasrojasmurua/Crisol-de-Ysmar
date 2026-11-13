import type { ElementId, SpellId } from '@crisol/core';

/**
 * Una escuela: el set de principiante que el jugador elige al crear su hechicero. No bloquea
 * nada (los 155 hechizos siguen ahí); solo destaca 4 en el Grimorio y el tutorial los enseña.
 * Paso (Tormenta) lo aprenden todos para escapar y no cuenta dentro de los 4.
 *
 * Los sets se eligieron con el simulador (`pnpm escuelas`): Duelistas que solo tejen su set, con
 * la Afinidad en su elemento, ganan entre 45% y 55% contra las otras cuatro escuelas. Si se
 * cambia un set, la Afinidad o el balance de uno de estos hechizos, hay que volver a medir.
 */
export interface School {
  readonly element: ElementId;
  readonly name: string;
  /** Lo que la distingue, en pocas palabras, para la tarjeta de elección. */
  readonly style: string;
  /** Los 4 hechizos, en el orden en que los enseña el tutorial. */
  readonly spells: readonly SpellId[];
  /** Para qué sirve cada uno, en pocas palabras. */
  readonly roles: Readonly<Partial<Record<SpellId, string>>>;
  /** El combo del catálogo que el tutorial enseña y entrega. */
  readonly combo: string;
  /** Cómo lo cuenta el tutorial, si no basta con "primero esto, luego aquello". */
  readonly comboTip?: { readonly short: string; readonly text: string };
}

export const SCHOOLS: readonly School[] = [
  {
    element: 'brasa',
    name: 'Escuela de Brasa',
    style: 'Daño directo',
    spells: ['spark', 'fireball', 'fireRain', 'meteor'],
    roles: {
      spark: 'Dardo rápido que quema',
      fireball: 'Explosión fuerte',
      fireRain: 'Castiga al que se mueve',
      meteor: 'El golpe más fuerte, si no lo esquivan',
    },
    combo: 'blanco-quieto',
  },
  {
    element: 'tormenta',
    name: 'Escuela de Tormenta',
    style: 'Movilidad',
    spells: ['chainLightning', 'comet', 'lightningRod', 'tempest'],
    roles: {
      chainLightning: 'Daño instantáneo',
      comet: 'Escape con rastro de fuego',
      lightningRod: 'Poste que da rayos solo',
      tempest: 'Tres saltos con descarga',
    },
    combo: 'tormenta-electrica',
  },
  {
    element: 'marea',
    name: 'Escuela de Marea',
    style: 'Control',
    spells: ['splash', 'blizzard', 'lightningRod', 'iceAge'],
    roles: {
      splash: 'Cono que ralentiza',
      blizzard: 'Torbellino que frena y desvía',
      lightningRod: 'Poste que da rayos solo',
      iceAge: 'Congela alrededor',
    },
    combo: 'quiebre',
    comboTip: {
      short: 'Quiebre: Pararrayos y Era de hielo',
      text: 'Deja el Pararrayos junto al muñeco y congélalo con Era de hielo: el rayo que cae sobre el hielo lo quiebra con 50% más.',
    },
  },
  {
    element: 'raiz',
    name: 'Escuela de Raíz',
    style: 'Aguante',
    spells: ['sap', 'shackle', 'spring', 'garden'],
    roles: {
      sap: 'Te curas',
      shackle: 'Ata al rival a su lugar',
      spring: 'Fuente que cura',
      garden: 'Flores que curan al pisarlas',
    },
    combo: 'atado-y-a-salvo',
  },
  {
    element: 'umbra',
    name: 'Escuela de Umbra',
    style: 'Engaño y robo de vida',
    spells: ['claw', 'drain', 'blinding', 'spores'],
    roles: {
      claw: 'Golpe que roba vida',
      drain: 'Hilo que roba vida',
      blinding: 'El rival solo ve 3 m',
      spores: 'Nube que debilita al rival',
    },
    combo: 'hilo-a-ciegas',
  },
];

/** La escuela de un elemento. */
export function schoolOf(element: ElementId): School {
  const school = SCHOOLS.find((s) => s.element === element);
  if (!school) throw new Error(`Falta la escuela de ${element}`);
  return school;
}

/** Lo que teje un Duelista de esa escuela en el simulador: su set más Paso. */
export function schoolSpellbook(element: ElementId): readonly SpellId[] {
  const { spells } = schoolOf(element);
  return spells.includes('step') ? spells : [...spells, 'step'];
}
