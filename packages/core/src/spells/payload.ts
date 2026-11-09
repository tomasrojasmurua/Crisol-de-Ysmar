import type { SpellPayload, Wizard } from '../match/state';
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

/**
 * El daño final según quién lanza: sus Glifos y Presagio, la Esencia de los elementos
 * del tejido y la bendición de un santuario.
 */
export function empowerPayload(
  payload: SpellPayload,
  caster: Wizard,
  rules: GameRules,
): SpellPayload {
  const mods = caster.mods;
  let multiplier =
    mods.damage *
    (mods.damageByLength[payload.weave.length - 1] ?? 1) *
    mods.formDamage[payload.form];
  for (const element of new Set(payload.weave)) {
    multiplier *= 1 + caster.essence[element] * rules.beasts.essenceDamagePerStack;
  }
  if (caster.statuses.empowered) {
    multiplier *= rules.statuses.empowered.damageMultiplier;
  }
  return multiplier === 1 ? payload : { ...payload, damage: payload.damage * multiplier };
}
