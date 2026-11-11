import { ALL_WEAVES, spellName } from '@crisol/content';
import { SPELL_WEAVES, type SpellId, spellOf } from '@crisol/core';
import { type ComboLog, OWN_COMBO_MAX_STEPS, type OwnCombo } from '../game/ComboLog';
import type { Grimoire } from '../game/Grimoire';
import { spellStepsView } from './comboSteps';
import { el, query } from './dom';

/**
 * La hoja en blanco de Mis combos: un nombre, hasta 4 hechizos de los que ya descubriste y una
 * nota. En horizontal, a la izquierda lo que anotas y a la derecha la lista para elegir.
 */
export class OwnComboEditor {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly name: HTMLInputElement;
  private readonly sequence: HTMLElement;
  private readonly note: HTMLTextAreaElement;
  private readonly spells: HTMLElement;
  private readonly save: HTMLButtonElement;
  private readonly remove: HTMLButtonElement;
  private steps: SpellId[] = [];
  private editing: OwnCombo | null = null;
  private log: ComboLog | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onChange: () => void,
  ) {
    this.root = el('div', 'combo-editor');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="combo-editor-card">
        <div class="combo-editor-side">
          <header class="combo-editor-head">
            <h3></h3>
            <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
          </header>
          <input class="combo-editor-name" type="text" maxlength="32" placeholder="Nombre del combo" autocomplete="off" />
          <div class="combo-editor-sequence"></div>
          <textarea class="combo-editor-note" maxlength="160" rows="2" placeholder="Nota: cuándo te sirvió"></textarea>
          <div class="combo-editor-actions">
            <button type="button" class="secondary combo-editor-remove">Borrar</button>
            <button type="button" class="primary combo-editor-save">Guardar</button>
          </div>
        </div>
        <div class="combo-editor-spells"></div>
      </div>`;
    parent.append(this.root);
    this.title = query(this.root, 'h3');
    this.name = query(this.root, '.combo-editor-name');
    this.sequence = query(this.root, '.combo-editor-sequence');
    this.note = query(this.root, '.combo-editor-note');
    this.spells = query(this.root, '.combo-editor-spells');
    this.save = query(this.root, '.combo-editor-save');
    this.remove = query(this.root, '.combo-editor-remove');
    query(this.root, '.grimoire-card-close').addEventListener('click', () => this.hide());
    this.save.addEventListener('click', () => this.commit());
    this.remove.addEventListener('click', () => {
      if (this.editing) this.log?.removeOwn(this.editing.id);
      this.hide();
      this.onChange();
    });
  }

  /** Abre la hoja vacía (`combo` null) o con un combo propio para cambiarlo. */
  open(log: ComboLog, grimoire: Grimoire, combo: OwnCombo | null): void {
    this.log = log;
    this.editing = combo;
    this.steps = [...(combo?.steps ?? [])];
    this.title.textContent = combo ? 'Tu combo' : 'Anotar un combo';
    this.name.value = combo?.name ?? '';
    this.note.value = combo?.note ?? '';
    this.remove.hidden = combo === null;
    this.renderSpells(grimoire);
    this.renderSequence();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.name.blur();
    this.note.blur();
  }

  private commit(): void {
    if (!this.log || this.steps.length === 0) return;
    this.log.saveOwn({
      ...(this.editing ? { id: this.editing.id } : {}),
      name: this.name.value,
      steps: this.steps,
      note: this.note.value,
    });
    this.hide();
    this.onChange();
  }

  /** Los hechizos que ya descubriste, una vez cada uno, en el orden del Grimorio. */
  private renderSpells(grimoire: Grimoire): void {
    const known = new Set<SpellId>();
    for (const weave of ALL_WEAVES) {
      const spell = grimoire.has(weave) ? spellOf(weave) : null;
      if (spell) known.add(spell);
    }
    this.spells.replaceChildren();
    if (known.size === 0) {
      this.spells.append(el('p', 'combo-editor-empty', 'Todavía no descubres hechizos.'));
      return;
    }
    for (const spell of known) {
      const chip = el('button', 'grimoire-spell combo-editor-spell');
      chip.type = 'button';
      chip.append(
        spellStepsView([spell]),
        el('span', 'grimoire-spell-name', spellName(SPELL_WEAVES[spell])),
      );
      chip.addEventListener('click', () => {
        if (this.steps.length >= OWN_COMBO_MAX_STEPS) return;
        this.steps.push(spell);
        this.renderSequence();
      });
      this.spells.append(chip);
    }
  }

  /** Lo elegido hasta ahora; tocar un paso lo quita. */
  private renderSequence(): void {
    this.sequence.replaceChildren();
    if (this.steps.length === 0) {
      this.sequence.append(
        el(
          'span',
          'combo-editor-hint',
          `Toca hechizos de la lista, en orden (hasta ${OWN_COMBO_MAX_STEPS})`,
        ),
      );
    }
    this.steps.forEach((spell, index) => {
      if (index > 0) this.sequence.append(el('span', 'combo-arrow', '→'));
      const chip = el('button', 'combo-editor-step');
      chip.type = 'button';
      chip.setAttribute('aria-label', `Quitar ${spellName(SPELL_WEAVES[spell])}`);
      chip.append(spellStepsView([spell]), el('span', '', spellName(SPELL_WEAVES[spell])));
      chip.addEventListener('click', () => {
        this.steps.splice(index, 1);
        this.renderSequence();
      });
      this.sequence.append(chip);
    });
    this.save.disabled = this.steps.length === 0;
  }
}
