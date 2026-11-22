/** En partida: más no se nota y en pantallas de 120 Hz duplicaba el trabajo (y el calor). */
export const PLAY_FPS = 60;
/** En menús, pausa y resultado: la arena de fondo se mueve lento, no hace falta más. */
export const CALM_FPS = 30;
/** Un tope un poco pasado igual vale: 144 Hz con tope 60 dibuja 72, no 48. */
const ROUNDING = 0.15;
/** Un salto de más de esto (la pestaña estuvo escondida) no cuenta para el ritmo. */
const MAX_GAP_MS = 100;
/** Menos que esto entre dos llamadas no es una pantalla de verdad (ninguna pasa de 240 Hz). */
const MIN_GAP_MS = 4;
/** El ritmo de la pantalla se recuerda por tramos de este largo (puede cambiar, ver abajo). */
const WINDOW_MS = 1000;

/**
 * Decide si este cuadro de la pantalla se dibuja o se salta, para no pasar de un tope de
 * cuadros por segundo. Dibujar de más calienta el celular y gasta batería sin verse mejor.
 *
 * Siempre dibuja uno de cada N cuadros de la pantalla, con N entero: así el ritmo queda parejo.
 * Con un tope por tiempo, una pantalla de 90 Hz quedaba en 45 fps disparejos; ahora va a 90.
 *
 * El ritmo de la pantalla es el hueco más corto entre llamadas del último segundo, no el
 * promedio: cuando dibujar un cuadro tarda más que un cuadro de 120 Hz, la llamada siguiente
 * llega dos cuadros después, y el promedio (8 y 17 ms, unos 12) hacía creer que la pantalla era
 * de 80 Hz. Entonces se dibujaba en cada llamada: en un Galaxy A35 el juego iba a 120 cuadros
 * a ratos y a 60 a ratos, con el doble de trabajo gráfico y un ritmo disparejo.
 * Por la misma razón se cuentan los cuadros de pantalla que pasaron, no las llamadas.
 */
export class FrameLimiter {
  private lastCall = Number.NaN;
  private windowStart = Number.NaN;
  /** El hueco más corto del tramo anterior y del que va (0 si aún no hay). */
  private previousMin = 0;
  private currentMin = 0;
  /** Cuadros de pantalla desde el último dibujado. */
  private elapsed = 0;
  /** De cuántos cuadros de pantalla se dibujó uno en la última llamada (1: todos). */
  every = 1;

  /** Cada cuánto llama la pantalla (ms); 0 si aún no se sabe. */
  get screenIntervalMs(): number {
    if (this.previousMin === 0) return this.currentMin;
    if (this.currentMin === 0) return this.previousMin;
    return Math.min(this.previousMin, this.currentMin);
  }

  /** Si toca dibujar en `now` con ese tope. Hay que llamarlo en cada cuadro de la pantalla. */
  ready(now: number, fps: number): boolean {
    const gap = now - this.lastCall;
    this.lastCall = now;
    const counted = gap >= MIN_GAP_MS && gap < MAX_GAP_MS;
    if (counted) this.remember(now, gap);
    const screenMs = this.screenIntervalMs;
    if (screenMs <= 0 || !counted) {
      this.elapsed = 0;
      this.every = 1;
      return true;
    }
    const every = Math.max(1, Math.floor(1000 / screenMs / fps + ROUNDING));
    this.every = every;
    this.elapsed += Math.max(1, Math.round(gap / screenMs));
    if (this.elapsed < every) return false;
    this.elapsed = 0;
    return true;
  }

  private remember(now: number, gap: number): void {
    if (Number.isNaN(this.windowStart)) this.windowStart = now;
    if (now - this.windowStart >= WINDOW_MS) {
      // Un tramo nuevo: si la pantalla bajó de ritmo (ahorro de batería), se nota en un segundo.
      this.previousMin = this.currentMin;
      this.currentMin = 0;
      this.windowStart = now;
    }
    this.currentMin = this.currentMin === 0 ? gap : Math.min(this.currentMin, gap);
  }
}

/** Cuánto se mide con el tope puesto antes de juzgarlo. */
const GUARD_WINDOW_MS = 20_000;
/** Tirones (cuadros de más de 50 ms) por minuto desde los que el tope hace más mal que bien. */
const GUARD_HITCHES_PER_MIN = 12;
const HITCH_MS = 50;

/**
 * Vigila el tope de 60 en pantallas rápidas. En un Galaxy A35 (Chrome, 120 Hz) dibujar uno de
 * cada dos cuadros daba 35 a 80 tirones por minuto, y en los ratos en que su pantalla bajaba sola
 * a 60 Hz iba perfecto (19-11). Sin tope, el 17-11, eran 23. Si con el tope el juego se traba,
 * se quita por el resto de la visita: la fluidez manda sobre el calor.
 *
 * Con perfil fluido (Mali y compañía, ver `platform/gpuTier.ts`) se parte sin tope: el A35
 * pasaba los primeros 20 s de cada partida con 60 a 90 tirones por minuto hasta que se quitaba
 * (21 de noviembre). En esos celulares sin tope anda mejor siempre.
 */
export class CapGuard {
  private measuredMs = 0;
  private hitches = 0;
  released: boolean;

  constructor(releasedFromStart = false) {
    this.released = releasedFromStart;
  }

  /** Un cuadro dibujado. `capped`: si se saltaron cuadros de pantalla para llegar a él. */
  sample(frameMs: number, capped: boolean): boolean {
    if (this.released || !capped) return false;
    this.measuredMs += frameMs;
    if (frameMs > HITCH_MS) this.hitches++;
    if (this.measuredMs < GUARD_WINDOW_MS) return false;
    const perMinute = (this.hitches * 60_000) / this.measuredMs;
    this.measuredMs = 0;
    this.hitches = 0;
    if (perMinute < GUARD_HITCHES_PER_MIN) return false;
    this.released = true;
    return true;
  }
}
