import type { Weave } from '@crisol/core';
import { el } from './dom';
import { weaveOrbs } from './GrimoireBook';

/** La mejor jugada, lista para dibujar: quién, con qué hechizos y qué logró. */
export interface HighlightView {
  /** "Jugada de la ronda" o "Jugada de la partida". */
  readonly kicker: string;
  /** "Tú" o el nombre del mago. */
  readonly name: string;
  readonly color: string;
  readonly own: boolean;
  /** Los hechizos de la jugada, en orden. */
  readonly spells: readonly { readonly name: string; readonly weave: Weave }[];
  /** "84 de daño", "2 derribos", "en 2,4 s"… */
  readonly facts: readonly string[];
  /** Una marca aparte: "Cerró la ronda", "Ronda 2"… */
  readonly tag: string | null;
}

/**
 * La tarjeta de la mejor jugada: el nombre con el color de su bando, la cadena de hechizos con
 * sus orbes y lo que logró en una línea. Es HTML quieto: se arma una vez y no se toca por cuadro.
 */
export function highlightCard(view: HighlightView, className: string): HTMLElement {
  const card = el('section', `highlight ${className}${view.own ? ' own' : ''}`);
  card.style.setProperty('--team', view.color);
  card.setAttribute('aria-label', view.kicker);
  const head = el('header', 'highlight-head');
  head.append(
    el('span', 'highlight-kicker', view.kicker),
    el('strong', 'highlight-name', view.name),
  );
  if (view.tag) head.append(el('span', 'highlight-tag', view.tag));
  card.append(head);
  if (view.spells.length > 0) {
    const chain = el('p', 'highlight-spells');
    view.spells.forEach((spell, index) => {
      if (index > 0) chain.append(el('span', 'highlight-then', '›'));
      const item = el('span', 'highlight-spell');
      item.append(weaveOrbs(spell.weave), el('span', '', spell.name));
      chain.append(item);
    });
    card.append(chain);
  }
  card.append(el('p', 'highlight-facts', view.facts.join(' · ')));
  return card;
}
