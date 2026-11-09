import { applyStatus, dealDamage } from '../../combat/hit';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { currentTarget, isAlive, wizardById } from '../../match/queries';
import { withRng } from '../../match/random';
import type { MatchState, Summon, Wizard } from '../../match/state';
import { add, distance, dot, normalize, scale, sub } from '../../math/vec2';
import type { GameRules, StatusId } from '../../rules';
import type { Weave } from '../../weaving/weave';
import { SPELL_IDS, type SpellId, spellOf } from '../catalog';
import { launch } from './brasa';
import { type CastContext, nextId, payloadFor } from './context';
import { targetInCone } from './shared';

function fizzle(ctx: CastContext): void {
  ctx.state.events.push({ type: 'fizzle', wizardId: ctx.caster.id });
}

/** El rival apuntado; si no hay, el hechizo se pierde. */
function rivalInCone(ctx: CastContext, range: number, coneDot: number): Wizard | null {
  const target = targetInCone(ctx.state, ctx.caster, ctx.aim, range, coneDot, ctx.rules);
  if (target?.kind === 'wizard') return target.wizard;
  fizzle(ctx);
  return null;
}

/** El aliado vivo más alineado con la puntería, a la vista; si no hay, null. */
function allyInCone(ctx: CastContext, range: number, coneDot: number): Wizard | null {
  const { state, caster, rules } = ctx;
  let best: Wizard | null = null;
  let bestAlignment = coneDot;
  for (const ally of state.wizards) {
    if (ally.id === caster.id || ally.team !== caster.team || !isAlive(ally)) continue;
    if (distance(ally.pos, caster.pos) > range) continue;
    if (lineBlocked(caster.pos, ally.pos, rules.map.obstacles)) continue;
    const alignment = dot(normalize(sub(ally.pos, caster.pos)), ctx.aim);
    if (alignment >= bestAlignment) {
      best = ally;
      bestAlignment = alignment;
    }
  }
  return best;
}

/** Aplica un estado y le anota para quién vale (el Juramento, el Injerto, la Venganza). */
export function markStatus(
  state: MatchState,
  wizard: Wizard,
  status: StatusId,
  sourceId: number,
  rules: GameRules,
  extra: { readonly targetId?: number; readonly power?: number },
): void {
  applyStatus(state, wizard, status, sourceId, rules);
  const applied = wizard.statuses[status];
  if (applied) wizard.statuses[status] = { ...applied, ...extra };
}

/** Un estado sobre quien lanza, con un destello para que se vea. */
function selfStatus(ctx: CastContext, status: StatusId): void {
  const { state, caster, rules } = ctx;
  applyStatus(state, caster, status, caster.id, rules);
  state.events.push({ type: 'burst', spell: ctx.spell, pos: caster.pos, radius: 1.2 });
}

/** Si ya lo usó en esta ronda, se pierde; si no, queda anotado. */
function oncePerRound(ctx: CastContext): boolean {
  const { caster, spell } = ctx;
  if (caster.spent.includes(spell)) {
    fizzle(ctx);
    return false;
  }
  caster.spent.push(spell);
  return true;
}

// Carga y ritmo.

/** Propulsión: por un rato, cada hechizo que lanzas te da un salto corto que deja fuego. */
export function castPropulsion(ctx: CastContext): void {
  selfStatus(ctx, 'propelled');
}

/** Forja: tu próximo hechizo de daño pega el doble. */
export function castForge(ctx: CastContext): void {
  selfStatus(ctx, 'forged');
}

/** Sobrecarga: tus próximos hechizos salen sin canalizar (nunca antes del aviso mínimo). */
export function castOverload(ctx: CastContext): void {
  selfStatus(ctx, 'overcharged');
}

/** Rocío: por un rato, cada hechizo que lanzas cura a tu equipo cercano, a ti incluido. */
export function castDew(ctx: CastContext): void {
  selfStatus(ctx, 'dewy');
}

/** Eco ardiente: tu próximo hechizo sale dos veces. */
export function castBurningEcho(ctx: CastContext): void {
  selfStatus(ctx, 'echoing');
}

// Defensas y represalias.

/** Pararrayos humano: atraes los proyectiles rivales y cada uno te da escudo en vez de daño. */
export function castHumanRod(ctx: CastContext): void {
  selfStatus(ctx, 'attracting');
}

/** Espejo de agua: devuelves los proyectiles a quien los lanzó. */
export function castWaterMirror(ctx: CastContext): void {
  selfStatus(ctx, 'mirroring');
}

/** Llanto del abismo: los proyectiles cercanos quedan flotando y al final salen hacia donde miras. */
export function castAbyssWail(ctx: CastContext): void {
  selfStatus(ctx, 'wailing');
}

