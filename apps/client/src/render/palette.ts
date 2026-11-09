import { ELEMENTS } from '@crisol/content';
import { type ElementId, SPELL_FORM_BY_ELEMENT, type SpellForm } from '@crisol/core';
import * as THREE from 'three';

/** Colores de la magia: lo único con color intenso en la escena. */
export const ELEMENT_COLORS = new Map<ElementId, THREE.Color>(
  ELEMENTS.map((element) => [element.id, new THREE.Color(element.color)]),
);

export function elementColor(element: ElementId): THREE.Color {
  return ELEMENT_COLORS.get(element) ?? new THREE.Color('#ffffff');
}

const ELEMENT_BY_FORM = new Map<SpellForm, ElementId>(
  Object.entries(SPELL_FORM_BY_ELEMENT).map(([element, form]) => [form, element as ElementId]),
);

export function elementOfForm(form: SpellForm): ElementId {
  return ELEMENT_BY_FORM.get(form) ?? 'brasa';
}

export function formColor(form: SpellForm): THREE.Color {
  return elementColor(elementOfForm(form));
}

/**
 * Colores de bando, apagados para no competir con la magia:
 * tú en marfil, tus aliados en verde agua y los rivales en carmesí.
 * En todos contra todos cada rival tiene su propio tono.
 */
const PLAYER_COLOR = '#e8d7a8';
const ALLY_COLOR = '#6cc4b8';
const ENEMY_COLOR = '#d04a52';
const FFA_COLORS = ['#d04a52', '#d4893c', '#c463a6', '#6e8fd8', '#a0b84c'];

export function teamColorHex(
  team: number,
  playerTeam: number,
  isPlayer: boolean,
  ffa: boolean,
): string {
  if (isPlayer) return PLAYER_COLOR;
  if (team === playerTeam) return ALLY_COLOR;
  if (!ffa) return ENEMY_COLOR;
  return FFA_COLORS[(team - 1 + FFA_COLORS.length) % FFA_COLORS.length] ?? ENEMY_COLOR;
}

/** Color "más brillante que el blanco" para que el resplandor (bloom) lo tome. */
export function glow(color: THREE.Color, intensity: number): THREE.Color {
  return color.clone().multiplyScalar(intensity);
}
