import { dealDamage } from '../combat/hit';
import { canAct, canWeave, tickStatuses } from '../combat/statuses';
import type { Intent } from '../controllers/intent';
import { ELEMENT_IDS } from '../elements';
import { clampLength, length, normalize } from '../math/vec2';
import type { GameRules } from '../rules';
import { castSpell } from '../spells/cast';
import { spellOf } from '../spells/catalog';
import { stealSpell } from '../spells/kit/greatMind';
import {
  fireEchoes,
  jumpToShadow,
  mayChannel,
  overchargedTicks,
  recordPast,
  resolveReactions,
} from '../spells/kit/greatReactions';
import { updateLeap, updateSpells } from '../spells/update';
import { MAX_WEAVE_LENGTH, type Weave } from '../weaving/weave';
import { updateBeasts } from './beasts';
import { updateForms } from './forms';
import { liveRules } from './liveMap';
import { placeInArena } from './obstacles';
import { isAlive, resolveAim } from './queries';
import { decideRoundWinner, processFalls, updateFallen, updateRevives, updateZone } from './round';
import { updateShrines } from './shrines';
import type { EntityId, MatchState, Wizard } from './state';
import { walkTarget } from './walk';

export type IntentsByWizard = ReadonlyMap<EntityId, readonly Intent[]>;

/**
 * Avanza la partida un paso de simulación. Es determinista:
 * el mismo estado con las mismas intenciones siempre da el mismo resultado.
 */
export function stepMatch(state: MatchState, intents: IntentsByWizard, baseRules: GameRules): void {
  // La jungla cambia durante la ronda: árboles quemados y árboles nuevos.
  const rules = liveRules(state, baseRules);
  state.events = [];
  if (state.winnerTeam !== null) {
    return;
  }

  for (const wizard of state.wizards) {
    const wizardIntents = intents.get(wizard.id) ?? [];
    if (isAlive(wizard)) {
      applyIntents(state, wizard, wizardIntents, rules);
    } else {
      applyFallenIntents(wizard, wizardIntents);
    }
  }
  for (const wizard of state.wizards) {
    if (isAlive(wizard)) {
      updateWizard(state, wizard, rules);
    } else {
      updateFallen(state, wizard, rules);
    }
  }
  updateSpells(state, rules);
  fireEchoes(state, rules, (caster, spell, weave, aim) =>
    castSpell(state, caster, spell, weave, aim, rules, true),
  );
  updateBeasts(state, rules);
  updateShrines(state, rules);
  updateZone(state, rules);
  resolveReactions(state, rules);
  processFalls(state, rules);
  updateRevives(state, rules);
  state.tick++;
  state.winnerTeam = decideRoundWinner(state);
}

/** Un caído solo puede fijar objetivo (para mirar a quien sigue en pie). */
function applyFallenIntents(wizard: Wizard, intents: readonly Intent[]): void {
  for (const intent of intents) {
    if (intent.kind === 'lockTarget') wizard.lockTarget = intent.targetId;
  }
}

function applyIntents(
  state: MatchState,
  wizard: Wizard,
  intents: readonly Intent[],
  rules: GameRules,
): void {
  for (const intent of intents) {
    switch (intent.kind) {
      case 'move':
        wizard.moveInput = clampLength({ x: intent.x, z: intent.z }, 1);
        break;
      case 'weave':
        if (
          canWeave(wizard) &&
          !wizard.channel &&
          wizard.weave.length < MAX_WEAVE_LENGTH &&
          wizard.fatigue[intent.element] === 0
        ) {
          wizard.weave.push(intent.element);
        }
        break;
      case 'cancelWeave':
        if (!wizard.channel) {
          wizard.weave = [];
        }
        break;
      case 'cast':
        // Sin tejer, ✦ lleva a la Sombra lanzada si hay una.
        if (wizard.weave.length === 0 && !wizard.channel && jumpToShadow(state, wizard, rules)) {
          break;
        }
        startChannel(
          state,
          wizard,
          { x: intent.dirX, z: intent.dirZ },
          rules,
          cleanReach(intent.reach),
        );
        break;
      case 'lockTarget':
        wizard.lockTarget = intent.targetId;
        break;
    }
  }
}