/** Ortiga: quien te pegue recibe de vuelta la mitad del daño. */
export function castNettle(ctx: CastContext): void {
  selfStatus(ctx, 'thorny');
}

/** Renacer: si caes pronto, vuelves ahí mismo. Una vez por ronda. */
export function castRebirth(ctx: CastContext): void {
  if (oncePerRound(ctx)) selfStatus(ctx, 'rebirth');
}

/** Profundidad: el daño que recibes no llega de golpe, se reparte en los segundos siguientes. */
export function castDepth(ctx: CastContext): void {
  selfStatus(ctx, 'depth');
}

/** Semilla de fuego: sobre el aliado apuntado o sobre ti; al recibir un golpe, explota. */
export function castEmberSeed(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.emberSeed;
  const target = allyInCone(ctx, spell.range, spell.coneDot) ?? caster;
  applyStatus(state, target, 'emberSeed', caster.id, rules);
  state.events.push({ type: 'burst', spell: 'emberSeed', pos: target.pos, radius: 1 });
}

/** Injerto: te unes a un aliado; el daño que reciba cualquiera se reparte entre los dos. */
export function castGraft(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.graft;
  const ally = allyInCone(ctx, spell.range, spell.coneDot);
  if (!ally) {
    fizzle(ctx);
    return;
  }
  markStatus(state, caster, 'grafted', caster.id, rules, { targetId: ally.id });
  markStatus(state, ally, 'grafted', caster.id, rules, { targetId: caster.id });
  state.events.push({ type: 'zap', from: caster.pos, to: ally.pos });
}

/** Venganza: si caes o quedas muy herido pronto, el rival marcado recibe un golpe. */
export function castVengeance(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.vengeance;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  markStatus(state, caster, 'vengeful', caster.id, rules, { targetId: rival.id });
  state.events.push({ type: 'zap', from: caster.pos, to: rival.pos });
}

// Marcas y estados sobre el rival.

/** Hambre de ceniza: si el marcado cae o queda muy herido, descansas todo y te curas. */
export function castAshHunger(ctx: CastContext): void {
  const spell = ctx.rules.spells.ashHunger;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  applyStatus(ctx.state, rival, 'ashHunger', ctx.caster.id, ctx.rules);
  ctx.state.events.push({ type: 'burst', spell: 'ashHunger', pos: rival.pos, radius: 1 });
}

/** Podredumbre: por un rato, cada curación que reciba el rival le hace daño. */
export function castRot(ctx: CastContext): void {
  const spell = ctx.rules.spells.rot;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  applyStatus(ctx.state, rival, 'rotting', ctx.caster.id, ctx.rules);
  ctx.state.events.push({ type: 'burst', spell: 'rot', pos: rival.pos, radius: 1 });
}

/** Mal de ojo: al rival se le cambian de lugar los botones de los elementos. */
export function castEvilEye(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.evilEye;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  // Cuántos lugares rotan los botones: de 1 a 4, nunca quedan donde estaban.
  const shift = withRng(state, (rng) => rng.int(1, 4));
  markStatus(state, rival, 'hexed', caster.id, rules, { power: shift });
  state.events.push({ type: 'burst', spell: 'evilEye', pos: rival.pos, radius: 1 });
}

/** Juramento: por un rato, ni tú ni el rival marcado pueden hacerse daño. */
export function castOath(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.oath;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  markStatus(state, caster, 'oath', caster.id, rules, { targetId: rival.id });
  markStatus(state, rival, 'oath', caster.id, rules, { targetId: caster.id });
  state.events.push({ type: 'zap', from: caster.pos, to: rival.pos });
}

/** Instante: el rival queda detenido en el tiempo: no se mueve, no actúa y no recibe daño. */
export function castInstant(ctx: CastContext): void {
  const spell = ctx.rules.spells.instant;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  applyStatus(ctx.state, rival, 'halted', ctx.caster.id, ctx.rules);
  ctx.state.events.push({ type: 'burst', spell: 'instant', pos: rival.pos, radius: 1.2 });
}

/** Sombra fatal: si al rival le queda poca vida, cae al instante; si no, no pasa nada. */
export function castFatalShadow(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.fatalShadow;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  if (rival.hp / rival.maxHp >= spell.threshold) {
    fizzle(ctx);
    return;
  }
  state.events.push({ type: 'burst', spell: 'fatalShadow', pos: rival.pos, radius: 1.4 });
  dealDamage(state, rival, caster.id, rival.hp, 'mark', true, true);
}

