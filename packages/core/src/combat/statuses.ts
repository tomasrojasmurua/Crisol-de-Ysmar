import { wizardById } from '../match/queries';
import type { MatchState, Wizard } from '../match/state';
import type { GameRules, StatusId } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { dealDamage } from './hit';

const STATUS_IDS: readonly StatusId[] = ['burn', 'slow', 'root', 'curse'];

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
      caster.hp = Math.min(rules.wizard.maxHp, caster.hp + amount * rules.statuses.curse.lifesteal);
    }
  }
  for (const id of STATUS_IDS) {
    const status = wizard.statuses[id];
    if (status && --status.ticks <= 0) {
      delete wizard.statuses[id];
    }
  }
}

export function moveMultiplier(wizard: Wizard, rules: GameRules): number {
  if (wizard.statuses.root) {
    return 0;
  }
  let multiplier = wizard.statuses.slow ? rules.statuses.slow.moveMultiplier : 1;
  if (wizard.channel) {
    multiplier *= rules.wizard.channelMoveMultiplier;
  }
  return multiplier;
}
