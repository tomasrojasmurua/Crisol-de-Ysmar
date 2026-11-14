/**
 * El tamaño de la ventana, guardado. Leer `window.innerWidth` justo después de mover etiquetas
 * obliga al navegador a recalcular el diseño de toda la interfaz en ese instante, dos o tres veces
 * por cuadro; en un Android de gama media eso se nota. Solo cambia al girar o redimensionar.
 */
let width = 0;
let height = 0;

function measure(): void {
  width = window.innerWidth;
  height = window.innerHeight;
}

let listening = false;

/** Ancho y alto de la ventana en píxeles CSS, sin forzar el diseño. */
export function viewportSize(): { readonly width: number; readonly height: number } {
  if (!listening) {
    listening = true;
    measure();
    window.addEventListener('resize', measure);
  }
  return { width, height };
}