/** Transfusión: si tienes menos vida que el rival, intercambian el porcentaje. Una vez por ronda. */
export function castTransfusion(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.transfusion;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  const mine = caster.hp / caster.maxHp;
  const theirs = rival.hp / rival.maxHp;
  if (mine >= theirs || rival.statuses.halted || rival.statuses.stasis) {
    fizzle(ctx);
    return;
  }
  if (!oncePerRound(ctx)) return;
  caster.hp = theirs * caster.maxHp;
  rival.hp = Math.max(1, mine * rival.maxHp);
  state.events.push({ type: 'zap', from: rival.pos, to: caster.pos });
  state.events.push({ type: 'burst', spell: 'transfusion', pos: caster.pos, radius: 1.2 });
}

// Contrahechizos.

/** Cortocircuito: si el rival cercano está tejiendo, su hechizo se cancela y queda aturdido. */
export function castShortCircuit(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.shortCircuit;
  const weaving = (w: Wizard): boolean =>
    w.team !== caster.team &&
    isAlive(w) &&
    (w.weave.length > 0 || w.channel !== null) &&
    distance(w.pos, caster.pos) <= spell.range;
  const target = currentTarget(state, caster, rules);
  const victim =
    target && weaving(target)
      ? target
      : state.wizards
          .filter(weaving)
          .sort((a, b) => distance(a.pos, caster.pos) - distance(b.pos, caster.pos))[0];
  if (!victim) {
    fizzle(ctx);
    return;
  }
  victim.weave = [];
  victim.channel = null;
  applyStatus(state, victim, 'stunned', caster.id, rules, spell.stunTicks);
  state.events.push({ type: 'zap', from: caster.pos, to: victim.pos });
  state.events.push({ type: 'burst', spell: 'shortCircuit', pos: victim.pos, radius: 1 });
}

/** Bruma del olvido: a los rivales cercanos se les vacía el tejido y no repiten su último hechizo. */
export function castOblivionMist(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.oblivionMist;
  for (const rival of state.wizards) {
    if (rival.team === caster.team || !isAlive(rival)) continue;
    if (distance(rival.pos, caster.pos) > spell.radius + rules.wizard.radius) continue;
    rival.weave = [];
    rival.channel = null;
    const last = rival.lastWeave ? spellOf(rival.lastWeave) : null;
    markStatus(state, rival, 'forgetful', caster.id, rules, {
      power: last ? SPELL_IDS.indexOf(last) : -1,
    });
  }
  state.events.push({
    type: 'burst',
    spell: 'oblivionMist',
    pos: caster.pos,
    radius: spell.radius,
  });
}

/** Hurto: el próximo hechizo que lance el rival no sale: te lo quedas tú para lanzarlo. */
export function castPickpocket(ctx: CastContext): void {
  const spell = ctx.rules.spells.pickpocket;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  applyStatus(ctx.state, rival, 'robbed', ctx.caster.id, ctx.rules);
  ctx.state.events.push({ type: 'zap', from: rival.pos, to: ctx.caster.pos });
}

/** Lamento: los rivales en un cono no pueden hacer daño con sus hechizos por un rato. */
export function castLament(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.lament;
  for (const rival of state.wizards) {
    if (rival.team === caster.team || !isAlive(rival)) continue;
    const offset = sub(rival.pos, caster.pos);
    const d = distance(rival.pos, caster.pos);
    if (d > spell.range + rules.wizard.radius) continue;
    if (d > 1 && dot(normalize(offset), ctx.aim) < spell.coneDot) continue;
    applyStatus(state, rival, 'muted', caster.id, rules);
  }
  const pos = add(caster.pos, scale(ctx.aim, spell.range * 0.5));
  state.events.push({ type: 'burst', spell: 'lament', pos, radius: spell.range * 0.5 });
}

// Fatiga.

/** Estruendo: los rivales cercanos se cansan del último elemento que usaron. */
export function castThunderclap(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.thunderclap;
  for (const rival of state.wizards) {
    if (rival.team === caster.team || !isAlive(rival)) continue;
    if (distance(rival.pos, caster.pos) > spell.radius + rules.wizard.radius) continue;
    const last = rival.lastWeave?.[rival.lastWeave.length - 1];
    if (last) rival.fatigue[last] = Math.max(rival.fatigue[last], spell.fatigueTicks);
  }
  state.events.push({ type: 'burst', spell: 'thunderclap', pos: caster.pos, radius: spell.radius });
}

// Copias.

/** Los hechizos que no se copian ni se roban: copiarlos no tendría sentido. */
const UNCOPYABLE: ReadonlySet<SpellId> = new Set(['reflection', 'pickpocket']);

