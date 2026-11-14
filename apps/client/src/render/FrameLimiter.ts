/** En partida: más no se nota y en pantallas de 120 Hz duplicaba el trabajo (y el calor). */
export const PLAY_FPS = 60;
/** En menús, pausa y resultado: la arena de fondo se mueve lento, no hace falta más. */
export const CALM_FPS = 30;
/** Cuánto pesa cada cuadro nuevo en el promedio del ritmo de la pantalla. */
const SMOOTHING = 0.1;
/** Un tope un poco pasado igual vale: 144 Hz con tope 60 dibuja 72, no 48. */
const ROUNDING = 0.15;
/** Un salto de más de esto (la pestaña estuvo escondida) no cuenta para el ritmo. */
const MAX_GAP_MS = 100;

/**
 * Decide si este cuadro de la pantalla se dibuja o se salta, para no pasar de un tope de
 * cuadros por segundo. Dibujar de más calienta el celular y gasta batería sin verse mejor.
 *
 * Siempre dibuja uno de cada N cuadros de la pantalla, con N entero: así el ritmo queda parejo.
 * Con un tope por tiempo, una pantalla de 90 Hz quedaba en 45 fps disparejos; ahora va a 90.
 */
export class FrameLimiter {
  private lastCall = Number.NaN;
  private screenMs = 0;
  private skipped = 0;

  /** Si toca dibujar en `now` con ese tope. Hay que llamarlo en cada cuadro de la pantalla. */
  ready(now: number, fps: number): boolean {
    const gap = now - this.lastCall;
    this.lastCall = now;
    if (gap > 0 && gap < MAX_GAP_MS) {
      this.screenMs = this.screenMs === 0 ? gap : this.screenMs + (gap - this.screenMs) * SMOOTHING;
    }
    const every =
      this.screenMs > 0 ? Math.max(1, Math.floor(1000 / this.screenMs / fps + ROUNDING)) : 1;
    if (++this.skipped < every) return false;
    this.skipped = 0;
    return true;
  }
}
