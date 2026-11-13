import { ELEMENTS } from '@crisol/content';
import { isElementId } from '@crisol/core';
import { el } from './dom';
import { elementIcon } from './icons';

/**
 * Un texto con elementos marcados como `{brasa}`: cada marca se dibuja con el signo del
 * elemento, en su color, y su nombre. Así la instrucción muestra el mismo símbolo que el botón
 * que hay que tocar.
 */
export function richText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const [i, part] of text.split(/\{(\w+)\}/).entries()) {
    if (i % 2 === 0) {
      if (part) fragment.append(part);
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

/** El mismo texto sin marcas, para lectores de pantalla y pruebas: `{brasa}` → Brasa. */
export function plainText(text: string): string {
  return text.replace(
    /\{(\w+)\}/g,
    (_, id: string) => ELEMENTS.find((e) => e.id === id)?.name ?? id,
  );
}
