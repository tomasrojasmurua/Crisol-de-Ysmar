import type { ElementId } from '@crisol/core';

/** Una dirección en pantalla: derecha positiva, arriba positiva. Largo de 0 a 1. */
export interface ScreenVector {
  readonly right: number;
  readonly up: number;
}

export type PlayerAction =
  | { readonly type: 'weave'; readonly element: ElementId }
  | { readonly type: 'cancel' }
  /** Entrar en duelo con un rival o una bestia (tocándolo o con el botón); null lo suelta. */
  | { readonly type: 'lock'; readonly targetId: number | null }
  /**
   * `aim` nulo: tocar sin arrastrar, apunta solo al rival. `reach` (de 0 a 1): hasta dónde
   * llega un hechizo de suelo, si se mantuvo y arrastró ✦ a propósito.
   */
  | { readonly type: 'cast'; readonly aim: ScreenVector | null; readonly reach?: number };

/**
 * Lo que el jugador quiere hacer, en coordenadas de pantalla.
 * Los controles táctiles y el teclado escriben aquí; el controlador humano lo traduce a intenciones.
 */
export class PlayerInput {
  move: ScreenVector = { right: 0, up: 0 };
  /** Dirección que se está arrastrando desde el botón de lanzar, para dibujar la guía. */
  aimPreview: ScreenVector | null = null;
  /** Hasta dónde llegaría un hechizo de suelo si se suelta ahora (null: como siempre). */
  reachPreview: number | null = null;
  private queue: PlayerAction[] = [];
  private readonly listeners: ((action: PlayerAction) => void)[] = [];

  push(action: PlayerAction): void {
    for (const listener of this.listeners) listener(action);
    this.queue.push(action);
  }

  /** Escucha cada acción en el momento en que se toca (el sonido la usa para no esperar). */
  onAction(listener: (action: PlayerAction) => void): void {
    this.listeners.push(listener);
  }

  drain(): PlayerAction[] {
    const actions = this.queue;
    this.queue = [];
    return actions;
  }
}
