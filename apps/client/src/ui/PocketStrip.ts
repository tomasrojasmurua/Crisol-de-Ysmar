import { type Combo, spellName } from '@crisol/content';
import { type Weave, type Wizard, weaveKey } from '@crisol/core';
import type { Pocket } from '../game/Pocket';
import { comboStepsView } from './comboSteps';
import { el, setHidden } from './dom';
import { weaveGlyphs } from './GrimoireBook';
import { BOOKMARK_ICON } from './icons';

/** Lo que se fue a probar desde el Grimorio: un hechizo o un combo. */
export type Practice =
  | { readonly kind: 'spell'; readonly weave: Weave }
  | { readonly kind: 'combo'; readonly combo: Combo };

/**
 * El grimorio de bolsillo en partida: debajo de tu vida, la receta de los hechizos que marcaste
 * en el Grimorio. Es solo para leer (no se toca: el hechizo se teje con los botones) y se apaga
 * un poco el que tiene un elemento cansado. Sin nada marcado no aparece.
 */
export class PocketStrip {
  private readonly root: HTMLElement;
  private lastKey: string | undefined;
  private lastTired = '';
  /**
   * En Entrenamiento, lo que viniste a probar desde el Grimorio: ocupa el lugar del bolsillo
   * (sin cambiarlo) hasta volver al menú.
   */
  private practice: Practice | null = null;

  constructor(
    parent: HTMLElement,
    private readonly pocket: Pocket,
  ) {
    this.root = el('div', 'pocket-strip');
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Lo que se vino a probar (null vuelve al bolsillo). */
  setPractice(practice: Practice | null): void {
    this.practice = practice;
    this.lastKey = undefined;
  }

  /** Null lo esconde (caíste, o la pantalla está tapada). */
  render(wizard: Wizard | null): void {
    if (this.practice) {
      this.renderPractice(this.practice, wizard);
      return;
    }
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
      this.root.classList.remove('practice');
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

  /** "Probando" con la receta del hechizo o los pasos del combo, siempre a la vista. */
  private renderPractice(practice: Practice, wizard: Wizard | null): void {
    const key =
      practice.kind === 'spell' ? `h:${weaveKey(practice.weave)}` : `c:${practice.combo.id}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastTired = '';
      const head = el('span', 'pocket-strip-head');
      head.innerHTML = BOOKMARK_ICON;
      head.append(el('span', '', 'Probando'));
      const row = el('div', 'pocket-strip-row');
      if (practice.kind === 'spell') {
        row.append(
          weaveGlyphs(practice.weave),
          el('span', 'pocket-strip-name', spellName(practice.weave)),
        );
      } else {
        row.classList.add('combo');
        row.append(
          el('span', 'pocket-strip-name', practice.combo.name),
          comboStepsView(practice.combo),
        );
      }
      this.root.replaceChildren(head, row);
      this.root.classList.toggle('practice', true);
    }
    setHidden(this.root, wizard === null || wizard.hp <= 0);
  }
}
