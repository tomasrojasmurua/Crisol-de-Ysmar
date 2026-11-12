import type { Glyph } from '@crisol/content';
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

/** Flecha que vuelve: deshace el tejido. */
const UNDO_PATH =
  '<path d="M10 11H4L9 5M4 11L9 16"/>' +
  '<path d="M10 11C16 5 25 8 28 15C31 22 25 28 18 28C14 28 11 26 9 23"/>';

/** Duelo: cuatro esquinas que encuadran un rombo, como una mira puesta sobre el rival. */
const DUEL_PATH =
  '<path d="M5 11V5H11M21 5H27V11M27 21V27H21M11 27H5V21"/>' +
  '<path d="M16 10.5L21.5 16L16 21.5L10.5 16Z"/>';

/**
 * Glifos generales (sin elemento): cada uno con una silueta que cuenta qué hace, para que se
 * reconozcan entre rondas sin leer la carta entera.
 */
const GENERAL_GLYPH_PATHS: Record<string, string> = {
  // Tres hilos que bajan juntos: conjuros de tres elementos.
  'eco-triple':
    '<path d="M9 5C12 11 6 20 9 27"/><path d="M16 5V27"/><path d="M23 5C20 11 26 20 23 27"/>',
  // Una pluma: conjuros de un solo elemento, livianos.
  'mano-ligera':
    '<path d="M25 4C14 5 7 13 8 24C19 23 26 15 25 4Z"/><path d="M8 24L5 28M11 21L19 12"/>',
  // Reloj de arena: canalizar más rápido.
  'tejido-veloz':
    '<path d="M9 4H23M9 28H23"/>' +
    '<path d="M11 4C11 11 16 13 16 16C16 19 11 21 11 28M21 4C21 11 16 13 16 16C16 19 21 21 21 28"/>',
  // Soplo de aire: los elementos descansan menos.
  respiro:
    '<path d="M4 12H18A4 4 0 1 0 14 8"/><path d="M4 18H23A4 4 0 1 1 19 22"/><path d="M4 24H11"/>',
  // Escudo tallado en piedra: más vida.
  'piel-de-piedra':
    '<path d="M16 3L27 7V15C27 22 22 27 16 29C10 27 5 22 5 15V7Z"/><path d="M5.5 12L16 16L26.5 12M16 16V28.5"/>',
};

/** Runa de reserva para un Glifo general que todavía no tiene silueta propia. */
const RUNE_PATH = '<path d="M16 4L26 16L16 28L6 16Z"/><path d="M16 10V22M11 16H21"/>';

function svg(paths: string, className: string): string {
  return (
    `<svg class="icon ${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" ` +
    `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

export function elementIcon(element: ElementId): string {
  return svg(ELEMENT_PATHS[element], `icon-${element}`);
}

/** El signo de un Glifo: el de su elemento o, si es general, el suyo propio. */
export function glyphIcon(glyph: Glyph): string {
  if (glyph.element) return elementIcon(glyph.element);
  return svg(GENERAL_GLYPH_PATHS[glyph.id] ?? RUNE_PATH, 'icon-glyph');
}

export const CAST_ICON = svg(CAST_PATH, 'icon-cast');
export const UNDO_ICON = svg(UNDO_PATH, 'icon-undo');
export const DUEL_ICON = svg(DUEL_PATH, 'icon-duel');
