import { ELEMENT_IDS, type ElementId } from '../elements';
import { normalize, scale, sub, type Vec2, ZERO } from '../math/vec2';
import type { GameRules } from '../rules';
import type { EntityId, MatchState, Wizard } from './state';

export interface WizardSetup {
  readonly team: number;
  readonly spawn: Vec2;
}

export interface MatchSetup {
  readonly seed: number;
  readonly wizards: readonly WizardSetup[];
}

function restedElements(): Record<ElementId, number> {
  const fatigue = {} as Record<ElementId, number>;
  for (const element of ELEMENT_IDS) {
    fatigue[element] = 0;
  }
  return fatigue;
}

/** Crea una partida nueva. Los ids de los magos son 1, 2, 3... en el orden de `setup`. */
export function createMatch(setup: MatchSetup, rules: GameRules): MatchState {
  const wizards: Wizard[] = setup.wizards.map((w, index) => ({
    id: (index + 1) as EntityId,
    team: w.team,
    pos: w.spawn,
    // Al empezar, cada mago mira hacia el centro de la arena.
    facing: normalize(scale(sub(ZERO, w.spawn), 1), { x: 0, z: 1 }),
    hp: rules.wizard.maxHp,
    weave: [],
    channel: null,
    leap: null,
    fatigue: restedElements(),
    statuses: {},
    lockTarget: null,
    moveInput: ZERO,
  }));

  return {
    tick: 0,
    rngState: setup.seed >>> 0,
    nextEntityId: wizards.length + 1,
    wizards,
    spells: [],
    events: [],
    winnerTeam: null,
  };
}

/** Duelo estándar: dos magos frente a frente. */
export function duelSetup(seed: number, rules: GameRules): MatchSetup {
  const offset = rules.arenaRadius * 0.5;
  return {
    seed,
    wizards: [
      { team: 0, spawn: { x: 0, z: -offset } },
      { team: 1, spawn: { x: 0, z: offset } },
    ],
  };
}
