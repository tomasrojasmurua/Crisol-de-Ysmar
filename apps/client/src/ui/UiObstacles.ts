/** Un rectángulo de la pantalla, en píxeles CSS. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Lo de arriba (reloj, vida, minimapa, panel): las etiquetas se corren hacia abajo. */
const TOP_SELECTORS = ['.hud-round', '.hud-player', '.minimap', '.training-panel'];
/** Los botones del tejido: una etiqueta encima se vuelve casi transparente para no taparlos. */
const PAD_SELECTORS = ['.element-button', '.cast-button', '.cancel-button'];
const STICK_SELECTORS = ['.joystick-base'];
/** Cada cuánto se vuelven a medir (la interfaz casi no se mueve). */
const REFRESH_MS = 400;

/**
 * Dónde está la interfaz fija en la pantalla, para que lo que se dibuja sobre el mundo
 * (nombres, vida, flechas de rivales) nunca quede encima de un botón o del reloj.
 * Las medidas se guardan y se renuevan cada poco, así no se fuerza el diseño en cada cuadro.
 */
export class UiObstacles {
  private topRects: ScreenRect[] = [];
  private controlRects: ScreenRect[] = [];
  /** Las zonas enteras de los controles: el arco del tejido y el joystick. */
  private controlAreas: ScreenRect[] = [];
  private measuredAt = -Infinity;

  constructor(private readonly root: HTMLElement) {
    window.addEventListener('resize', () => this.invalidate());
  }

  /** Obliga a medir de nuevo en el próximo uso (se mostró u ocultó algo). */
  invalidate(): void {
    this.measuredAt = -Infinity;
  }

  /** Mide si pasó el tiempo. Se llama una vez por cuadro, antes de ubicar etiquetas. */
  refresh(now = performance.now()): void {
    if (now - this.measuredAt < REFRESH_MS) return;
    this.measuredAt = now;
    this.topRects = this.measure(TOP_SELECTORS);
    const pad = this.measure(PAD_SELECTORS);
    const stick = this.measure(STICK_SELECTORS);
    this.controlRects = [...pad, ...stick];
    this.controlAreas = [union(pad), union(stick)].filter((r): r is ScreenRect => r !== null);
  }

  /**
   * Dónde poner una etiqueta anclada abajo al centro en (x, y) para que no choque con el HUD
   * de arriba: devuelve la y corregida.
   */
  clearOfTop(x: number, y: number, width: number, height: number): number {
    let next = y;
    for (const rect of this.topRects) {
      const overlapsX = x + width / 2 > rect.left && x - width / 2 < rect.right;
      if (overlapsX && next - height < rect.bottom && next > rect.top)
        next = rect.bottom + height + 2;
    }
    return next;
  }

  /** Si una etiqueta así quedaría encima de algún botón. */
  coversControl(x: number, y: number, width: number, height: number): boolean {
    const label: ScreenRect = {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height,
      bottom: y,
    };
    return this.controlRects.some((rect) => intersects(label, rect));
  }

  /**
   * Corre un punto del borde de la pantalla (una flecha) fuera del HUD y de los controles,
   * a lo largo del borde vertical.
   */
  clearPoint(x: number, y: number, margin: number): { x: number; y: number } {
    let nextY = y;
    for (const rect of this.topRects) {
      if (inside(x, nextY, rect, margin)) nextY = rect.bottom + margin;
    }
    for (const area of this.controlAreas) {
      if (inside(x, nextY, area, margin)) nextY = area.top - margin;
    }
    return { x, y: nextY };
  }

  private measure(selectors: readonly string[]): ScreenRect[] {
    const rects: ScreenRect[] = [];
    for (const element of this.root.querySelectorAll<HTMLElement>(selectors.join(','))) {
      const rect = element.getBoundingClientRect();
      // Lo oculto mide cero.
      if (rect.width > 0 && rect.height > 0) rects.push(rect);
    }
    return rects;
  }
}

function intersects(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function inside(x: number, y: number, rect: ScreenRect, margin: number): boolean {
  return (
    x > rect.left - margin &&
    x < rect.right + margin &&
    y > rect.top - margin &&
    y < rect.bottom + margin
  );
}

function union(rects: readonly ScreenRect[]): ScreenRect | null {
  if (rects.length === 0) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}
