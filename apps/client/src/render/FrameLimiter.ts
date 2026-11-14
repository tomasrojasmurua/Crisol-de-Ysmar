/** En partida: más no se nota y en pantallas de 90 o 120 Hz duplicaba el trabajo (y el calor). */
export const PLAY_FPS = 60;
/** En menús, pausa y resultado: la arena de fondo se mueve lento, no hace falta más. */
export const CALM_FPS = 30;
/** El reloj de la pantalla no es exacto: un cuadro que llega un poco antes igual cuenta. */
const SLACK_MS = 2;

/**
 * Decide si este cuadro de la pantalla se dibuja o se salta, para no pasar de un tope de
 * cuadros por segundo. Dibujar de más calienta el celular y gasta batería sin verse mejor.
 */
export class FrameLimiter {
  private last = Number.NEGATIVE_INFINITY;

  /** Si toca dibujar en `now` con ese tope. Si sí, cuenta desde aquí. */
  ready(now: number, fps: number): boolean {
    if (now - this.last < 1000 / fps - SLACK_MS) return false;
    this.last = now;
    return true;
  }
}
