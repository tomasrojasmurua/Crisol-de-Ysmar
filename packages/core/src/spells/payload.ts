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

/** Los estados que hacen daño por sí solos. */
const DAMAGING: ReadonlySet<StatusId> = new Set(['burn', 'curse', 'plague', 'combusting']);

/**
 * El daño final según quién lanza: sus Glifos y Presagio, la Esencia de los elementos
 * del tejido, la bendición de un santuario, las Esporas, el Velo y la Forja.
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
  // La Forja se gasta en el primer hechizo que de verdad pega.
  if (caster.statuses.forged && payload.damage > 0 && multiplier > 0) {
    multiplier *= rules.statuses.forged.damageMultiplier;
    delete caster.statuses.forged;
  }
  // Con el Lamento encima no pega: tampoco quema ni maldice.
  if (multiplier === 0) {
    const statuses = payload.statuses.filter((s) => !DAMAGING.has(s));
    return { ...payload, damage: 0, statuses };
  }
  return multiplier === 1 ? payload : { ...payload, damage: payload.damage * multiplier };
}
