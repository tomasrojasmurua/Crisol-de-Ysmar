import type { ElementId } from '@crisol/core';

/**
 * Íconos de la interfaz en SVG: trazo de 2.5 sobre una grilla de 32, extremos redondeados y
 * color por `currentColor`, así cada botón los pinta con CSS. Cada elemento tiene una silueta
 * propia para que se distingan también sin color (daltonismo, pulgar encima, pantalla chica).
 */
const ELEMENT_PATHS: Record<ElementId, string> = {
  // Tres lenguas de fuego; la interior queda separada del borde para que no se empaste.
  brasa:
    '<path d="M18 3.5C20 8 17 11 18 15C20 18 22 16 23 13C28 19 27 25 22 28C19 29 13 29 10 27C4 23 5 17 9 13C9 17 12 19 14 20C12 14 17 11 18 3.5Z"/>' +
    '<path d="M15 26C13 24 14.5 21 17 19.5C17 22.5 20 24 18.5 26"/>',
  // Rayo anguloso: lo único hecho de rectas.
  tormenta: '<path d="M19 3.5L7 18H16L13 28.5L26 13H18L21 3.5Z"/>',
  // Ola que rompe: silueta horizontal, para no confundirse con la llama.
  marea:
    '<path d="M4 22C7 17 8 9 17 7C23 6 27 10 27 15C24 12 20 13 18 17C16 21 20 25 27 22"/>' +
    '<path d="M5 26C10 23 14 23 18 25C22 27 25 27 28 25"/>' +
    '<path d="M9 29C13 27 17 28 21 29"/>',
  // Brote con raíces: la única forma ancha arriba y angosta abajo.
  raiz:
    '<path d="M16 25V15"/>' +
    '<path d="M16 17C10 17 6 13 6 7C12 7 16 10 16 17Z"/>' +
    '<path d="M16 16C16 9 20 5 27 5C27 12 23 16 16 16Z"/>' +
    '<path d="M16 24C15 26 12 27 11 29M16 24V29M16 24C17 26 20 27 21 29"/>',
  // Luna creciente con un destello de sombra.
  umbra:
    '<path d="M21 3.5C13 4 7 10 7 17C7 24 13 29 20 28C23 28 26 26 28 23C20 25 14 19 15 12C15.5 8 18 5 21 3.5Z"/>' +
    '<path d="M25 7L26 10L29 11L26 12L25 15L24 12L21 11L24 10Z"/>',
};

/** Estrella sólida de Lanzar: el botón más importante pesa más que los demás. */
const CAST_PATH = '<path d="M16 3L20 12L29 16L20 20L16 29L12 20L3 16L12 12Z" fill="currentColor"/>';

/** Espectro de ojos huecos y cola deshilachada: el Lamento no se parece a ningún elemento. */
const LAMENT_PATH =
  '<path d="M8 27V14A8 8 0 0 1 24 14V27L20.5 24.5L16 27.5L11.5 24.5Z"/>' +
  '<circle cx="12.75" cy="15" r="1.6" fill="currentColor"/>' +
  '<circle cx="19.25" cy="15" r="1.6" fill="currentColor"/>';

/** Flecha que vuelve: deshace el tejido. */
const UNDO_PATH =
  '<path d="M10 11H4L9 5M4 11L9 16"/>' +
  '<path d="M10 11C16 5 25 8 28 15C31 22 25 28 18 28C14 28 11 26 9 23"/>';

/** Duelo: cuatro esquinas que encuadran un rombo, como una mira puesta sobre el rival. */
const DUEL_PATH =
  '<path d="M5 11V5H11M21 5H27V11M27 21V27H21M11 27H5V21"/>' +
  '<path d="M16 10.5L21.5 16L16 21.5L10.5 16Z"/>';

function svg(paths: string, className: string): string {
  return (
    `<svg class="icon ${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" ` +
    `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

export function elementIcon(element: ElementId): string {
  return svg(ELEMENT_PATHS[element], `icon-${element}`);
}

export const CAST_ICON = svg(CAST_PATH, 'icon-cast');
export const LAMENT_ICON = svg(LAMENT_PATH, 'icon-lament');
export const UNDO_ICON = svg(UNDO_PATH, 'icon-undo');
export const DUEL_ICON = svg(DUEL_PATH, 'icon-duel');
