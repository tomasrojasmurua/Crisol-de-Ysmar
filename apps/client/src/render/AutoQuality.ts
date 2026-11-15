/** Al empezar una partida se compilan sombreadores y hay tirones: no se cuentan. */
const WARMUP_MS = 5000;
/** Cuánto se mide antes de juzgar un segundo. */
const WINDOW_MS = 1000;
/** Un segundo cuenta como lento sobre esto (menos de ~40 cuadros por segundo). */
const SLOW_FRAME_MS = 25;
/** Segundos lentos seguidos, ya sin poder bajar más la resolución, antes de cambiar. */
const SLOW_WINDOWS = 6;
/** Un tirón aislado (una pestaña en pausa) pesa solo hasta aquí en el promedio. */
const MAX_FRAME_MS = 100;

/**
 * Decide cuándo pasar solo a "Gráficos livianos": si el celular sigue lento aun con la
 * resolución más baja que sirve, sacrificar nitidez ya no alcanza y lo que queda es apagar
 * sombras, resplandor y estelas. Se hace una sola vez; si el jugador elige la calidad en Pausa,
 * se respeta su elección y no se vuelve a decidir por él.
 */
export class AutoQuality {
  private warmupMs = WARMUP_MS;
  private windowMs = 0;
  private windowSum = 0;
  private windowFrames = 0;
  private slowWindows = 0;
  private active = true;

  /** Vuelve a esperar el calentamiento (al empezar una partida). */
  restart(): void {
    this.warmupMs = WARMUP_MS;
    this.windowMs = 0;
    this.windowSum = 0;
    this.windowFrames = 0;
    this.slowWindows = 0;
  }

  /** El jugador eligió la calidad a mano, o ya se cambió: no se decide más. */
  stop(): void {
    this.active = false;
  }

  /**
   * Registra un cuadro de partida. `canLowerResolution`: si a la resolución todavía le queda
   * por bajar (mientras pueda, ella se encarga). Devuelve true una vez, cuando toca cambiar.
   */
  sample(frameMs: number, canLowerResolution: boolean): boolean {
    if (!this.active || frameMs <= 0) return false;
    if (this.warmupMs > 0) {
      this.warmupMs -= frameMs;
      return false;
    }
    this.windowMs += frameMs;
    this.windowSum += Math.min(frameMs, MAX_FRAME_MS);
    this.windowFrames += 1;
    if (this.windowMs < WINDOW_MS) return false;
    const average = this.windowSum / this.windowFrames;
    this.windowMs = 0;
    this.windowSum = 0;
    this.windowFrames = 0;
    const slow = average > SLOW_FRAME_MS && !canLowerResolution;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (this.slowWindows < SLOW_WINDOWS) return false;
    this.active = false;
    return true;
  }
}
