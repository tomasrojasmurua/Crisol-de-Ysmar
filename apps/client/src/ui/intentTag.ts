import { INTENT_HINTS, INTENT_NAMES, SPELL_INTENTS, type SpellIntent } from '@crisol/content';
import type { SpellId } from '@crisol/core';
import { el } from './dom';

/**
 * Siluetas de para qué sirve un hechizo, con el mismo trazo que los demás íconos (grilla de 32,
 * `currentColor`). Cada una se distingue sin color: espada, cadena, cruz, escudo y doble flecha.
 */
const INTENT_PATHS: Record<SpellIntent, string> = {
  damage: '<path d="M27 5L15 17M27 5H21M27 5V11"/><path d="M9 15L17 23M13 19L6 26"/>',
  control:
    '<rect x="3" y="11" width="15" height="10" rx="5"/><rect x="14" y="11" width="15" height="10" rx="5"/>',
  heal: '<path d="M16 6V26M6 16H26"/>',
  support: '<path d="M16 4L26 8V15C26 22 21 26 16 28C11 26 6 22 6 15V8Z"/>',
  movement: '<path d="M6 8L13 16L6 24M16 8L23 16L16 24"/>',
};

function intentIcon(intent: SpellIntent): string {
  return (
    `<svg class="icon icon-intent" viewBox="0 0 32 32" fill="none" stroke="currentColor" ` +
    `stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${INTENT_PATHS[intent]}</svg>`
  );
}

/**
 * La etiqueta de para qué sirve un hechizo: ícono y palabra del color de su intención
 * ("Daño", "Cura"…). Es una pieza de texto común: no agrega nada que dibujar en la escena.
 */
export function intentTag(spell: SpellId): HTMLElement {
  const intent = SPELL_INTENTS[spell];
  const tag = el('span', `intent-tag intent-${intent}`);
  tag.title = INTENT_HINTS[intent];
  tag.innerHTML = intentIcon(intent);
  tag.append(el('span', 'intent-tag-name', INTENT_NAMES[intent]));
  return tag;
}

/**
 * Solo el ícono de para qué sirve un hechizo, del color de su intención, para ir junto al nombre
 * en las listas (el Grimorio). La palabra queda para quien lo mantiene apretado o lo lee en voz
 * alta, y para la ficha completa.
 */
export function intentMark(spell: SpellId): HTMLElement {
  const intent = SPELL_INTENTS[spell];
  const mark = el('span', `intent-mark intent-${intent}`);
  mark.title = `${INTENT_NAMES[intent]}: ${INTENT_HINTS[intent].toLowerCase()}`;
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', INTENT_NAMES[intent]);
  mark.innerHTML = intentIcon(intent);
  return mark;
}
