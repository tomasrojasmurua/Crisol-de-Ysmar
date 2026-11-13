import { ELEMENTS } from '@crisol/content';
import { isElementId } from '@crisol/core';
import { el } from './dom';
import { CAST_ICON, elementIcon } from './icons';

/**
 * Un texto con elementos marcados como `{brasa}`: cada marca se dibuja con el signo del
 * elemento, en su color, y su nombre. Así la instrucción muestra el mismo símbolo que el botón
 * que hay que tocar. El ✦ se dibuja como un botón de Lanzar en miniatura (estrella dorada en su
 * anillo de bronce), para que se lea como algo que se aprieta.
 */
export function richText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const [i, part] of text.split(/\{(\w+)\}/).entries()) {
    if (i % 2 === 0) {
      appendWithCast(fragment, part);
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

function appendWithCast(fragment: DocumentFragment, text: string): void {
  for (const [i, piece] of text.split('✦').entries()) {
    if (i > 0) {
      const cast = el('span', 'rich-cast');
      cast.innerHTML = CAST_ICON;
      cast.setAttribute('role', 'img');
      cast.setAttribute('aria-label', 'Lanzar');
      fragment.append(cast);
    }
    if (piece) fragment.append(piece);
  }
}

/** El mismo texto sin marcas, para lectores de pantalla y pruebas: `{brasa}` → Brasa. */
export function plainText(text: string): string {
  return text.replace(
    /\{(\w+)\}/g,
    (_, id: string) => ELEMENTS.find((e) => e.id === id)?.name ?? id,
  );
}
