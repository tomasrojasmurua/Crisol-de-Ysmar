import type { SpellPayload } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { recipeOf, type Weave } from '../weaving/weave';

/**
 * Gramática del tejido: el primer elemento da la forma y sus números base;
 * cada elemento siguiente multiplica daño, velocidad y alcance, y puede sumar un estado.
 */
export function buildPayload(weave: Weave, rules: GameRules): SpellPayload | null {
  const recipe = recipeOf(weave);
  if (!recipe) {
    return null;
  }
  const form = rules.forms[recipe.form];
  let damage = form.damage;
  let speedMultiplier = 1;
  let rangeMultiplier = 1;
  const statuses: StatusId[] = form.status ? [form.status] : [];

  for (const element of recipe.modifiers) {
    const modifier = rules.modifiers[element];
    damage *= modifier.damageMultiplier;
    speedMultiplier *= modifier.speedMultiplier;
    rangeMultiplier *= modifier.rangeMultiplier;
    if (modifier.status && !statuses.includes(modifier.status)) {
      statuses.push(modifier.status);
    }
  }

  return {
    form: recipe.form,
    weave,
    damage,
    statuses,
    speedMultiplier,
    rangeMultiplier,
    hasStorm: weave.includes('tormenta'),
  };
}
