import type { ElementId } from '../elements';
import type { MatchState, Wizard } from '../match/state';

/**
 * Un mago no sabe quién lo controla: un dedo, la IA o la red.
 * Todos entregan intenciones con esta forma.
 */
export type Intent =
  /** Dirección de movimiento en el suelo, de largo 0 a 1. */
  | { readonly kind: 'move'; readonly x: number; readonly z: number }
  | { readonly kind: 'weave'; readonly element: ElementId }
  | { readonly kind: 'cancelWeave' }
  /** Dirección de lanzamiento; (0, 0) apunta solo al objetivo. */
  | {
      readonly kind: 'cast';
      readonly dirX: number;
      readonly dirZ: number;
      /**
       * Hasta dónde llega, de 0 (a tus pies) a 1 (lo más lejos que alcanza), en los hechizos que
       * se dejan en el suelo. Sin esto caen como siempre: sobre el objetivo o lo más lejos.
       */
      readonly reach?: number;
    }
  | { readonly kind: 'lockTarget'; readonly targetId: number | null };

export interface Controller {
  /** Intenciones de este mago para el próximo paso de simulación. */
  intentsFor(state: Readonly<MatchState>, self: Readonly<Wizard>): readonly Intent[];
}