function startChannel(
  state: MatchState,
  wizard: Wizard,
  aim: { x: number; z: number },
  rules: GameRules,
  reach?: number,
): void {
  if (wizard.channel || wizard.leap || wizard.weave.length === 0 || !canWeave(wizard)) {
    return;
  }
  const weave = wizard.weave;
  // Con la Bruma del olvido, el último hechizo no se puede repetir.
  if (!mayChannel(state, wizard, weave)) return;
  const baseTicks = rules.weave.castTicksByLength[weave.length - 1] ?? 1;
  // La Fuente termal apura el tejido y el Vaho lo traba.
  const pace =
    (wizard.statuses.quickened ? rules.statuses.quickened.castMultiplier : 1) *
    (wizard.statuses.sluggish ? rules.statuses.sluggish.castMultiplier : 1);
  // Nada sale más rápido que un tejido de 1 elemento sin ayudas: el rival siempre ve el aviso.
  const floor = rules.weave.castTicksByLength[0];
  const paced = Math.max(floor, Math.round(baseTicks * wizard.mods.castTime * pace));
  // Con la Sobrecarga sale con el aviso mínimo, nunca antes.
  const castTicks = overchargedTicks(wizard, paced, floor);
  // Con la Combustión, cada conjuro quema a quien lo teje.
  const combusting = wizard.statuses.combusting;
  if (combusting) {
    dealDamage(state, wizard, combusting.sourceId, rules.statuses.combusting.damage, 'mark');
    if (wizard.hp <= 0) return;
  }
  // El cansancio empieza al lanzar: cada elemento usado descansa antes de volver a tejerse.
  for (const element of weave) {
    wizard.fatigue[element] = Math.round(rules.weave.fatigueTicks * wizard.mods.fatigue[element]);
  }
  wizard.channel =
    reach === undefined
      ? { ticksLeft: castTicks, weave, aim }
      : { ticksLeft: castTicks, weave, aim, reach };
  wizard.weave = [];
  state.events.push({ type: 'cast', wizardId: wizard.id, weave });
}

function updateWizard(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const wasPhased = wizard.statuses.phased !== undefined;
  tickStatuses(state, wizard, rules);
  if (!isAlive(wizard)) {
    return;
  }
  // Al terminar el Fantasma, quien quedó dentro de un árbol sale por el costado.
  if (wasPhased && !wizard.statuses.phased) {
    wizard.pos = placeInArena(wizard.pos, rules.wizard.radius, rules);
  }
  // Junto a la Hoguera se descansa más rápido; dentro de Marchitar, nada.
  const rest = wizard.statuses.withered
    ? 0
    : wizard.statuses.kindled
      ? rules.statuses.kindled.restMultiplier
      : 1;
  for (const element of ELEMENT_IDS) {
    if (wizard.fatigue[element] > 0) {
      wizard.fatigue[element] = Math.max(0, wizard.fatigue[element] - rest);
    }
  }
  recordPast(state, wizard, rules);
  if (wizard.held && --wizard.held.ticksLeft <= 0) wizard.held = null;

  // Por los aires o congelado, no se teje ni se salta.
  if (!canAct(wizard)) {
    wizard.channel = null;
    wizard.leap = null;
    return;
  }

  const channel = wizard.channel;
  if (channel) {
    wizard.facing = resolveAim(state, wizard, channel.aim, rules);
    if (--channel.ticksLeft <= 0) {
      wizard.channel = null;
      release(state, wizard, channel.weave, channel.aim, rules, channel.reach);
    }
  }

  if (wizard.leap) {
    updateLeap(state, wizard, rules);
    return;
  }

  if (length(wizard.moveInput) > 0) {
    wizard.pos = walkTarget(state, wizard, wizard.moveInput, rules);
    if (!wizard.channel) {
      wizard.facing = normalize(wizard.moveInput, wizard.facing);
    }
  }
  updateForms(state, wizard, rules);
}

/**
 * Sale el conjuro: el hechizo del tejido, o el que tenía guardado (Reflejo, Hurto).
 * Si le pusieron el Hurto, no sale: se lo queda quien lo marcó.
 */
function release(
  state: MatchState,
  wizard: Wizard,
  weave: Weave,
  rawAim: { x: number; z: number },
  rules: GameRules,
  reach?: number,
): void {
  const held = wizard.held;
  wizard.held = null;
  const spell = held ? held.spell : spellOf(weave);
  const castWeave = held ? held.weave : weave;
  if (!spell) return;
  if (wizard.statuses.robbed) {
    stealSpell(state, wizard, spell, castWeave, rules);
    wizard.lastWeave = castWeave;
    return;
  }
  castSpell(state, wizard, spell, castWeave, rawAim, rules, false, reach);
}

/** El alcance elegido, entre 0 y 1; lo que no es un número se ignora (cae como siempre). */
function cleanReach(reach: number | undefined): number | undefined {
  if (reach === undefined || !Number.isFinite(reach)) return undefined;
  return Math.min(1, Math.max(0, reach));
}
