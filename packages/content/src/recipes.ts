import type { ElementId } from '@crisol/core';

/**
 * La receta de los hechizos de dos elementos: el primero dice de qué está hecho y el segundo,
 * qué hace. Calza con los 25 sin que ninguno se haya diseñado así a propósito, y es la pista
 * para elegir qué tejer: si quieres pegar, termina en Brasa; si quieres moverte, en Tormenta.
 * En los Grandes hechizos el tercer elemento es una sorpresa, así que la receta no los cubre.
 * Si cambias un hechizo de dos elementos, revisa que siga calzando (`recipes.test.ts`).
 */
export const RECIPE_RULE = 'El primer elemento dice de qué está hecho; el segundo, qué hace.';

/** Qué hace cada elemento cuando va de segundo, en pocas palabras y con un ejemplo. */
export const SECOND_ELEMENT_ROLES: Readonly<
  Record<ElementId, { readonly verb: string; readonly hint: string }>
> = {
  brasa: { verb: 'Golpea', hint: 'Hace daño' },
  tormenta: { verb: 'Te mueve', hint: 'Te lleva de un lugar a otro' },
  marea: { verb: 'Protege o estorba', hint: 'Te cubre o le estorba al rival' },
  raiz: { verb: 'Se queda en el campo', hint: 'Deja algo plantado: un poste, un muro, una fuente' },
  umbra: { verb: 'Engaña o maldice', hint: 'Te esconde, sorprende o debilita al rival' },
};
