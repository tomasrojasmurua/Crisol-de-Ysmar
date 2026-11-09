import { resolveAim } from '../match/queries';
import type { MatchState, Wizard } from '../match/state';
import type { Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { SPELL_FORM_BY_ELEMENT, type Weave } from '../weaving/weave';
import type { SpellId } from './catalog';
import { castComet, castFireball, castSpark } from './kit/brasa';
import type { CastContext } from './kit/context';
import { castGeyser, castIceCoffin, castSplash } from './kit/marea';
import { castRootWall, castSap, castThornRush } from './kit/raiz';
import { castBlink, castChainLightning, castStep } from './kit/tormenta';
import { castClaw, castDrain, castVeil } from './kit/umbra';

const CASTERS: Readonly<Record<SpellId, (ctx: CastContext) => void>> = {
  spark: castSpark,
  step: castStep,
  splash: castSplash,
  sap: castSap,
  claw: castClaw,
  fireball: castFireball,
  comet: castComet,
  blink: castBlink,
  chainLightning: castChainLightning,
  geyser: castGeyser,
  iceCoffin: castIceCoffin,
  thornRush: castThornRush,
  rootWall: castRootWall,
  veil: castVeil,
  drain: castDrain,
};

/** Hechizos que no delatan a quien está con Velo. */
const QUIET: ReadonlySet<SpellId> = new Set(['step', 'blink', 'sap', 'veil', 'iceCoffin']);

/** Los hechizos que viajan: el apuntado automático se adelanta al rival según su velocidad. */
function leadSpeedOf(spell: SpellId, rules: GameRules): number {
  if (spell === 'spark') return rules.spells.spark.speed;
  if (spell === 'fireball') return rules.spells.fireball.speed;
  return 0;
}

/** Hace salir un hechizo propio ya canalizado. */
export function castSpell(
  state: MatchState,
  caster: Wizard,
  spell: SpellId,
  weave: Weave,
  rawAim: Vec2,
  rules: GameRules,
): void {
  // Atacar desde el Velo lo rompe, y ese hechizo pega más. Moverse o curarse no lo rompe.
  const breaksVeil = caster.statuses.veiled !== undefined && !QUIET.has(spell);
  if (breaksVeil) delete caster.statuses.veiled;
  const bonus = breaksVeil ? rules.statuses.veiled.damageMultiplier : 1;
  const aim = resolveAim(state, caster, rawAim, rules, leadSpeedOf(spell, rules));
  const form = SPELL_FORM_BY_ELEMENT[weave[0] ?? 'brasa'];
  state.events.push({ type: 'release', wizardId: caster.id, form, spell });
  CASTERS[spell]({ state, caster, spell, weave, aim, rules, bonus });
}
