import { applyHit, applyStatus, dealDamage } from '../../combat/hit';
import { HARMFUL_STATUSES } from '../../combat/statuses';
import { lineBlocked } from '../../match/obstacles';
import { wizardById } from '../../match/queries';
import type {
  Current,
  Ignite,
  MatchState,
  Obsidian,
  Shackle,
  Tether,
  ThornRush,
  Zone,
} from '../../match/state';
import { add, distance, dot, length, scale, sub } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import { hitArea } from './shared';

/**
 * Suelo encantado: el fuego quema y la Ventisca frena a los rivales que lo pisan, las Esporas
 * los debilitan y el Vaho les traba el tejido. El Manantial y la Lluvia de vida curan a los
 * aliados (la Lluvia además los limpia) y la Fuente termal les apura el tejido.
 * Devuelve false cuando se apaga.
 */
export function updateZone(state: MatchState, zone: Zone, rules: GameRules): boolean {
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.leap) continue;
    if (distance(wizard.pos, zone.pos) > zone.radius + rules.wizard.radius) continue;
    const ally = wizard.team === zone.team;
    switch (zone.effect) {
      case 'spring':
        if (ally) heal(wizard, rules.spells.spring.healPerSecond / TICK_RATE);
        break;
      case 'healingRain':
        if (ally) {
          heal(wizard, rules.spells.healingRain.healPerSecond / TICK_RATE);
          for (const id of HARMFUL_STATUSES) delete wizard.statuses[id];
        }
        break;
      case 'hotSpring':
        if (ally) applyStatus(state, wizard, 'quickened', zone.ownerId, rules);
        break;
      default:
        if (!ally) applyStatus(state, wizard, ZONE_STATUS[zone.effect], zone.ownerId, rules);
    }
  }
  return --zone.ticksLeft > 0;
}

const ZONE_STATUS = { burn: 'burn', blizzard: 'slow', spores: 'weak', mist: 'sluggish' } as const;

function heal(wizard: { hp: number; maxHp: number }, amount: number): void {
  wizard.hp = Math.min(wizard.maxHp, wizard.hp + amount);
}

/** La Corriente: apura a los aliados que van a favor del río y frena a los rivales dentro. */
export function updateCurrent(state: MatchState, current: Current, rules: GameRules): boolean {
  for (const wizard of state.wizards) {
    if (wizard.hp <= 0 || wizard.leap) continue;
    const offset = sub(wizard.pos, current.origin);
    const along = dot(offset, current.dir);
    const across = Math.abs(offset.x * current.dir.z - offset.z * current.dir.x);
    if (along < 0 || along > current.length || across > current.halfWidth) continue;
    if (wizard.team !== current.team) {
      applyStatus(state, wizard, 'slow', current.ownerId, rules);
    } else if (dot(wizard.moveInput, current.dir) > 0.3) {
      applyStatus(state, wizard, 'haste', current.ownerId, rules);
    }
  }
  return --current.ticksLeft > 0;
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

/** Obsidiana: la coraza estalla cuando se rompe o cuando se acaba el tiempo. */
export function updateObsidian(state: MatchState, obsidian: Obsidian, rules: GameRules): boolean {
  const wearer = wizardById(state, obsidian.ownerId);
  if (!wearer || wearer.hp <= 0) return false;
  if (wearer.shield > 0 && --obsidian.ticksLeft > 0) return true;
  wearer.shield = 0;
  const radius = rules.spells.obsidian.blastRadius;
  hitArea(state, wearer.id, wearer.team, wearer.pos, radius, obsidian.payload, 'obsidian', rules);
  return false;
}

/** Ignición: al terminar, estalla con una parte de todo el daño que el rival recibió mientras duró. */
export function updateIgnite(state: MatchState, ignite: Ignite): boolean {
  const target = wizardById(state, ignite.targetId);
  if (!target || target.hp <= 0) return false;
  if (--ignite.ticksLeft > 0) return true;
  const amount = (target.damageTaken - ignite.takenAtStart) * ignite.payload.damage;
  state.events.push({ type: 'burst', spell: 'ignite', pos: target.pos, radius: 1.5 });
  dealDamage(state, target, ignite.ownerId, amount, ignite.payload.form);
  return false;
}

/** Grillete: si el rival se aleja demasiado de donde lo ataste, la cadena lo frena y lo castiga. */
export function updateShackle(state: MatchState, shackle: Shackle, rules: GameRules): boolean {
  const target = wizardById(state, shackle.targetId);
  if (!target || target.hp <= 0) return false;
  if (distance(target.pos, shackle.anchor) > rules.spells.shackle.leash) {
    state.events.push({ type: 'burst', spell: 'shackle', pos: target.pos, radius: 1 });
    applyHit(state, target, shackle.ownerId, shackle.payload, rules);
    applyStatus(state, target, 'root', shackle.ownerId, rules, rules.spells.shackle.rootTicks);
    target.leap = null;
    return false;
  }
  return --shackle.ticksLeft > 0;
}
