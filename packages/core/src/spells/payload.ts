import type { SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { recipeOf, SPELL_FORM_BY_ELEMENT, type Weave } from '../weaving/weave';
import type { SpellId } from './catalog';

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
    spell: null,
    blastRadius: 0,
  };
}

/**
 * Lo que lleva un hechizo propio. La forma sale del primer elemento, así los Glifos
 * que potencian una forma también potencian los hechizos que empiezan con ese elemento.
 */
export function spellPayload(
  spell: SpellId,
  weave: Weave,
  damage: number,
  statuses: readonly StatusId[] = [],
  blastRadius = 0,
): SpellPayload {
  const first = weave[0] ?? 'brasa';
  return {
    form: SPELL_FORM_BY_ELEMENT[first],
    weave,
    damage,
    statuses,
    speedMultiplier: 1,
    rangeMultiplier: 1,
    hasStorm: false,
    spell,
    blastRadius,
  };
}

/**
 * El daño final según quién lanza: sus Glifos y Presagio, la Esencia de los elementos
 * del tejido, la bendición de un santuario y el Velo.
 */
export function empowerPayload(
  payload: SpellPayload,
  caster: Wizard,
  rules: GameRules,
  /** Multiplicador extra, como el del primer hechizo que sale del Velo. */
  extra = 1,
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
  multiplier *= extra;
  return multiplier === 1 ? payload : { ...payload, damage: payload.damage * multiplier };
}
