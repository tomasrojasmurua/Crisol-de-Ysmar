export { BotController, type BotProfile, DEFAULT_BOT } from './ai/bot';
export { canAct } from './combat/statuses';
export type { Controller, Intent } from './controllers/intent';
export {
  ELEMENT_COUNT,
  ELEMENT_IDS,
  type ElementId,
  isElementId,
  neighborsOf,
  opposingOf,
} from './elements';
export { beastById } from './match/beasts';
export { createMatch, duelSetup, type MatchSetup, type WizardSetup } from './match/createMatch';
export { stateHash } from './match/hash';
export { isBurned, liveRules } from './match/liveMap';
export {
  type GameMode,
  MAX_PLAYERS,
  modeSetup,
  playerCount,
  teamCount,
} from './match/modes';
export { lineBlocked, obstacleAt, placeInArena, pushOutOfObstacles } from './match/obstacles';
export { currentTarget, isAlive, isHiddenFrom, nearestEnemy, wizardById } from './match/queries';
export {
  decideRoundWinner,
  isSpectre,
  isStanding,
  roundPhase,
  zoneRadiusAt,
} from './match/round';
export { createSeries, recordRound, type SeriesState } from './match/series';
export type {
  Aura,
  Beast,
  Bond,
  Boon,
  Bubble,
  Current,
  DeathRule,
  Deferred,
  Drown,
  Echo,
  EntityId,
  Fallen,
  Field,
  FieldMode,
  FireRain,
  GameEvent,
  GrownTree,
  GuidedBolt,
  HeldSpell,
  Ignite,
  MatchState,
  Obsidian,
  PastSample,
  Portal,
  Projectile,
  ProjectileTrait,
  Pyre,
  RoundPhase,
  Shackle,
  Shrine,
  SpellEntity,
  SpellPayload,
  StatusInstance,
  Stepper,
  Strike,
  StrikeEffect,
  Summon,
  SummonKind,
  Sweeper,
  SweeperMode,
  Tempest,
  Tether,
  ThornRing,
  ThornRush,
  Trap,
  Wall,
  Wizard,
  Zone,
  ZoneEffect,
} from './match/state';
export { type IntentsByWizard, NO_INTENTS, stepMatch } from './match/step';
export { walkTarget } from './match/walk';
export type { Vec2 } from './math/vec2';
export * as vec2 from './math/vec2';
export { affinityPatch, combineMods, type ModsPatch, NEUTRAL_MODS, type WizardMods } from './mods';
export type {
  BeastRules,
  BeastStats,
  Camp,
  ComboId,
  DeathRules,
  ElementCombo,
  GameRules,
  GuardianRules,
  MapLayout,
  Obstacle,
  RoundRules,
  ShrineRules,
  StatusId,
} from './rules';
export { STATUS_IDS } from './rules';
export { FixedStepClock, TICK_MS, TICK_RATE } from './sim/fixedStep';
export { SeededRng } from './sim/rng';
export { SPELL_IDS, SPELL_WEAVES, type SpellId, spellOf } from './spells/catalog';
export { empowerPayload } from './spells/payload';
export type { SpellRules } from './spells/spellRules';
export {
  addToWeave,
  baseSpellCount,
  EMPTY_WEAVE,
  MAX_WEAVE_LENGTH,
  SPELL_FORM_BY_ELEMENT,
  type SpellForm,
  type Weave,
  weaveKey,
} from './weaving/weave';
