import { TAP_SLOP_PX } from './TapToLock';

/** Radianes que gira la cámara por cada píxel que se arrastra el dedo. */
const RADIANS_PER_PIXEL = 0.008;

/**
 * Girar la cámara arrastrando un dedo por la pantalla, fuera del joystick y los botones.
 * Funciona igual con el mouse. Solo se usa el desplazamiento horizontal.
 *
 * No gira hasta que el dedo se corre más que un toque (`TAP_SLOP_PX`): antes cualquier
 * temblor de 1 px al tocar a un rival contaba como giro a mano y bloqueaba el centrado.
 * Al empezar a arrastrar avisa con `onDragStart` (eso suelta el duelo).
 */
export class CameraDrag {
  private pointerId: number | null = null;
  private startX = 0;
  private lastX = 0;
  private dragging = false;
  enabled = false;

  constructor(
    target: HTMLElement,
    onRotate: (radians: number) => void,
    onDragStart: () => void = () => {},
  ) {
    target.addEventListener('pointerdown', (event) => {
      if (!this.enabled || this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.startX = event.clientX;
      this.lastX = event.clientX;
      this.dragging = false;
      target.setPointerCapture(event.pointerId);
    });
    target.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointerId) return;
      if (!this.dragging) {
        if (Math.abs(event.clientX - this.startX) <= TAP_SLOP_PX) return;
        this.dragging = true;
        // El giro parte desde donde empezó el arrastre: no se pierden los primeros píxeles.
        this.lastX = this.startX;
        onDragStart();
      }
      const dx = event.clientX - this.lastX;
      this.lastX = event.clientX;
      // La cámara gira hacia el mismo lado que arrastra el dedo.
      if (dx !== 0) onRotate(dx * RADIANS_PER_PIXEL);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.pointerId) this.pointerId = null;
    };
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
  }
}
