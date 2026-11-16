import { type PathStep, schoolSpellbook } from '@crisol/content';
import type { SpellId } from '@crisol/core';

/** Cómo terminó un paso del Camino. */
export interface PathVerdict {
  readonly passed: boolean;
  /** Si ganaste la serie (puedes ganar y no cumplir la meta). */
  readonly won: boolean;
  /** Por qué no se cumplió, en una frase; vacío si se cumplió. */
  readonly reason: string;
}

/** Lo que hace falta saber de la partida terminada para juzgar el paso. */
export interface PathPlay {
  readonly won: boolean;
  /** Rondas que ganaron los demás bandos, sumadas. */
  readonly roundsLost: number;
  /** Cuántas veces salió cada hechizo tuyo. */
  readonly spells: Partial<Record<SpellId, number>>;
}

/** El primer hechizo tuyo que no es de tu Linaje (para el reto de solo tus hechizos), o null. */
export function foreignSpell(step: PathStep, spell: SpellId): boolean {
  return step.goal.kind === 'ownSpells' && !schoolSpellbook(step.school).includes(spell);
}

/** Si se superó el paso: ganar la serie y, además, su meta. */
export function judgePath(step: PathStep, play: PathPlay): PathVerdict {
  if (!play.won) return { passed: false, won: false, reason: 'Hay que ganar la serie.' };
  const used = (Object.entries(play.spells) as [SpellId, number][])
    .filter(([, count]) => count > 0)
    .map(([spell]) => spell);
  const goal = step.goal;
  const fail = (reason: string): PathVerdict => ({ passed: false, won: true, reason });
  switch (goal.kind) {
    case 'win':
      break;
    case 'sweep':
      if (play.roundsLost > 0) return fail('Perdiste una ronda: tiene que ser sin perder ninguna.');
      break;
    case 'ownSpells':
      if (used.some((spell) => foreignSpell(step, spell)))
        return fail('Usaste hechizos que no son de tu Linaje.');
      break;
    case 'variety':
      if (used.length < goal.spells)
        return fail(`Usaste ${used.length} hechizos distintos de ${goal.spells}.`);
      break;
  }
  return { passed: true, won: true, reason: '' };
}
