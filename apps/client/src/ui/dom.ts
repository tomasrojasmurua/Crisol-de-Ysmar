/** Busca un elemento que la interfaz necesita; si falta es un error de programación. */
export function query<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta el elemento ${selector}`);
  return element;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/*
 * Escrituras que solo tocan la página si algo cambió. En partida la interfaz se actualiza en
 * cada cuadro: asignar `textContent` (aunque sea el mismo texto) reemplaza el nodo de texto y
 * obliga a recalcular estilo, diseño y pintura de la página entera en ese cuadro. En un iPhone
 * eso pasa casi gratis; en un Android de gama media se come varios milisegundos que no se ven en
 * el JavaScript (quedan en la "espera" del informe de rendimiento).
 */

/** Pone el texto solo si cambió. */
export function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/** Esconde o muestra solo si cambió. */
export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

/**
 * Cambia una propiedad de estilo (`width`, `opacity`, `transform`, una variable `--x`) solo si
 * el valor es otro que el último que se puso por aquí.
 */
export function setStyle(element: HTMLElement, property: string, value: string): void {
  let last = lastStyles.get(element);
  if (!last) {
    last = new Map();
    lastStyles.set(element, last);
  }
  if (last.get(property) === value) return;
  last.set(property, value);
  element.style.setProperty(property, value);
}

/**
 * El ancho de una barra de vida, de a medio por ciento: con la vida subiendo o bajando de a
 * poco (regeneración, quemadura) no se recalcula el diseño en cada cuadro por cambios que no se ven.
 */
export function barWidth(value: number, max: number): string {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return `${Math.round(ratio * 200) / 2}%`;
}

const lastStyles = new WeakMap<HTMLElement, Map<string, string>>();
