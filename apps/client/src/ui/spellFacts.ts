import { ELEMENTS, SPELL_DESCRIPTIONS, SPELL_NAMES } from '@crisol/content';
import { type GameRules, SPELL_WEAVES, type SpellId, TICK_RATE, type Weave } from '@crisol/core';
import { el } from './dom';

const seconds = (ticks: number): string =>
  `${(ticks / TICK_RATE).toLocaleString('es-CL', { maximumFractionDigits: 1 })} s`;
const meters = (m: number): string =>
  `${m.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m`;

/**
 * Los datos de un hechizo leídos de las reglas: así nunca quedan desactualizados si se ajusta el
 * balance. Solo lo que el hechizo tiene: daño, alcance, radio, duración y cuánto tarda en salir.
 */
export function spellFacts(spell: SpellId, rules: GameRules): string[] {
  const values = (rules.spells as unknown as Record<string, Record<string, unknown>>)[spell] ?? {};
  const num = (key: string): number | null =>
    typeof values[key] === 'number' ? (values[key] as number) : null;
  const facts: string[] = [];
  const damage = num('damage');
  if (damage) facts.push(`Daño ${damage}`);
  const range = num('range') ?? num('distance') ?? num('length');
  if (range) facts.push(`Alcance ${meters(range)}`);
  const radius = num('radius');
  if (radius && radius >= 1) facts.push(`Radio ${meters(radius)}`);
  const duration = num('durationTicks');
  if (duration) facts.push(`Dura ${seconds(duration)}`);
  const length = SPELL_WEAVES[spell].length;
  const cast = rules.weave.castTicksByLength[length - 1];
  if (cast) facts.push(`Sale en ${seconds(cast)}`);
  return facts;
}

/** El nombre de un elemento, para leer un tejido en voz alta: "Brasa → Marea". */
export function weaveText(weave: Weave): string {
  return weave.map((e) => ELEMENTS.find((x) => x.id === e)?.name ?? e).join(' → ');
}

/** Una ficha de hechizo: nombre, tejido, qué hace y sus datos. */
export function spellCard(spell: SpellId, rules: GameRules): HTMLElement {
  const card = el('div', 'spell-card');
  card.append(
    el('strong', 'spell-card-name', SPELL_NAMES[spell]),
    el('span', 'spell-card-weave', weaveText(SPELL_WEAVES[spell])),
    el('p', 'spell-card-text', SPELL_DESCRIPTIONS[spell]),
  );
  const facts = el('div', 'spell-card-facts');
  for (const fact of spellFacts(spell, rules)) facts.append(el('span', '', fact));
  card.append(facts);
  return card;
}
