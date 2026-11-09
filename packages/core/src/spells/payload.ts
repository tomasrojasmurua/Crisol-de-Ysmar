import type { SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { SPELL_FORM_BY_ELEMENT, type Weave } from '../weaving/weave';
import type { SpellId } from './catalog';

/**
 * Lo que lleva un hechizo. La familia sale del primer elemento, así los Glifos
 * que potencian una familia también potencian los hechizos que empiezan con ese elemento.
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
    spell,
    blastRadius,
    pierce: false,
  };
}

/**
 * El daño final según quién lanza: sus Glifos y Presagio, la Esencia de los elementos
 * del tejido, la bendición de un santuario, las Esporas y el Velo.
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
  if (caster.statuses.weak) {
    multiplier *= rules.statuses.weak.damageMultiplier;
  }
  multiplier *= extra;
  return multiplier === 1 ? payload : { ...payload, damage: payload.damage * multiplier };
}
