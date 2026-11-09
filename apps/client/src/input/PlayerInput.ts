import type { ElementId } from '@crisol/core';

/** Una dirección en pantalla: derecha positiva, arriba positiva. Largo de 0 a 1. */
export interface ScreenVector {
  readonly right: number;
  readonly up: number;
}

export type PlayerAction =
  | { readonly type: 'weave'; readonly element: ElementId }
  | { readonly type: 'cancel' }
  /** `aim` nulo: tocar sin arrastrar, apunta solo al rival. */
  | { readonly type: 'cast'; readonly aim: ScreenVector | null };

/**
 * Lo que el jugador quiere hacer, en coordenadas de pantalla.
 * Los controles táctiles y el teclado escriben aquí; el controlador humano lo traduce a intenciones.
 */
export class PlayerInput {
  move: ScreenVector = { right: 0, up: 0 };
  /** Dirección que se está arrastrando desde el botón de lanzar, para dibujar la guía. */
  aimPreview: ScreenVector | null = null;
  private queue: PlayerAction[] = [];

  push(action: PlayerAction): void {
    this.queue.push(action);
  }

  drain(): PlayerAction[] {
    const actions = this.queue;
    this.queue = [];
    return actions;
  }
}
