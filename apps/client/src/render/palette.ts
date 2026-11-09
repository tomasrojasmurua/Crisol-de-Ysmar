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

export function formColor(form: SpellForm): THREE.Color {
  const element = ELEMENT_BY_FORM.get(form);
  return element ? elementColor(element) : new THREE.Color('#ffffff');
}
