/** Radianes que gira la cámara por cada píxel que se arrastra el dedo. */
const RADIANS_PER_PIXEL = 0.008;

/**
 * Girar la cámara arrastrando un dedo por la pantalla, fuera del joystick y los botones.
 * Funciona igual con el mouse. Solo se usa el desplazamiento horizontal.
 */
export class CameraDrag {
  private pointerId: number | null = null;
  private lastX = 0;
  enabled = false;

  constructor(target: HTMLElement, onRotate: (radians: number) => void) {
    target.addEventListener('pointerdown', (event) => {
      if (!this.enabled || this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.lastX = event.clientX;
      target.setPointerCapture(event.pointerId);
    });
    target.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointerId) return;
      const dx = event.clientX - this.lastX;
      this.lastX = event.clientX;
      if (dx !== 0) onRotate(-dx * RADIANS_PER_PIXEL);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.pointerId) this.pointerId = null;
    };
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
  }
}