/** Reflejo: copias el último hechizo del rival; sale en tu próximo lanzamiento. */
export function castReflection(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const rival = currentTarget(state, caster, rules);
  const weave = rival?.lastWeave ?? null;
  const spell = weave ? spellOf(weave) : null;
  if (!rival || !weave || !spell || UNCOPYABLE.has(spell)) {
    fizzle(ctx);
    return;
  }
  caster.held = { spell, weave, ticksLeft: rules.spells.reflection.heldTicks };
  state.events.push({ type: 'zap', from: rival.pos, to: caster.pos });
  state.events.push({ type: 'burst', spell: 'reflection', pos: caster.pos, radius: 1.2 });
}

/** Lo que roba el Hurto: el hechizo del marcado pasa a quien lo marcó. */
export function stealSpell(
  state: MatchState,
  victim: Wizard,
  spell: SpellId,
  weave: Weave,
  rules: GameRules,
): void {
  const robbed = victim.statuses.robbed;
  delete victim.statuses.robbed;
  state.events.push({ type: 'fizzle', wizardId: victim.id });
  const thief = wizardById(state, robbed?.sourceId ?? null);
  if (!thief || !isAlive(thief) || UNCOPYABLE.has(spell)) return;
  thief.held = { spell, weave: [...weave], ticksLeft: rules.spells.pickpocket.heldTicks };
  state.events.push({ type: 'zap', from: victim.pos, to: thief.pos });
}

// Control.

/** Rayo de enlace: une a dos rivales; con uno solo, lo une a ti. Si se separan, el rival queda aturdido. */
export function castLinkBolt(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.linkBolt;
  const first = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!first) return;
  const second = state.wizards
    .filter((w) => w.team !== caster.team && w.id !== first.id && isAlive(w))
    .sort((a, b) => distance(a.pos, first.pos) - distance(b.pos, first.pos))[0];
  const other = second ?? caster;
  state.spells.push({
    kind: 'bond',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    aId: first.id,
    bId: other.id,
    ticksLeft: spell.durationTicks,
  });
  state.events.push({ type: 'zap', from: first.pos, to: other.pos });
}

// Economía.

/** Sifón: un proyectil; si acierta, robas Esencia o, si el rival no tiene, descanso. */
export function castSiphon(ctx: CastContext): void {
  const spell = ctx.rules.spells.siphon;
  launch(ctx, spell, payloadFor(ctx, spell.damage));
}

/** Cosecha de almas: tus golpes fuertes y las caídas cercanas te dan Esencia. */
export function castSoulHarvest(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  applyStatus(state, caster, 'harvesting', caster.id, rules);
  const applied = caster.statuses.harvesting;
  if (applied) caster.statuses.harvesting = { ...applied, power: 0 };
  state.events.push({ type: 'burst', spell: 'soulHarvest', pos: caster.pos, radius: 1.5 });
}

// Tiempo.

/** Retroceso: vuelves a donde estabas hace unos segundos, con la vida que tenías entonces. */
export function castRewind(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const sample = caster.past[0];
  if (!sample) {
    fizzle(ctx);
    return;
  }
  const from = caster.pos;
  caster.pos = placeInArena({ x: sample.x, z: sample.z }, rules.wizard.radius, rules);
  caster.hp = Math.min(caster.maxHp, Math.max(1, sample.hp));
  caster.leap = null;
  caster.past = [];
  state.events.push({ type: 'blink', spell: 'rewind', wizardId: caster.id, from, to: caster.pos });
}

// Detonadores.

/** Muñeco vudú: un muñeco frente a ti; todo el daño que le hagas lo recibe el rival marcado. */
export function castVoodooDoll(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.voodooDoll;
  const rival = rivalInCone(ctx, spell.range, spell.coneDot);
  if (!rival) return;
  for (const s of state.spells) {
    if (s.kind === 'summon' && s.summon === 'voodooDoll' && s.ownerId === caster.id) s.hp = 0;
  }
  const pos = placeInArena(add(caster.pos, scale(ctx.aim, spell.distance)), spell.radius, rules);
  // El muñeco es del equipo del rival: así tus hechizos lo golpean y los suyos no.
  const doll: Summon = {
    kind: 'summon',
    summon: 'voodooDoll',
    id: nextId(state),
    ownerId: caster.id,
    team: rival.team,
    pos,
    facing: scale(ctx.aim, -1),
    hp: spell.hp,
    maxHp: spell.hp,
    radius: spell.radius,
    durationTicks: spell.durationTicks,
    ticksLeft: spell.durationTicks,
    cooldown: 0,
    targetId: rival.id,
    slot: 0,
    payload: payloadFor(ctx, 0),
  };
  state.spells.push(doll);
  state.events.push({ type: 'zap', from: pos, to: rival.pos });
}
