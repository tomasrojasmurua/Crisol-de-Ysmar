import { spellName } from '@crisol/content';
import { type Wizard, weaveKey } from '@crisol/core';
import type { Pocket } from '../game/Pocket';
import { el, setHidden } from './dom';
import { weaveGlyphs } from './GrimoireBook';
import { BOOKMARK_ICON } from './icons';

/**
 * El grimorio de bolsillo en partida: debajo de tu vida, la receta de los hechizos que marcaste
 * en el Grimorio. Es solo para leer (no se toca: el hechizo se teje con los botones) y se apaga
 * un poco el que tiene un elemento cansado. Sin nada marcado no aparece.
 */
export class PocketStrip {
  private readonly root: HTMLElement;
  private lastKey: string | undefined;
  private lastTired = '';

  constructor(
    parent: HTMLElement,
    private readonly pocket: Pocket,
  ) {
    this.root = el('div', 'pocket-strip');
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Null lo esconde (caíste, o la pantalla está tapada). */
  render(wizard: Wizard | null): void {
    const weaves = this.pocket.weaves;
    const key = weaves.map(weaveKey).join(',');
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastTired = '';
      const head = el('span', 'pocket-strip-head');
      head.innerHTML = BOOKMARK_ICON;
      head.append(el('span', '', 'Tu bolsillo'));
      const rows = weaves.map((weave) => {
        const row = el('div', 'pocket-strip-row');
        row.append(weaveGlyphs(weave), el('span', 'pocket-strip-name', spellName(weave)));
        return row;
      });
      this.root.replaceChildren(head, ...rows);
    }
    setHidden(this.root, wizard === null || wizard.hp <= 0 || weaves.length === 0);
    if (!wizard || this.root.hidden) return;
    const tired = weaves
      .map((weave) => (weave.some((e) => wizard.fatigue[e] > 0) ? '1' : '0'))
      .join('');
    if (tired === this.lastTired) return;
    this.lastTired = tired;
    this.root.querySelectorAll('.pocket-strip-row').forEach((row, i) => {
      row.classList.toggle('tired', tired[i] === '1');
    });
  }
}
