import { spellName } from '@crisol/content';
import { spellOf, type Weave, type Wizard } from '@crisol/core';
import { el } from './dom';
import { weaveGlyphs } from './GrimoireBook';
import { intentTag } from './intentTag';

/**
 * Lo que estás tejiendo, abajo al centro y solo en tu pantalla: los signos del tejido y el
 * nombre del hechizo que va a salir, para corregir con ✕ antes de lanzar y para que la receta se
 * grabe de tanto verla. Si todavía no lo descubres cambia de color y dice "Nuevo", sin nombre:
 * el nombre se gana lanzándolo.
 */
export class WeaveName {
  private readonly root: HTMLElement;
  private lastKey = '';

  constructor(
    parent: HTMLElement,
    private readonly known: (weave: Weave) => boolean,
  ) {
    this.root = el('div', 'weave-name');
    this.root.hidden = true;
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
  }

  /** Null lo esconde (caíste, o la pantalla está tapada). */
  render(wizard: Wizard | null): void {
    const weave = wizard && wizard.hp > 0 ? (wizard.channel?.weave ?? wizard.weave) : [];
    const spell = weave.length > 0 ? spellOf(weave) : null;
    const isNew = spell !== null && !this.known(weave);
    const key = spell ? `${weave.join('>')}|${isNew}` : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.root.hidden = spell === null;
    if (!spell) return;
    this.root.classList.toggle('new', isNew);
    const name = el('strong', 'weave-name-text', isNew ? 'Nuevo' : spellName(weave));
    const pill = el('div', 'weave-name-pill');
    pill.append(weaveGlyphs(weave), name);
    if (!isNew) pill.append(intentTag(spell));
    this.root.replaceChildren(pill);
  }
}
