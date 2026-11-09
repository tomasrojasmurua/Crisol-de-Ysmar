import type { MatchState, SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';

/** Aplica un impacto: daño, interacciones entre elementos y estados. */
export function applyHit(
  state: MatchState,
  target: Wizard,
  sourceId: number,
  payload: SpellPayload,
  rules: GameRules,
  damageScale = 1,
): void {
  if (target.hp <= 0) {
    return;
  }
  let amount = payload.damage * damageScale;
  if (payload.hasStorm && target.statuses.slow) {
    amount *= rules.interactions.stormVsSlowedMultiplier;
  }
  dealDamage(state, target, sourceId, amount, payload.form);
  for (const status of payload.statuses) {
    applyStatus(target, status, sourceId, rules);
  }
}

export function dealDamage(
  state: MatchState,
  target: Wizard,
  sourceId: number,
  amount: number,
  form: SpellPayload['form'] | 'zone',
): void {
  if (amount <= 0 || target.hp <= 0) {
    return;
  }
  target.hp = Math.max(0, target.hp - amount);
  state.events.push({ type: 'hit', targetId: target.id, sourceId, amount, form });
  if (target.hp === 0) {
    target.weave = [];
    target.channel = null;
    target.leap = null;
    state.events.push({ type: 'defeated', wizardId: target.id });
  }
}

export function applyStatus(
  target: Wizard,
  status: StatusId,
  sourceId: number,
  rules: GameRules,
): void {
  if (status === 'slow' && rules.interactions.tideExtinguishesBurn) {
    delete target.statuses.burn;
  }
  target.statuses[status] = { ticks: rules.statuses[status].ticks, sourceId };
}
