import type { ElementId } from '../elements';

/**
 * Un mago no sabe quién lo controla: un dedo, la IA o la red.
 * Todos entregan intenciones con esta forma.
 */
export type Intent =
  | { readonly kind: 'move'; readonly x: number; readonly z: number }
  | { readonly kind: 'weave'; readonly element: ElementId }
  | { readonly kind: 'cancelWeave' }
  | { readonly kind: 'cast'; readonly dirX: number; readonly dirZ: number }
  | { readonly kind: 'lockTarget'; readonly targetId: number | null };

export interface Controller {
  /** Intenciones de este mago para el paso de simulación indicado. */
  intentsFor(tick: number): readonly Intent[];
}
