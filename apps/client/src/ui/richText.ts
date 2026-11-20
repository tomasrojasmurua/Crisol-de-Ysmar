import { ELEMENTS } from '@crisol/content';
import { isElementId } from '@crisol/core';
import { el } from './dom';
import { CAST_ICON, DUEL_ICON, elementIcon, UNDO_ICON } from './icons';

/** Los botones que no son elementos y se pueden nombrar en un texto: `{undo}`, `{duel}`. */
const BUTTONS: Readonly<Record<string, { readonly icon: string; readonly label: string }>> = {
  undo: { icon: UNDO_ICON, label: 'Deshacer' },
  duel: { icon: DUEL_ICON, label: 'Cambiar de rival' },
};

/**
 * Un texto con elementos marcados como `{brasa}`: cada marca se dibuja con el signo del
 * elemento, en su color, y su nombre. Así la instrucción muestra el mismo símbolo que el botón
 * que hay que tocar. El ✦ se dibuja como un botón de Lanzar en miniatura (estrella dorada en su
 * anillo de bronce), para que se lea como algo que se aprieta; `{undo}` y `{duel}`, como sus
 * botones de la barra.
 */
export function richText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const [i, part] of text.split(/\{(\w+)\}/).entries()) {
    if (i % 2 === 0) {
      appendWithCast(fragment, part);
      continue;
    }
    const button = BUTTONS[part];
    if (button) {
      fragment.append(miniButton(button.icon, button.label));
      continue;
    }
    const element = ELEMENTS.find((e) => e.id === part);
    if (!element || !isElementId(part)) {
      fragment.append(`{${part}}`);
      continue;
    }
    const tag = el('span', 'rich-element');
    tag.style.setProperty('--element', element.color);
    const icon = el('span', 'rich-element-icon');
    icon.innerHTML = elementIcon(part);
    tag.append(icon, element.name);
    fragment.append(tag);
  }
  return fragment;
}

/** Un botón de la barra en miniatura, dentro del texto. */
function miniButton(icon: string, label: string): HTMLElement {
  const button = el('span', 'rich-cast');
  button.innerHTML = icon;
  button.setAttribute('role', 'img');
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * El ✦ va pegado a la palabra de antes y a la puntuación de después ("después ✦:"), para que
 * al cortarse la línea nunca quede solo al principio de una.
 */
function appendWithCast(fragment: DocumentFragment, text: string): void {
  const pieces = text.split('✦');
  let glued: HTMLElement | null = null;
  for (const [i, piece] of pieces.entries()) {
    let rest = piece;
    if (glued) {
      const lead = /^[^\s]*/.exec(rest)?.[0] ?? '';
      rest = rest.slice(lead.length);
      glued.append(miniButton(CAST_ICON, 'Lanzar'), lead);
      fragment.append(glued);
      glued = null;
    }
    if (i < pieces.length - 1) {
      const tail = /\S*\s?$/.exec(rest)?.[0] ?? '';
      const before = rest.slice(0, rest.length - tail.length);
      if (before) fragment.append(before);
      glued = el('span', 'rich-nowrap');
      if (tail) glued.append(tail);
      continue;
    }
    if (rest) fragment.append(rest);
  }
}
