import { dealDamage } from '../combat/hit';
import { canAct, canWeave, moveMultiplier, tickStatuses } from '../combat/statuses';
import type { Intent } from '../controllers/intent';
import { ELEMENT_IDS } from '../elements';
import { add, clampLength, clampToCircle, length, normalize, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { castSpell } from '../spells/cast';
import { spellOf } from '../spells/catalog';
import { blockByRings, blockByWalls } from '../spells/solidWalls';
import { updateLeap, updateSpells } from '../spells/update';
import { MAX_WEAVE_LENGTH, type Weave } from '../weaving/weave';
import { updateBeasts } from './beasts';
import { placeInArena } from './obstacles';
import { isAlive, resolveAim } from './queries';
import {
  decideRoundWinner,
  haunt,
  processFalls,
  updateFallen,
  updateRevives,
  updateZone,
} from './round';
import { updateShrines } from './shrines';
import type { EntityId, MatchState, Wizard } from './state';

export type IntentsByWizard = ReadonlyMap<EntityId, readonly Intent[]>;

/**
 * Avanza la partida un paso de simulación. Es determinista:
 * el mismo estado con las mismas intenciones siempre da el mismo resultado.
 */
export function stepMatch(state: MatchState, intents: IntentsByWizard, rules: GameRules): void {
  state.events = [];
  if (state.winnerTeam !== null) {
    return;
  }

  for (const wizard of state.wizards) {
    const wizardIntents = intents.get(wizard.id) ?? [];
    if (isAlive(wizard)) {
      applyIntents(state, wizard, wizardIntents, rules);
    } else {
      applyFallenIntents(state, wizard, wizardIntents, rules);
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
  updateBeasts(state, rules);
  updateShrines(state, rules);
  updateZone(state, rules);
  processFalls(state, rules);
  updateRevives(state, rules);
  state.tick++;
  state.winnerTeam = decideRoundWinner(state, rules);
}

/** Un caído solo puede moverse (si es espectro), fijar objetivo y lanzar su Lamento. */
function applyFallenIntents(
  state: MatchState,
  wizard: Wizard,
  intents: readonly Intent[],
  rules: GameRules,
): void {
  for (const intent of intents) {
    if (intent.kind === 'move') {
      wizard.moveInput = clampLength({ x: intent.x, z: intent.z }, 1);
    } else if (intent.kind === 'lockTarget') {
      wizard.lockTarget = intent.targetId;
    } else if (intent.kind === 'cast') {
      haunt(state, wizard, rules);
    }
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
        startChannel(state, wizard, { x: intent.dirX, z: intent.dirZ }, rules);
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
): void {
  if (wizard.channel || wizard.leap || wizard.weave.length === 0 || !canWeave(wizard)) {
    return;
  }
  const weave = wizard.weave;
  const baseTicks = rules.weave.castTicksByLength[weave.length - 1] ?? 1;
  // La Fuente termal apura el tejido y el Vaho lo traba.
  const pace =
    (wizard.statuses.quickened ? rules.statuses.quickened.castMultiplier : 1) *
    (wizard.statuses.sluggish ? rules.statuses.sluggish.castMultiplier : 1);
  // Nada sale más rápido que un tejido de 1 elemento sin ayudas: el rival siempre ve el aviso.
  const floor = rules.weave.castTicksByLength[0];
  const castTicks = Math.max(floor, Math.round(baseTicks * wizard.mods.castTime * pace));
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
  wizard.channel = { ticksLeft: castTicks, weave, aim };
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
  for (const element of ELEMENT_IDS) {
    if (wizard.fatigue[element] > 0) {
      wizard.fatigue[element]--;
    }
  }

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
      release(state, wizard, channel.weave, channel.aim, rules);
    }
  }

  if (wizard.leap) {
    updateLeap(state, wizard, rules);
    return;
  }

  const speed = rules.wizard.moveSpeed * wizard.mods.moveSpeed * moveMultiplier(wizard, rules);
  const move = scale(wizard.moveInput, speed / TICK_RATE);
  if (length(move) > 0) {
    const radius = rules.wizard.radius;
    if (wizard.statuses.phased) {
      // Fantasma: atraviesa árboles, rocas, muros y zarzas; solo lo frena el borde de la arena.
      wizard.pos = clampToCircle(add(wizard.pos, move), rules.arenaRadius - radius);
    } else {
      const next = placeInArena(add(wizard.pos, move), radius, rules);
      wizard.pos = blockByRings(state, wizard, blockByWalls(state, wizard, next, radius), radius);
    }
    if (!wizard.channel) {
      wizard.facing = normalize(wizard.moveInput, wizard.facing);
    }
  }
}

/** Sale el conjuro: el hechizo del tejido. */
function release(
  state: MatchState,
  wizard: Wizard,
  weave: Weave,
  rawAim: { x: number; z: number },
  rules: GameRules,
): void {
  const spell = spellOf(weave);
  if (spell) castSpell(state, wizard, spell, weave, rawAim, rules);
}

export const NO_INTENTS: IntentsByWizard = new Map();
