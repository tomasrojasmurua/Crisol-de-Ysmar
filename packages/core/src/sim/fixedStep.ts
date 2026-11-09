/** La simulación avanza 30 pasos por segundo, siempre. */
export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;

/** Evita la "espiral de la muerte" si el celular se congela un momento. */
const MAX_STEPS_PER_FRAME = 5;

/**
 * Convierte el tiempo real de cada cuadro en pasos fijos de simulación.
 * `alpha` indica cuánto avanzamos hacia el siguiente paso, para interpolar el dibujo.
 */
export class FixedStepClock {
  private accumulatedMs = 0;

  advance(frameMs: number): { steps: number; alpha: number } {
    this.accumulatedMs += Math.max(0, frameMs);
    let steps = 0;
    while (this.accumulatedMs >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
      this.accumulatedMs -= TICK_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) {
      this.accumulatedMs = Math.min(this.accumulatedMs, TICK_MS);
    }
    return { steps, alpha: this.accumulatedMs / TICK_MS };
  }
}
