import { type ComboStep, ELEMENTS } from '@crisol/content';
import { type ElementId, SPELL_WEAVES, type SpellId } from '@crisol/core';
import { el } from './dom';
import { elementIcon } from './icons';

const colorOf = (id: ElementId): string => ELEMENTS.find((e) => e.id === id)?.color ?? '#fff';

/** Dos figuras: el paso que pone el compañero en un combo de equipo. */
const ALLY_ICON =
  '<svg class="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="11" cy="10" r="4"/><path d="M4 26C4 20 7 17 11 17S18 20 18 26"/>' +
  '<circle cx="22" cy="11" r="3.5"/><path d="M20 17.5C25 17 28 20 28 25"/></svg>';

function glyph(element: ElementId): HTMLElement {
  const span = el('span', 'weave-glyph');
  span.style.setProperty('--element', colorOf(element));
  span.innerHTML = elementIcon(element);
  return span;
}

function step(item: ComboStep): HTMLElement {
  const group = el('span', 'combo-step');
  if ('spell' in item) {
    for (const element of SPELL_WEAVES[item.spell]) group.append(glyph(element));
  } else {
    // Círculo punteado: cualquier hechizo (vacío) o cualquiera de ese elemento (con su signo).
    const free = el('span', 'combo-free');
    group.classList.add('free');
    if ('element' in item) {
      free.style.setProperty('--element', colorOf(item.element));
      free.innerHTML = elementIcon(item.element);
      const name = ELEMENTS.find((e) => e.id === item.element)?.name ?? '';
      free.setAttribute('aria-label', `cualquier hechizo de ${name}`);
    } else {
      free.setAttribute('aria-label', 'cualquier hechizo');
    }
    group.append(free);
  }
  if (item.ally) {
    const ally = el('span', 'combo-ally');
    ally.innerHTML = ALLY_ICON;
    ally.title = 'Lo pone un aliado';
    group.append(ally);
  }
  return group;
}

/**
 * Los pasos de un combo como se leen en el Grimorio: los signos de cada hechizo, separados por
 * una flecha. Sirve igual para los combos propios (solo hechizos).
 */
export function comboStepsView(combo: { readonly steps: readonly ComboStep[] }): HTMLElement {
  const row = el('span', 'combo-steps');
  combo.steps.forEach((item, index) => {
    if (index > 0) row.append(el('span', 'combo-arrow', '→'));
    row.append(step(item));
  });
  return row;
}

/** Los pasos de un combo propio, que son siempre hechizos justos. */
export function spellStepsView(spells: readonly SpellId[]): HTMLElement {
  return comboStepsView({ steps: spells.map((spell) => ({ spell })) });
}
