import { canAct, moveMultiplier, tickStatuses } from '../combat/statuses';
import type { Intent } from '../controllers/intent';
import { ELEMENT_IDS } from '../elements';
import { add, clampLength, length, normalize, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { castSpell } from '../spells/cast';
import { spellOf } from '../spells/catalog';
import { buildPayload, empowerPayload } from '../spells/payload';
import { releaseSpell } from '../spells/release';
import { blockBySolidWalls } from '../spells/solidWalls';
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
          canAct(wizard) &&
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
  if (wizard.channel || wizard.leap || wizard.weave.length === 0 || !canAct(wizard)) {
    return;
  }
  const weave = wizard.weave;
  const baseTicks = rules.weave.castTicksByLength[weave.length - 1] ?? 1;
  const castTicks = Math.max(1, Math.round(baseTicks * wizard.mods.castTime));
  // El cansancio empieza al lanzar: cada elemento usado descansa antes de volver a tejerse.
  for (const element of weave) {
    wizard.fatigue[element] = Math.round(rules.weave.fatigueTicks * wizard.mods.fatigue[element]);
  }
  wizard.channel = { ticksLeft: castTicks, weave, aim };
  wizard.weave = [];
  state.events.push({ type: 'cast', wizardId: wizard.id, weave });
}

function updateWizard(state: MatchState, wizard: Wizard, rules: GameRules): void {
  tickStatuses(state, wizard, rules);
  if (!isAlive(wizard)) {
    return;
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
    const next = placeInArena(add(wizard.pos, move), rules.wizard.radius, rules);
    wizard.pos = blockBySolidWalls(state, wizard.pos, next, rules.wizard.radius);
    if (!wizard.channel) {
      wizard.facing = normalize(wizard.moveInput, wizard.facing);
    }
  }
}

/** Sale el conjuro: el hechizo propio del tejido o, si aún no tiene, la gramática antigua. */
function release(
  state: MatchState,
  wizard: Wizard,
  weave: Weave,
  rawAim: { x: number; z: number },
  rules: GameRules,
): void {
  const spell = spellOf(weave);
  if (spell) {
    castSpell(state, wizard, spell, weave, rawAim, rules);
    return;
  }
  const base = buildPayload(weave, rules);
  if (!base) return;
  // Salir del Velo con un conjuro lo rompe y lo potencia.
  const veiled = wizard.statuses.veiled !== undefined;
  delete wizard.statuses.veiled;
  const payload = empowerPayload(
    base,
    wizard,
    rules,
    veiled ? rules.statuses.veiled.damageMultiplier : 1,
  );
  // Los proyectiles apuntados solos se adelantan al rival; el resto va directo.
  const leadSpeed =
    payload.form === 'projectile' ? rules.forms.projectile.speed * payload.speedMultiplier : 0;
  const aim = resolveAim(state, wizard, rawAim, rules, leadSpeed);
  releaseSpell(state, wizard, payload, aim, rules);
}

export const NO_INTENTS: IntentsByWizard = new Map();
