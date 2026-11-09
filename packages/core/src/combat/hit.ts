import { wizardById } from '../match/queries';
import type { GameEvent, MatchState, SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';

type HitForm = Extract<GameEvent, { type: 'hit' }>['form'];

/** Aplica un impacto: daño, interacciones entre elementos, robo de vida y estados. */
export function applyHit(
  state: MatchState,
  target: Wizard,
  sourceId: number,
  payload: SpellPayload,
  rules: GameRules,
  damageScale = 1,
): void {
  if (target.hp <= 0 || target.statuses.stasis) {
    return;
  }
  let amount = payload.damage * damageScale;
  if (payload.hasStorm && target.statuses.slow) {
    amount *= rules.interactions.stormVsSlowedMultiplier;
  }
  const dealt = Math.min(target.hp, amount);
  dealDamage(state, target, sourceId, amount, payload.form);
  const caster = wizardById(state, sourceId);
  if (caster && caster.hp > 0 && caster.mods.lifesteal > 0) {
    caster.hp = Math.min(caster.maxHp, caster.hp + dealt * caster.mods.lifesteal);
  }
  for (const status of payload.statuses) {
    applyStatus(state, target, status, sourceId, rules);
  }
}

export function dealDamage(
  state: MatchState,
  target: Wizard,
  sourceId: number,
  amount: number,
  form: HitForm,
): void {
  if (amount <= 0 || target.hp <= 0 || target.statuses.stasis) {
    return;
  }
  // Recibir daño rompe el Velo.
  delete target.statuses.veiled;
  target.hp = Math.max(0, target.hp - amount);
  state.events.push({ type: 'hit', targetId: target.id, sourceId, amount, form });
  if (target.hp === 0) {
    target.weave = [];
    target.channel = null;
    target.leap = null;
    state.events.push({ type: 'defeated', wizardId: target.id });
  }
}

/** Aplica un estado; dura más o menos según los Glifos de quien lo lanzó. */
export function applyStatus(
  state: MatchState,
  target: Wizard,
  status: StatusId,
  sourceId: number,
  rules: GameRules,
): void {
  // Dentro del Ataúd helado no entra ningún estado.
  if (target.statuses.stasis) {
    return;
  }
  if (status === 'slow' && rules.interactions.tideExtinguishesBurn) {
    delete target.statuses.burn;
  }
  const source = wizardById(state, sourceId);
  const duration = source ? source.mods.statusDuration[status] : 1;
  target.statuses[status] = {
    ticks: Math.max(1, Math.round(rules.statuses[status].ticks * duration)),
    sourceId,
  };
}
