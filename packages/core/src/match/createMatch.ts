import { ELEMENT_IDS, type ElementId } from '../elements';
import { normalize, scale, sub, type Vec2, ZERO } from '../math/vec2';
import { NEUTRAL_MODS, type WizardMods } from '../mods';
import type { GameRules } from '../rules';
import { spawnBeasts } from './beasts';
import type { DeathRule, EntityId, MatchState, Wizard } from './state';

export interface WizardSetup {
  readonly team: number;
  readonly spawn: Vec2;
  /** Glifos, Presagio y Afinidad ya combinados. */
  readonly mods?: WizardMods;
  /** El hilo con que se unió el mago; cambia su fatiga (vía `mods`) y su aspecto. */
  readonly affinity?: ElementId | null;
}

export interface MatchSetup {
  readonly seed: number;
  readonly deathRule: DeathRule;
  readonly wizards: readonly WizardSetup[];
}

function zeroByElement(): Record<ElementId, number> {
  const fatigue = {} as Record<ElementId, number>;
  for (const element of ELEMENT_IDS) {
    fatigue[element] = 0;
  }
  return fatigue;
}

/** Crea una partida nueva. Los ids de los magos son 1, 2, 3... en el orden de `setup`. */
export function createMatch(setup: MatchSetup, rules: GameRules): MatchState {
  const wizards: Wizard[] = setup.wizards.map((w, index) => {
    const mods = w.mods ?? NEUTRAL_MODS;
    const maxHp = rules.wizard.maxHp * mods.maxHp;
    return {
      id: (index + 1) as EntityId,
      team: w.team,
      pos: w.spawn,
      // Al empezar, cada mago mira hacia el centro de la arena.
      facing: normalize(scale(sub(ZERO, w.spawn), 1), { x: 0, z: 1 }),
      hp: maxHp,
      maxHp,
      mods,
      affinity: w.affinity ?? null,
      essence: zeroByElement(),
      weave: [],
      channel: null,
      leap: null,
      fatigue: zeroByElement(),
      statuses: {},
      lockTarget: null,
      moveInput: ZERO,
      lives: setup.deathRule === 'lives' ? rules.death.lives : 1,
      fallen: null,
    };
  });

  const state: MatchState = {
    deathRule: setup.deathRule,
    tick: 0,
    zoneRadius: rules.arenaRadius,
    rngState: setup.seed >>> 0,
    nextEntityId: wizards.length + 1,
    wizards,
    spells: [],
    beasts: [],
    shrines: [],
    events: [],
    winnerTeam: null,
  };
  spawnBeasts(state, rules);
  return state;
}

/** Duelo estándar: dos magos frente a frente. */
export function duelSetup(
  seed: number,
  rules: GameRules,
  deathRule: DeathRule = 'spectre',
): MatchSetup {
  const offset = rules.arenaRadius * 0.5;
  return {
    seed,
    deathRule,
    wizards: [
      { team: 0, spawn: { x: 0, z: -offset } },
      { team: 1, spawn: { x: 0, z: offset } },
    ],
  };
}
