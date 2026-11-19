import { spellName } from '@crisol/content';
import { type Highlight, SPELL_WEAVES, TICK_RATE } from '@crisol/core';
import type { HighlightView } from '../ui/HighlightCard';

/** Quién es cada mago en pantalla. */
export interface HighlightNames {
  readonly playerId: number;
  readonly nameOf: (id: number) => string;
  readonly colorOf: (id: number) => string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Traduce la mejor jugada a lo que se lee: "84 de daño · 2 derribos · a 2 rivales · en 2,4 s".
 * `whole` es la de la partida, que dice además en qué ronda fue.
 */
export function highlightView(
  highlight: Highlight,
  whole: boolean,
  names: HighlightNames,
): HighlightView {
  const facts = [`${highlight.damage.toLocaleString('es-CL')} de daño`];
  if (highlight.knockouts > 0) facts.push(plural(highlight.knockouts, 'derribo', 'derribos'));
  if (highlight.targets > 1) facts.push(`a ${highlight.targets} rivales`);
  if (highlight.reactions > 0) facts.push(plural(highlight.reactions, 'reacción', 'reacciones'));
  // La duración solo dice algo cuando fue una seguidilla, no un golpe solo.
  const seconds = highlight.ticks / TICK_RATE;
  if (highlight.hits > 1 && seconds >= 0.5)
    facts.push(`en ${seconds.toLocaleString('es-CL', { maximumFractionDigits: 1 })} s`);
  const own = highlight.wizardId === names.playerId;
  return {
    kicker: whole ? 'Jugada de la partida' : 'Jugada de la ronda',
    name: own ? 'Tú' : names.nameOf(highlight.wizardId),
    color: names.colorOf(highlight.wizardId),
    own,
    spells: highlight.spells.map((spell) => ({
      name: spellName(SPELL_WEAVES[spell]),
      weave: SPELL_WEAVES[spell],
    })),
    facts,
    tag: highlight.decisive
      ? whole
        ? `Cerró la ronda ${highlight.round}`
        : 'Cerró la ronda'
      : whole
        ? `Ronda ${highlight.round}`
        : null,
  };
}
