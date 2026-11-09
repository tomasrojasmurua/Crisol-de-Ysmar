import { wizardById } from '../match/queries';
import type { MatchState, Wizard } from '../match/state';
import { distance } from '../math/vec2';
import { type GameRules, STATUS_IDS, type StatusId } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { dealDamage } from './hit';

/**
 * Los estados que hacen daño o estorban: el Ataúd helado y la Purificación los quitan,
 * y no entran mientras dura la Purificación.
 */
export const HARMFUL_STATUSES: readonly StatusId[] = [
  'burn',
  'slow',
  'root',
  'curse',
  'airborne',
  'frozen',
  'asleep',
  'soaked',
  'silenced',
  'weak',
  'blind',
  'sluggish',
  'exposed',
  'combusting',
  'plague',
  'tracked',
];

/** Lo que no le entra a una forma: el magma no se frena ni se enraíza, y las raíces no ceden. */
const IMMUNE: Partial<Record<StatusId, readonly StatusId[]>> = {
  magma: ['slow', 'root', 'soaked'],
  deepRooted: ['airborne', 'root', 'slow', 'frozen', 'asleep', 'soaked', 'silenced'],
};

export function immuneTo(wizard: Wizard, status: StatusId): boolean {
  for (const [form, list] of Object.entries(IMMUNE) as [StatusId, readonly StatusId[]][]) {
    if (wizard.statuses[form] && list.includes(status)) return true;
  }
  return false;
}

/** Avanza un paso los estados de un mago: quemadura y maldición hacen daño en el tiempo. */
export function tickStatuses(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const burn = wizard.statuses.burn;
  if (burn) {
    dealDamage(
      state,
      wizard,
      burn.sourceId,
      rules.statuses.burn.damagePerSecond / TICK_RATE,
      'projectile',
    );
  }
  const curse = wizard.statuses.curse;
  if (curse) {
    const amount = Math.min(wizard.hp, rules.statuses.curse.damagePerSecond / TICK_RATE);
    dealDamage(state, wizard, curse.sourceId, amount, 'mark');
    const caster = wizardById(state, curse.sourceId);
    if (caster && caster.hp > 0) {
      caster.hp = Math.min(caster.maxHp, caster.hp + amount * rules.statuses.curse.lifesteal);
    }
  }
  const plague = wizard.statuses.plague;
  if (plague) {
    const spec = rules.statuses.plague;
    dealDamage(state, wizard, plague.sourceId, spec.damagePerSecond / TICK_RATE, 'mark');
    spreadPlague(state, wizard, plague.sourceId, plague.ticks, spec.spreadRadius);
  }
  if (wizard.statuses.regen && wizard.hp > 0) {
    wizard.hp = Math.min(wizard.maxHp, wizard.hp + rules.statuses.regen.healPerSecond / TICK_RATE);
  }
  for (const id of STATUS_IDS) {
    const status = wizard.statuses[id];
    if (status && --status.ticks <= 0) {
      delete wizard.statuses[id];
    }
  }
}

/** Por los aires, en el Ataúd helado, congelado o dormido, un mago no se mueve ni teje. */
export function canAct(wizard: Wizard): boolean {
  const s = wizard.statuses;
  return !s.airborne && !s.stasis && !s.frozen && !s.asleep;
}

/** Silenciado, se puede mover pero no tejer ni lanzar. */
export function canWeave(wizard: Wizard): boolean {
  const s = wizard.statuses;
  // Hecho ola o pantera, no se teje.
  return canAct(wizard) && !s.silenced && !s.surfing && !s.panther;
}

export function moveMultiplier(wizard: Wizard, rules: GameRules): number {
  const s = wizard.statuses;
  if (s.root || s.deepRooted || !canAct(wizard)) {
    return 0;
  }
  let multiplier = wizard.statuses.slow ? rules.statuses.slow.moveMultiplier : 1;
  if (wizard.statuses.soaked) {
    multiplier = Math.min(multiplier, rules.statuses.soaked.moveMultiplier);
  }
  if (wizard.statuses.haste) {
    multiplier *= rules.statuses.haste.moveMultiplier;
  }
  if (s.hunting) multiplier *= rules.statuses.hunting.moveMultiplier;
  if (s.magma) multiplier *= rules.statuses.magma.moveMultiplier;
  if (s.surfing) multiplier *= rules.statuses.surfing.moveMultiplier;
  if (s.panther) multiplier *= rules.statuses.panther.moveMultiplier;
  if (wizard.channel) {
    multiplier *= rules.wizard.channelMoveMultiplier;
  }
  return multiplier;
}

/**
 * La Plaga salta a los rivales de quien la lanzó que se acerquen al enfermo, con el tiempo
 * que a este le queda: así se apaga sola y no rebota para siempre entre dos.
 */
function spreadPlague(
  state: MatchState,
  carrier: Wizard,
  sourceId: number,
  ticksLeft: number,
  radius: number,
): void {
  const source = wizardById(state, sourceId);
  const team = source ? source.team : -1;
  for (const other of state.wizards) {
    if (other === carrier || other.hp <= 0 || other.team === team) continue;
    if (other.statuses.plague || other.statuses.stasis || other.statuses.warded) continue;
    if (distance(other.pos, carrier.pos) > radius) continue;
    other.statuses.plague = { ticks: ticksLeft, sourceId };
  }
}
