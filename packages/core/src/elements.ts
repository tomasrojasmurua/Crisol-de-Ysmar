/**
 * Los cinco elementos, en el orden del pentágono elemental.
 * Cada elemento combina con sus dos vecinos y choca con los dos de enfrente.
 */
export const ELEMENT_IDS = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'] as const;

export type ElementId = (typeof ELEMENT_IDS)[number];

export const ELEMENT_COUNT = ELEMENT_IDS.length;

export function isElementId(value: unknown): value is ElementId {
  return typeof value === 'string' && (ELEMENT_IDS as readonly string[]).includes(value);
}

function elementAt(index: number): ElementId {
  const wrapped = ((index % ELEMENT_COUNT) + ELEMENT_COUNT) % ELEMENT_COUNT;
  const element = ELEMENT_IDS[wrapped];
  if (element === undefined) {
    throw new Error(`Índice de elemento fuera de rango: ${index}`);
  }
  return element;
}

/** Los dos elementos vecinos en el pentágono. */
export function neighborsOf(element: ElementId): readonly [ElementId, ElementId] {
  const i = ELEMENT_IDS.indexOf(element);
  return [elementAt(i - 1), elementAt(i + 1)];
}

/** Los dos elementos de enfrente en el pentágono. */
export function opposingOf(element: ElementId): readonly [ElementId, ElementId] {
  const i = ELEMENT_IDS.indexOf(element);
  return [elementAt(i + 2), elementAt(i + 3)];
}
