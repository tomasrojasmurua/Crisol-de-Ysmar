/** Resoluciones que se prueban, de la más nítida a la más liviana (en píxeles por punto CSS). */
const STEPS = [2, 1.75, 1.5, 1.25, 1] as const;
/** Cuánto se mide antes de decidir. */
const WINDOW_MS = 1000;
/** Al empezar una partida se compilan sombreadores y hay tirones: no se cuentan. */
const WARMUP_MS = 1500;
/** Sobre esto (menos de ~50 cuadros por segundo) se baja la resolución. */
const SLOW_FRAME_MS = 20;
/**
 * Bajo esto se puede volver a subir: ~57 cuadros por segundo, o sea una pantalla de 60 Hz
 * andando a tope. Antes se pedían 77, imposibles en un iPhone con Safari (tope de 60): una vez
 * que la resolución bajaba, quedaba baja para siempre.
 */
const FAST_FRAME_MS = 17.5;
/** Ventanas rápidas seguidas antes de subir. */
const FAST_WINDOWS_TO_RISE = 4;
/** Tras bajar no se intenta subir por un rato: evita que la imagen parpadee entre dos niveles. */
const RISE_COOLDOWN_MS = 30_000;
/** Si subir sale mal una y otra vez, la espera se duplica hasta este tope. */
const MAX_RISE_COOLDOWN_MS = 240_000;
/** Una bajada así de pronto tras subir cuenta como subida fallida. */
const FAILED_RISE_MS = 10_000;
/**
 * Tras bajar, el juego tiene que andar al menos esto más rápido. Si no mejora, lo que frena
 * no es la cantidad de píxeles (es la lógica o el celular caliente): se deshace la bajada,
 * porque pixelar no compraría fluidez.
 */
const MIN_GAIN = 0.08;
/** Un cuadro así de largo es una pestaña en pausa o un tirón aislado, no lentitud. */
const IGNORE_FRAME_MS = 100;

/**
 * Ajusta la resolución del dibujo para mantener el juego fluido: si el celular no alcanza,
 * baja los píxeles por punto un escalón; si sobra, sube. Lo primero es la fluidez, luego la nitidez,
 * pero solo se sacrifica nitidez cuando de verdad ayuda.
 */
export class AdaptiveResolution {
  private readonly steps: readonly number[];
  private level = 0;
  /** El escalón más bajo que vale la pena usar: más abajo ya se comprobó que no ayuda. */
  private floor: number;
  private windowMs = 0;
  private windowFrames = 0;
  private fastWindows = 0;
  private warmupMs = WARMUP_MS;
  private riseBlockedMs = 0;
  private cooldownMs = RISE_COOLDOWN_MS;
  private sinceRiseMs = Number.POSITIVE_INFINITY;
  /** Promedio antes de la última bajada, para comprobar si sirvió. */
  private beforeDrop: number | null = null;

  constructor(devicePixelRatio: number) {
    const max = Math.max(1, Math.min(devicePixelRatio, STEPS[0]));
    this.steps = [max, ...STEPS.filter((step) => step < max)];
    this.floor = this.steps.length - 1;
  }

  get pixelRatio(): number {
    return this.steps[this.level] ?? 1;
  }

  /** Vuelve a esperar el calentamiento (al empezar una partida). Conserva el nivel alcanzado. */
  restart(): void {
    this.warmupMs = WARMUP_MS;
    this.windowMs = 0;
    this.windowFrames = 0;
    this.fastWindows = 0;
    this.beforeDrop = null;
    this.floor = this.steps.length - 1;
  }

  /** Registra un cuadro. Devuelve la nueva resolución si cambió, o null. */
  sample(frameMs: number): number | null {
    if (frameMs <= 0 || frameMs > IGNORE_FRAME_MS) return null;
    this.riseBlockedMs = Math.max(0, this.riseBlockedMs - frameMs);
    this.sinceRiseMs += frameMs;
    if (this.warmupMs > 0) {
      this.warmupMs -= frameMs;
      return null;
    }
    this.windowMs += frameMs;
    this.windowFrames += 1;
    if (this.windowMs < WINDOW_MS) return null;
    const average = this.windowMs / this.windowFrames;
    this.windowMs = 0;
    this.windowFrames = 0;

    // ¿Sirvió la última bajada? Si no, se vuelve atrás y no se baja más en esta partida.
    if (this.beforeDrop !== null) {
      const before = this.beforeDrop;
      this.beforeDrop = null;
      if (average > before * (1 - MIN_GAIN)) {
        this.level -= 1;
        this.floor = this.level;
        this.fastWindows = 0;
        return this.pixelRatio;
      }
    }

    if (average > SLOW_FRAME_MS && this.level < this.floor) {
      if (this.sinceRiseMs < FAILED_RISE_MS) {
        this.cooldownMs = Math.min(this.cooldownMs * 2, MAX_RISE_COOLDOWN_MS);
      }
      this.level += 1;
      this.fastWindows = 0;
      this.riseBlockedMs = this.cooldownMs;
      this.beforeDrop = average;
      return this.pixelRatio;
    }
    this.fastWindows = average < FAST_FRAME_MS ? this.fastWindows + 1 : 0;
    if (this.fastWindows >= FAST_WINDOWS_TO_RISE && this.level > 0 && this.riseBlockedMs <= 0) {
      this.level -= 1;
      this.fastWindows = 0;
      this.sinceRiseMs = 0;
      return this.pixelRatio;
    }
    return null;
  }
}
