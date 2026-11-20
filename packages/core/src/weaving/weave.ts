import type { ElementId } from '../elements';

/** Un tejido tiene de 1 a 3 elementos. El orden importa y se pueden repetir. */
export const MAX_WEAVE_LENGTH = 3;

export type Weave = readonly ElementId[];

/**
 * La familia de cada hechizo según su primer elemento. Ya no decide qué hace el hechizo:
 * sirve para los Glifos que potencian una familia y para el color de los golpes.
 */
export const SPELL_FORM_BY_ELEMENT = {
  brasa: 'projectile',
  marea: 'wall',
  raiz: 'trap',
  tormenta: 'leap',
  umbra: 'mark',
} as const satisfies Record<ElementId, string>;

export type SpellForm = (typeof SPELL_FORM_BY_ELEMENT)[ElementId];

/** Clave estable de un tejido, por ejemplo "brasa>marea". */
export function weaveKey(weave: Weave): string {
  return weave.join('>');
}
