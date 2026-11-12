/** Resoluciones que se prueban, de la más nítida a la más liviana (en píxeles por punto CSS). */
const STEPS = [2, 1.75, 1.5, 1.25, 1] as const;
/** Cuánto se mide antes de decidir. */
const WINDOW_MS = 1000;
/** Al empezar una partida se compilan sombreadores y hay tirones: no se cuentan. */
const WARMUP_MS = 1500;
/** Sobre esto (menos de ~50 cuadros por segundo) se baja la resolución. */
const SLOW_FRAME_MS = 20;
/**
 * Sobre esto (menos de 30 cuadros por segundo) se baja de a dos escalones: en un Android de
 * gama media con 6 magos, ir de a uno tardaba casi diez segundos en llegar a ir fluido.
 */
const VERY_SLOW_FRAME_MS = 33;
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
/** Ventanas que se miden tras bajar antes de juzgar si sirvió (una sola es puro ruido). */
const CHECK_WINDOWS = 2;
/**
 * Un cuadro más largo que esto (una pestaña en pausa, un tirón aislado) cuenta solo hasta aquí:
 * uno suelto no alcanza a mover el promedio. Antes se descartaba, y un celular que andaba a
 * menos de 10 cuadros por segundo nunca bajaba la resolución: justo el que más lo necesitaba.
 */
const MAX_FRAME_MS = 100;

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
  /** Tiempo real medido en la ventana, y la suma de cuadros con tope (para el promedio). */
  private windowMs = 0;
  private windowSum = 0;
  private windowFrames = 0;
  private fastWindows = 0;
  private warmupMs = WARMUP_MS;
  private riseBlockedMs = 0;
  private cooldownMs = RISE_COOLDOWN_MS;
  private sinceRiseMs = Number.POSITIVE_INFINITY;
  /** Promedio antes de la última bajada, para comprobar si sirvió. */
  private beforeDrop: number | null = null;
  /** El escalón en que se estaba antes de la última bajada (para deshacerla). */
  private dropFrom = 0;
  private checkSum = 0;
  private checkCount = 0;

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
    this.windowSum = 0;
    this.windowFrames = 0;
    this.fastWindows = 0;
    this.beforeDrop = null;
    this.checkSum = 0;
    this.checkCount = 0;
    this.floor = this.steps.length - 1;
  }

  /** Registra un cuadro. Devuelve la nueva resolución si cambió, o null. */
  sample(frameMs: number): number | null {
    if (frameMs <= 0) return null;
    this.riseBlockedMs = Math.max(0, this.riseBlockedMs - frameMs);
    this.sinceRiseMs += frameMs;
    if (this.warmupMs > 0) {
      this.warmupMs -= frameMs;
      return null;
    }
    // La ventana dura un segundo de reloj, pero cada cuadro pesa en el promedio hasta el tope.
    this.windowMs += frameMs;
    this.windowSum += Math.min(frameMs, MAX_FRAME_MS);
    this.windowFrames += 1;
    if (this.windowMs < WINDOW_MS) return null;
    const average = this.windowSum / this.windowFrames;
    // Para juzgar si una bajada sirvió se usa el promedio real: con tope, un celular que va
    // de 150 a 110 ms por cuadro parecería no mejorar nada.
    const realAverage = this.windowMs / this.windowFrames;
    this.windowMs = 0;
    this.windowSum = 0;
    this.windowFrames = 0;

    // ¿Sirvió la última bajada? Si no, se vuelve atrás y no se baja más en esta partida.
    if (this.beforeDrop !== null) {
      this.checkSum += realAverage;
      this.checkCount += 1;
      if (this.checkCount < CHECK_WINDOWS) return null;
      const before = this.beforeDrop;
      const after = this.checkSum / this.checkCount;
      this.beforeDrop = null;
      this.checkSum = 0;
      this.checkCount = 0;
      if (after > before * (1 - MIN_GAIN)) {
        this.level = this.dropFrom;
        this.floor = this.level;
        this.fastWindows = 0;
        return this.pixelRatio;
      }
    }

    if (average > SLOW_FRAME_MS && this.level < this.floor) {
      if (this.sinceRiseMs < FAILED_RISE_MS) {
        this.cooldownMs = Math.min(this.cooldownMs * 2, MAX_RISE_COOLDOWN_MS);
      }
      this.dropFrom = this.level;
      const steps = average > VERY_SLOW_FRAME_MS ? 2 : 1;
      this.level = Math.min(this.floor, this.level + steps);
      this.fastWindows = 0;
      this.riseBlockedMs = this.cooldownMs;
      this.beforeDrop = realAverage;
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
