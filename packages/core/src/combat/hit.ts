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
  const before = target.hp;
  dealDamage(state, target, sourceId, payload.damage * damageScale, payload.form);
  const dealt = before - target.hp;
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
  damage: number,
  form: HitForm,
): void {
  let amount = damage;
  if (amount <= 0 || target.hp <= 0 || target.statuses.stasis) {
    return;
  }
  // Recibir daño rompe el Velo, aunque lo ataje la coraza.
  delete target.statuses.veiled;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    amount -= absorbed;
    if (amount <= 0) return;
  }
  target.damageTaken += amount;
  target.hp = Math.max(0, target.hp - amount);
  state.events.push({ type: 'hit', targetId: target.id, sourceId, amount, form });
  if (target.hp === 0) {
    target.weave = [];
    target.channel = null;
    target.leap = null;
    state.events.push({ type: 'defeated', wizardId: target.id });
  }
}

/**
 * Aplica un estado; dura más o menos según los Glifos de quien lo lanzó.
 * `ticks` reemplaza la duración de las reglas, para hechizos con un tiempo propio.
 */
export function applyStatus(
  state: MatchState,
  target: Wizard,
  status: StatusId,
  sourceId: number,
  rules: GameRules,
  ticks: number = rules.statuses[status].ticks,
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
    ticks: Math.max(1, Math.round(ticks * duration)),
    sourceId,
  };
}
