import { dealDamage, healWizard } from '../../combat/hit';
import { canAct } from '../../combat/statuses';
import { ELEMENT_IDS, type ElementId } from '../../elements';
import { placeInArena } from '../../match/obstacles';
import { isAlive, wizardById } from '../../match/queries';
import type { Echo, MatchState, Wizard } from '../../match/state';
import { distance, scale, type Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { SPELL_FORM_BY_ELEMENT, type SpellForm, type Weave } from '../../weaving/weave';
import { SPELL_IDS, SPELL_WEAVES, type SpellId, spellOf } from '../catalog';
import { spellPayload } from '../payload';
import { hitArea } from './shared';

/**
 * Los hechizos que saltan o teletransportan: dentro del Diluvio no salen.
 * El Paso, el Cometa y el resto de los que mueven de golpe a quien los lanza.
 */
export const MOBILITY: ReadonlySet<SpellId> = new Set([
  'step',
  'comet',
  'blink',
  'shadowStep',
  'vine',
  'emberStride',
  'swap',
  'tempest',
  'treeStride',
  'portal',
  'rootCatapult',
  'thousandSteps',
  'rewind',
  'lilyPads',
  'zipline',
  'thrownShadow',
]);

/**
 * Antes de canalizar: con la Bruma del olvido no se puede repetir el último hechizo.
 * Devuelve false si el tejido no sale (se vacía y no cansa nada).
 */
export function mayChannel(state: MatchState, wizard: Wizard, weave: Weave): boolean {
  const forgetful = wizard.statuses.forgetful;
  if (!forgetful || forgetful.power === undefined || forgetful.power < 0) return true;
  const spell = spellOf(weave);
  if (!spell || SPELL_IDS.indexOf(spell) !== forgetful.power) return true;
  wizard.weave = [];
  state.events.push({ type: 'fizzle', wizardId: wizard.id });
  return false;
}

/** Sobrecarga: los próximos tejidos salen con el aviso mínimo. Devuelve los pasos que tarda. */
export function overchargedTicks(wizard: Wizard, castTicks: number, floor: number): number {
  const charge = wizard.statuses.overcharged;
  if (!charge) return castTicks;
  const left = (charge.power ?? 1) - 1;
  if (left <= 0) delete wizard.statuses.overcharged;
  else wizard.statuses.overcharged = { ...charge, power: left };
  return floor;
}

/** Después de lanzar: lo recuerda, y lo repiten el Eco ardiente, la Propulsión y el Rocío. */
export function afterCast(
  state: MatchState,
  caster: Wizard,
  spell: SpellId,
  weave: Weave,
  aim: Vec2,
  rules: GameRules,
  fromEcho: boolean,
): void {
  caster.lastWeave = weave;
  const s = caster.statuses;
  if (s.echoing && !fromEcho && spell !== 'burningEcho') {
    delete s.echoing;
    state.spells.push({
      kind: 'echo',
      id: state.nextEntityId++,
      ownerId: caster.id,
      team: caster.team,
      spell,
      weave,
      aim,
      pos: caster.pos,
      ticksLeft: rules.statuses.echoing.delayTicks,
    });
  }
  if (s.propelled && spell !== 'propulsion' && !caster.leap && !s.grounded && canAct(caster)) {
    const spec = rules.statuses.propelled;
    caster.leap = {
      ticksLeft: spec.leapTicks,
      step: scale(aim, spec.distance / spec.leapTicks),
      trail: 'fire',
    };
  }
  if (s.dewy && spell !== 'dew') {
    const spec = rules.statuses.dewy;
    for (const ally of state.wizards) {
      if (ally.team !== caster.team || !isAlive(ally)) continue;
      if (distance(ally.pos, caster.pos) > spec.radius) continue;
      healWizard(state, ally, spec.heal);
    }
    state.events.push({ type: 'burst', spell: 'dew', pos: caster.pos, radius: 1.5 });
  }
}

/** El Eco ardiente espera su momento; lo lanza `fireEchoes`, fuera del avance de hechizos. */
export function updateEcho(echo: Echo): boolean {
  if (echo.ticksLeft > 0) echo.ticksLeft--;
  return true;
}

/**
 * Lanza los ecos que llegaron a su momento, desde el lugar donde salió el original.
 * Va después de avanzar los hechizos para no cambiar la lista mientras se recorre.
 */
export function fireEchoes(
  state: MatchState,
  rules: GameRules,
  cast: (caster: Wizard, spell: SpellId, weave: Weave, aim: Vec2) => void,
): void {
  const ready = state.spells.filter((s): s is Echo => s.kind === 'echo' && s.ticksLeft <= 0);
  if (ready.length === 0) return;
  state.spells = state.spells.filter((s) => !(s.kind === 'echo' && s.ticksLeft <= 0));
  for (const echo of ready) {
    const caster = wizardById(state, echo.ownerId);
    if (!caster || !isAlive(caster)) continue;
    const here = caster.pos;
    caster.pos = echo.pos;
    cast(caster, echo.spell, echo.weave, echo.aim);
    // Si el eco no lo movió (un Paso, un Destello), vuelve a donde estaba.
    if (caster.pos === echo.pos) caster.pos = placeInArena(here, rules.wizard.radius, rules);
  }
}

/** Guarda dónde está y con cuánta vida, para el Retroceso. */
export function recordPast(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const spec = rules.spells.rewind;
  if (state.tick % spec.sampleTicks !== 0) return;
  wizard.past.push({ x: wizard.pos.x, z: wizard.pos.z, hp: wizard.hp });
  if (wizard.past.length > spec.samples) wizard.past.shift();
}

/** Sombra lanzada: tocar ✦ sin tejer te lleva a tu sombra. Devuelve true si saltó. */
export function jumpToShadow(state: MatchState, wizard: Wizard, rules: GameRules): boolean {
  const mark = state.spells.find(
    (s) =>
      s.kind === 'field' && s.mode === 'shadowMark' && s.ownerId === wizard.id && s.ticksLeft > 0,
  );
  if (mark?.kind !== 'field' || !canAct(wizard) || wizard.statuses.grounded) return false;
  const from = wizard.pos;
  wizard.pos = placeInArena(mark.pos, rules.wizard.radius, rules);
  wizard.leap = null;
  mark.ticksLeft = 0;
  state.events.push({
    type: 'blink',
    spell: 'thrownShadow',
    wizardId: wizard.id,
    from,
    to: wizard.pos,
  });
  return true;
}

const ELEMENT_BY_FORM: Readonly<Record<SpellForm, ElementId>> = Object.fromEntries(
  ELEMENT_IDS.map((e) => [SPELL_FORM_BY_ELEMENT[e], e]),
) as Record<SpellForm, ElementId>;

/**
 * Lo que responde a los golpes de este paso: la Ortiga devuelve daño, la Semilla de fuego
 * explota, la Cosecha de almas junta Esencia, y la Venganza, el Hambre de ceniza y el Renacer
 * miran quién quedó muy herido o cayó. Va al final del paso, antes de contar las caídas.
 */
export function resolveReactions(state: MatchState, rules: GameRules): void {
  const events = state.events.slice();
  for (const event of events) {
    if (event.type === 'hit') {
      if (event.form === 'zone' || event.sourceId === event.targetId) continue;
      const target = wizardById(state, event.targetId);
      if (!target) continue;
      const source = wizardById(state, event.sourceId);
      reflectThorns(state, target, source, event.amount, rules);
      burstSeed(state, target, event.amount, rules);
      if (source && event.form !== 'beast') harvestHit(source, event.amount, event.form, rules);
    } else if (event.type === 'defeated') {
      const fallen = wizardById(state, event.wizardId);
      if (fallen) harvestFall(state, fallen.pos, 'umbra', rules);
    } else if (event.type === 'beastSlain') {
      const beast = state.beasts.find((b) => b.id === event.beastId);
      if (beast) harvestFall(state, beast.pos, event.element, rules);
    }
  }
  for (const wizard of state.wizards) {
    if (wizard.fallen) continue;
    avenge(state, wizard, rules);
    feedHunger(state, wizard, rules);
    rise(state, wizard, rules);
  }
}

function reflectThorns(
  state: MatchState,
  target: Wizard,
  source: Wizard | undefined,
  amount: number,
  rules: GameRules,
): void {
  if (!target.statuses.thorny || !source || source.team === target.team || source.hp <= 0) return;
  dealDamage(state, source, target.id, amount * rules.statuses.thorny.reflect, 'mark', false, true);
  if (amount >= 1)
    state.events.push({ type: 'burst', spell: 'nettle', pos: source.pos, radius: 0.7 });
}

function burstSeed(state: MatchState, carrier: Wizard, amount: number, rules: GameRules): void {
  const seed = carrier.statuses.emberSeed;
  if (!seed || amount < 1) return;
  delete carrier.statuses.emberSeed;
  const spec = rules.statuses.emberSeed;
  const payload = spellPayload('emberSeed', SPELL_WEAVES.emberSeed, spec.damage, ['burn']);
  hitArea(
    state,
    seed.sourceId,
    carrier.team,
    carrier.pos,
    spec.radius,
    payload,
    'emberSeed',
    rules,
  );
}

function gainEssence(wizard: Wizard, element: ElementId, rules: GameRules): void {
  wizard.essence[element] = Math.min(rules.beasts.maxEssence, wizard.essence[element] + 1);
}

/** Cosecha de almas: un golpe fuerte da una Esencia del elemento con que empezó el hechizo. */
function harvestHit(source: Wizard, amount: number, form: string, rules: GameRules): void {
  const harvest = source.statuses.harvesting;
  const spec = rules.statuses.harvesting;
  if (!harvest || amount < spec.minHit) return;
  const stacks = harvest.power ?? 0;
  if (stacks >= spec.maxStacks) return;
  const element = ELEMENT_BY_FORM[form as SpellForm];
  if (!element) return;
  gainEssence(source, element, rules);
  source.statuses.harvesting = { ...harvest, power: stacks + 1 };
}

/** Cosecha de almas: cada bestia o mago que cae cerca da una Esencia. */
function harvestFall(state: MatchState, pos: Vec2, element: ElementId, rules: GameRules): void {
  const spec = rules.statuses.harvesting;
  for (const wizard of state.wizards) {
    if (!wizard.statuses.harvesting || !isAlive(wizard)) continue;
    if (distance(wizard.pos, pos) > spec.radius) continue;
    gainEssence(wizard, element, rules);
  }
}

/** Venganza: si cae o queda muy herido, el marcado recibe el golpe. */
function avenge(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const vow = wizard.statuses.vengeful;
  const spec = rules.statuses.vengeful;
  if (!vow || wizard.hp > wizard.maxHp * spec.threshold) return;
  delete wizard.statuses.vengeful;
  const marked = wizardById(state, vow.targetId ?? null);
  if (!marked || !isAlive(marked)) return;
  state.events.push({ type: 'zap', from: wizard.pos, to: marked.pos });
  state.events.push({ type: 'burst', spell: 'vengeance', pos: marked.pos, radius: 1.2 });
  dealDamage(state, marked, wizard.id, spec.damage, 'mark', false, true);
}

/** Hambre de ceniza: si el marcado cae o queda muy herido, quien lo marcó descansa y se cura. */
function feedHunger(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const mark = wizard.statuses.ashHunger;
  if (!mark || wizard.hp > wizard.maxHp * rules.statuses.ashHunger.threshold) return;
  delete wizard.statuses.ashHunger;
  const hunter = wizardById(state, mark.sourceId);
  if (!hunter || !isAlive(hunter)) return;
  for (const element of ELEMENT_IDS) hunter.fatigue[element] = 0;
  healWizard(state, hunter, rules.spells.ashHunger.heal);
  state.events.push({ type: 'burst', spell: 'ashHunger', pos: hunter.pos, radius: 1.5 });
}

/** Renacer: quien cae con él puesto vuelve ahí mismo con parte de la vida. */
function rise(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const rebirth = wizard.statuses.rebirth;
  if (!rebirth || wizard.hp > 0) return;
  delete wizard.statuses.rebirth;
  wizard.hp = wizard.maxHp * rules.statuses.rebirth.hpFraction;
  state.events.push({ type: 'burst', spell: 'rebirth', pos: wizard.pos, radius: 2 });
  state.events.push({ type: 'revived', wizardId: wizard.id, byId: wizard.id });
}
