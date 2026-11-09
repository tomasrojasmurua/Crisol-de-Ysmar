import { applyHit, applyStatus, dealDamage } from '../../combat/hit';
import { beastStats, damageBeast } from '../../match/beasts';
import { lineBlocked } from '../../match/obstacles';
import { wizardById } from '../../match/queries';
import type { Geyser, MatchState, Tether, ThornRush, Zone } from '../../match/state';
import { add, distance, length, scale } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import { hitArea } from './shared';

/** Suelo ardiendo: quien lo pisa se quema. Devuelve false cuando se apaga. */
export function updateZone(state: MatchState, zone: Zone, rules: GameRules): boolean {
  for (const wizard of state.wizards) {
    if (wizard.team === zone.team || wizard.hp <= 0 || wizard.leap) continue;
    if (distance(wizard.pos, zone.pos) <= zone.radius + rules.wizard.radius) {
      applyStatus(state, wizard, 'burn', zone.ownerId, rules);
    }
  }
  return --zone.ticksLeft > 0;
}

/** El géiser espera su aviso y brota: daña y levanta por los aires. */
export function updateGeyser(state: MatchState, geyser: Geyser, rules: GameRules): boolean {
  if (--geyser.ticksLeft > 0) return true;
  state.events.push({ type: 'burst', spell: 'geyser', pos: geyser.pos, radius: geyser.radius });
  for (const wizard of state.wizards) {
    if (wizard.team === geyser.team || wizard.hp <= 0) continue;
    if (distance(wizard.pos, geyser.pos) <= geyser.radius + rules.wizard.radius) {
      applyHit(state, wizard, geyser.ownerId, geyser.payload, rules);
      // Por los aires: lo que estaba tejiendo se pierde.
      wizard.channel = null;
      wizard.leap = null;
    }
  }
  for (const beast of state.beasts) {
    if (distance(beast.pos, geyser.pos) <= geyser.radius + beastStats(beast, rules).radius) {
      damageBeast(state, beast, geyser.ownerId, geyser.payload.damage, rules);
    }
  }
  return false;
}

/** Un brote de espinas por intervalo, cada uno más lejos en la línea. */
export function updateThornRush(state: MatchState, rush: ThornRush, rules: GameRules): boolean {
  if (--rush.ticksToNext > 0) return true;
  const spell = rules.spells.thornRush;
  rush.bursts++;
  const pos = add(rush.origin, scale(rush.dir, spell.spacing * rush.bursts));
  if (length(pos) > rules.arenaRadius) return false;
  hitArea(state, rush.ownerId, rush.team, pos, spell.radius, rush.payload, 'thornRush', rules);
  rush.ticksToNext = spell.intervalTicks;
  return rush.bursts < spell.bursts;
}

/** El hilo del Drenaje: roba vida cada paso hasta cortarse por distancia, vista o tiempo. */
export function updateTether(state: MatchState, tether: Tether, rules: GameRules): boolean {
  const caster = wizardById(state, tether.ownerId);
  const target = wizardById(state, tether.targetId);
  if (!caster || !target || caster.hp <= 0 || target.hp <= 0) return false;
  if (distance(caster.pos, target.pos) > rules.spells.drain.breakRange) return false;
  if (lineBlocked(caster.pos, target.pos, rules.map.obstacles)) return false;
  const before = target.hp;
  dealDamage(state, target, caster.id, tether.payload.damage / TICK_RATE, tether.payload.form);
  caster.hp = Math.min(caster.maxHp, caster.hp + (before - target.hp));
  return --tether.ticksLeft > 0;
}
