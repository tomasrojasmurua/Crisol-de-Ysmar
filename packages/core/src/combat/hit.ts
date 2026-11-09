import { wizardById } from '../match/queries';
import type { GameEvent, MatchState, SpellPayload, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { HARMFUL_STATUSES, immuneTo } from './statuses';

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
  if (target.hp <= 0 || target.statuses.stasis || target.statuses.halted) {
    return;
  }
  const before = target.hp;
  dealDamage(state, target, sourceId, payload.damage * damageScale, payload.form, payload.pierce);
  const dealt = before - target.hp;
  const caster = wizardById(state, sourceId);
  if (caster && caster.hp > 0 && caster.mods.lifesteal > 0) {
    healWizard(state, caster, dealt * caster.mods.lifesteal);
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
  /** Un golpe que ya pasó por la Profundidad o el Injerto: no se vuelve a desviar. */
  settled = false,
): void {
  let amount = damage;
  const s = target.statuses;
  if (amount <= 0 || target.hp <= 0 || s.stasis || s.halted || s.untouchable) {
    return;
  }
  if (sworn(state, target, sourceId)) return;
  if (!settled) {
    // El Ácido hace que todo pegue más (una sola vez, aunque el golpe se reparta).
    amount *= s.exposed?.power ?? 1;
    if (divert(state, target, sourceId, amount, form, pierce)) return;
  }
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
  leech(state, sourceId, before - target.hp);
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
  // Dentro del Ataúd helado o detenido en el tiempo no entra ningún estado; con la Purificación
  // o los Mil pasos no entra ninguno dañino.
  if (target.statuses.stasis || target.statuses.halted) {
    return;
  }
  const shielded = target.statuses.warded || target.statuses.untouchable;
  if (shielded && HARMFUL_STATUSES.includes(status)) {
    return;
  }
  if (immuneTo(target, status)) {
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
    ...(status === 'leeching' ? { power: rules.statuses.leeching.lifesteal } : {}),
    ...(status === 'depth' ? { power: rules.statuses.depth.spreadTicks } : {}),
    ...(status === 'grafted' ? { power: rules.statuses.grafted.share } : {}),
    ...(status === 'overcharged' ? { power: rules.statuses.overcharged.charges } : {}),
  };
}

/** Niebla carmesí: quien la lanzó se cura con parte de lo que pega. */
function leech(state: MatchState, sourceId: number, dealt: number): void {
  if (dealt <= 0) return;
  const source = wizardById(state, sourceId);
  const share = source?.statuses.leeching?.power;
  if (!source || source.hp <= 0 || share === undefined) return;
  healWizard(state, source, dealt * share);
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
  if (best) healWizard(state, best, dealt);
}

/**
 * Cura a un mago hasta su máximo. Con la Podredumbre, la curación le hace daño en su lugar.
 * Toda curación pasa por aquí.
 */
export function healWizard(state: MatchState, wizard: Wizard, amount: number): void {
  if (amount <= 0 || wizard.hp <= 0) return;
  const rot = wizard.statuses.rotting;
  if (rot) {
    dealDamage(state, wizard, rot.sourceId, amount, 'mark', true, true);
    return;
  }
  wizard.hp = Math.min(wizard.maxHp, wizard.hp + amount);
}

/** Juramento: quien juró y su marcado no se pueden hacer daño. */
function sworn(state: MatchState, target: Wizard, sourceId: number): boolean {
  if (target.statuses.oath?.targetId === sourceId) return true;
  const source = wizardById(state, sourceId);
  return source?.statuses.oath?.targetId === target.id;
}

/**
 * La Profundidad reparte el golpe en el tiempo y el Injerto lo divide con el aliado unido.
 * Devuelve true si el golpe ya se resolvió por otro camino.
 */
function divert(
  state: MatchState,
  target: Wizard,
  sourceId: number,
  amount: number,
  form: HitForm,
  pierce: boolean,
): boolean {
  const depth = target.statuses.depth;
  if (depth?.power) {
    const ticks = Math.max(1, Math.round(depth.power));
    state.spells.push({
      kind: 'deferred',
      id: state.nextEntityId++,
      ownerId: sourceId,
      team: wizardById(state, sourceId)?.team ?? -1,
      targetId: target.id,
      perTick: amount / ticks,
      ticksLeft: ticks,
    });
    return true;
  }
  const graft = target.statuses.grafted;
  const partner = graft ? wizardById(state, graft.targetId ?? null) : undefined;
  if (graft && partner && partner.hp > 0 && partner.statuses.grafted?.targetId === target.id) {
    const share = graft.power ?? 0.5;
    dealDamage(state, partner, sourceId, amount * share, form, pierce, true);
    dealDamage(state, target, sourceId, amount * (1 - share), form, pierce, true);
    return true;
  }
  return false;
}
