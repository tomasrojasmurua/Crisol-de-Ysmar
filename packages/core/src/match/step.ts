import { moveMultiplier, tickStatuses } from '../combat/statuses';
import type { Intent } from '../controllers/intent';
import { ELEMENT_IDS } from '../elements';
import { add, clampLength, clampToCircle, length, normalize, scale } from '../math/vec2';
import type { GameRules } from '../rules';
import { TICK_RATE } from '../sim/fixedStep';
import { buildPayload, empowerPayload } from '../spells/payload';
import { releaseSpell } from '../spells/release';
import { updateLeap, updateSpells } from '../spells/update';
import { MAX_WEAVE_LENGTH } from '../weaving/weave';
import { updateBeasts } from './beasts';
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
  if (wizard.channel || wizard.leap || wizard.weave.length === 0) {
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

  const channel = wizard.channel;
  if (channel) {
    wizard.facing = resolveAim(state, wizard, channel.aim);
    if (--channel.ticksLeft <= 0) {
      wizard.channel = null;
      const base = buildPayload(channel.weave, rules);
      const payload = base && empowerPayload(base, wizard, rules);
      if (payload) {
        // Los proyectiles apuntados solos se adelantan al rival; el resto va directo.
        const leadSpeed =
          payload.form === 'projectile'
            ? rules.forms.projectile.speed * payload.speedMultiplier
            : 0;
        const aim = resolveAim(state, wizard, channel.aim, rules.wizard.moveSpeed, leadSpeed);
        releaseSpell(state, wizard, payload, aim, rules);
      }
    }
  }

  if (wizard.leap) {
    updateLeap(state, wizard, rules);
    return;
  }

  const speed = rules.wizard.moveSpeed * wizard.mods.moveSpeed * moveMultiplier(wizard, rules);
  const move = scale(wizard.moveInput, speed / TICK_RATE);
  if (length(move) > 0) {
    wizard.pos = clampToCircle(add(wizard.pos, move), rules.arenaRadius - rules.wizard.radius);
    if (!wizard.channel) {
      wizard.facing = normalize(wizard.moveInput, wizard.facing);
    }
  }
}

export const NO_INTENTS: IntentsByWizard = new Map();
