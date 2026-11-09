export { BotController, type BotProfile, DEFAULT_BOT } from './ai/bot';
export type { Controller, Intent } from './controllers/intent';
export {
  ELEMENT_COUNT,
  ELEMENT_IDS,
  type ElementId,
  isElementId,
  neighborsOf,
  opposingOf,
} from './elements';
export { createMatch, duelSetup, type MatchSetup, type WizardSetup } from './match/createMatch';
export { stateHash } from './match/hash';
export { currentTarget, isAlive, nearestEnemy, wizardById } from './match/queries';
export type {
  EntityId,
  GameEvent,
  MatchState,
  Projectile,
  SpellEntity,
  SpellPayload,
  StatusInstance,
  Trap,
  Wall,
  Wizard,
} from './match/state';
export { type IntentsByWizard, NO_INTENTS, stepMatch } from './match/step';
export type { Vec2 } from './math/vec2';
export * as vec2 from './math/vec2';
export type { FormBase, GameRules, ModifierRules, StatusId } from './rules';
export { FixedStepClock, TICK_MS, TICK_RATE } from './sim/fixedStep';
export { SeededRng } from './sim/rng';
export { buildPayload } from './spells/payload';
export {
  addToWeave,
  baseSpellCount,
  EMPTY_WEAVE,
  MAX_WEAVE_LENGTH,
  recipeOf,
  SPELL_FORM_BY_ELEMENT,
  type SpellForm,
  type SpellRecipe,
  type Weave,
  weaveKey,
} from './weaving/weave';
