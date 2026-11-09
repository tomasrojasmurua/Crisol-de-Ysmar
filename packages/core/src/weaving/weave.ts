import { ELEMENT_COUNT, type ElementId } from '../elements';

/** Un tejido tiene de 1 a 3 elementos. El orden importa y se pueden repetir. */
export const MAX_WEAVE_LENGTH = 3;

export type Weave = readonly ElementId[];

export const EMPTY_WEAVE: Weave = [];

/** Agrega un elemento al tejido. Si ya está lleno, lo deja igual. */
export function addToWeave(weave: Weave, element: ElementId): Weave {
  if (weave.length >= MAX_WEAVE_LENGTH) {
    return weave;
  }
  return [...weave, element];
}

/**
 * Gramática del tejido: el primer elemento define la forma del conjuro
 * y los siguientes le agregan efectos.
 */
export const SPELL_FORM_BY_ELEMENT = {
  brasa: 'projectile',
  marea: 'wall',
  raiz: 'trap',
  tormenta: 'leap',
  umbra: 'mark',
} as const satisfies Record<ElementId, string>;

export type SpellForm = (typeof SPELL_FORM_BY_ELEMENT)[ElementId];

export interface SpellRecipe {
  readonly form: SpellForm;
  readonly modifiers: readonly ElementId[];
  readonly weave: Weave;
}

/** Traduce un tejido a su receta de conjuro. Devuelve null si el tejido está vacío. */
export function recipeOf(weave: Weave): SpellRecipe | null {
  const [first, ...rest] = weave;
  if (first === undefined) {
    return null;
  }
  return { form: SPELL_FORM_BY_ELEMENT[first], modifiers: rest, weave };
}

/** Clave estable de un tejido, por ejemplo "brasa>marea". */
export function weaveKey(weave: Weave): string {
  return weave.join('>');
}

/** Cantidad de conjuros base posibles: 5 + 25 + 125 = 155. */
export function baseSpellCount(): number {
  let total = 0;
  for (let length = 1; length <= MAX_WEAVE_LENGTH; length++) {
    total += ELEMENT_COUNT ** length;
  }
  return total;
}
