import type { ElementId, SpellId } from '@crisol/core';

/**
 * Un linaje: el set de principiante que el jugador elige al crear su hechicero. No bloquea
 * nada (los 155 hechizos siguen ahí); solo destaca 4 en el Grimorio y el tutorial los enseña.
 * Paso (Tormenta) lo aprenden todos para escapar y no cuenta dentro de los 4.
 *
 * Los sets se eligieron con el simulador (`pnpm escuelas`): Duelistas que solo tejen su set, con
 * la Afinidad en su elemento, ganan entre 45% y 55% contra los otros cuatro linajes. Si se
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
  /**
   * Cómo lo cuenta el tutorial: por qué funciona, en una frase. La orden corta sale de los pasos
   * del combo ("Primero esto, después aquello") salvo que se diga otra.
   */
  readonly comboTip: { readonly short?: string; readonly text: string };
}

export const SCHOOLS: readonly School[] = [
  {
    element: 'brasa',
    name: 'Linaje de Brasa',
    style: 'Daño directo',
    spells: ['fireball', 'obsidian', 'comet', 'fireRain'],
    roles: {
      fireball: 'Daño: explosión fuerte',
      obsidian: 'Defensa: coraza que estalla',
      comet: 'Escape con rastro de fuego',
      fireRain: 'Control: castiga al que se mueve',
    },
    combo: 'blanco-quieto',
    comboTip: {
      text: 'Bajo la lluvia, moverse quema: el muñeco se queda quieto y la bola, que es lenta, no falla.',
    },
  },
  {
    element: 'tormenta',
    name: 'Linaje de Tormenta',
    style: 'Movilidad',
    spells: ['chainLightning', 'blizzard', 'lightningRod', 'tempest'],
    roles: {
      chainLightning: 'Daño instantáneo',
      blizzard: 'Defensa: frena y desvía proyectiles',
      lightningRod: 'Daño: poste que da rayos solo',
      tempest: 'Escape: tres saltos con descarga',
    },
    combo: 'tormenta-electrica',
    comboTip: {
      text: 'Deja el Pararrayos cerca del muñeco: sigue tirando rayos mientras tú saltas a su alrededor.',
    },
  },
  {
    element: 'marea',
    name: 'Linaje de Marea',
    style: 'Control',
    spells: ['geyser', 'lightningRod', 'iceAge', 'drown'],
    roles: {
      geyser: 'Control: lo lanza por los aires',
      lightningRod: 'Daño: poste que da rayos solo',
      iceAge: 'Defensa: congela a los que te rodean',
      drown: 'Daño y silencio: no puede tejer',
    },
    combo: 'quiebre',
    comboTip: {
      short: 'Primero Pararrayos, después Era de hielo',
      text: 'Deja el Pararrayos junto al muñeco y congélalo: el rayo que cae sobre el hielo hace 50% más de daño.',
    },
  },
  {
    element: 'raiz',
    name: 'Linaje de Raíz',
    style: 'Aguante',
    spells: ['thornRush', 'vine', 'mossGuardian', 'rootCatapult'],
    roles: {
      thornRush: 'Daño: espinas en línea',
      vine: 'Control: te lleva y lo enraíza',
      mossGuardian: 'Defensa: guardián que recibe los golpes',
      rootCatapult: 'Escape: salto largo que enraíza',
    },
    combo: 'liana-y-guardian',
    comboTip: {
      text: 'Invoca al Guardián y lánzale la Liana al muñeco: llegas, lo enraízas y el guardián lo alcanza.',
    },
  },
  {
    element: 'umbra',
    name: 'Linaje de Umbra',
    style: 'Engaño y robo de vida',
    spells: ['drain', 'blinding', 'veil', 'decoy'],
    roles: {
      drain: 'Daño: hilo que roba vida',
      blinding: 'Control: el rival solo ve 3 m',
      veil: 'Defensa: invisible 4 s',
      decoy: 'Escape: un doble lo engaña',
    },
    combo: 'hilo-a-ciegas',
    comboTip: {
      text: 'Ciego, el rival no ve de quién alejarse y el hilo del Drenaje no se corta.',
    },
  },
];

/** El linaje de un elemento. */
export function schoolOf(element: ElementId): School {
  const school = SCHOOLS.find((s) => s.element === element);
  if (!school) throw new Error(`Falta el linaje de ${element}`);
  return school;
}

/** Lo que teje un Duelista de ese linaje en el simulador: su set más Paso. */
export function schoolSpellbook(element: ElementId): readonly SpellId[] {
  const { spells } = schoolOf(element);
  return spells.includes('step') ? spells : [...spells, 'step'];
}
