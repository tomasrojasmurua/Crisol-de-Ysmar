import { wizardById } from '../match/queries';
import type { GameEvent, MatchState, SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { HARMFUL_STATUSES } from './statuses';

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
  dealDamage(state, target, sourceId, payload.damage * damageScale, payload.form, payload.pierce);
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
  /** La Llama negra no se detiene en escudos. */
  pierce = false,
): void {
  let amount = damage;
  if (amount <= 0 || target.hp <= 0 || target.statuses.stasis) {
    return;
  }
  // El Ácido hace que todo pegue más.
  amount *= target.statuses.exposed?.power ?? 1;
  // Recibir daño rompe el Velo, aunque lo ataje la coraza, y despierta de la Pesadilla.
  delete target.statuses.veiled;
  delete target.statuses.asleep;
  if (target.shield > 0 && !pierce) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    amount -= absorbed;
    if (amount <= 0) return;
  }
  target.damageTaken += amount;
  const before = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  shareWithLink(state, sourceId, before - target.hp);
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
  // Dentro del Ataúd helado no entra ningún estado, y con la Purificación no entra ninguno dañino.
  if (target.statuses.stasis) {
    return;
  }
  if (target.statuses.warded && HARMFUL_STATUSES.includes(status)) {
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
    ...(status === 'exposed' ? { power: rules.statuses.exposed.damageMultiplier } : {}),
  };
}

/** Vínculo vital: lo que pega quien está vinculado cura lo mismo a su aliado vivo más cercano. */
function shareWithLink(state: MatchState, sourceId: number, dealt: number): void {
  if (dealt <= 0) return;
  const source = wizardById(state, sourceId);
  if (!source?.statuses.linked) return;
  let best: Wizard | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ally of state.wizards) {
    if (ally === source || ally.team !== source.team || ally.hp <= 0) continue;
    const d = Math.hypot(ally.pos.x - source.pos.x, ally.pos.z - source.pos.z);
    if (d < bestDistance) {
      best = ally;
      bestDistance = d;
    }
  }
  if (best) best.hp = Math.min(best.maxHp, best.hp + dealt);
}
