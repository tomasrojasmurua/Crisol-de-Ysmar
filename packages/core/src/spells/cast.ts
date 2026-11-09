import { resolveAim } from '../match/queries';
import type { MatchState, Wizard } from '../match/state';
import type { Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { SPELL_FORM_BY_ELEMENT, type Weave } from '../weaving/weave';
import type { SpellId } from './catalog';
import {
  castComet,
  castFireball,
  castIgnite,
  castObsidian,
  castSpark,
  castWisp,
} from './kit/brasa';
import type { CastContext } from './kit/context';
import {
  castBlackFlame,
  castDarkComet,
  castEmberStride,
  castFireRain,
  castMeteor,
} from './kit/greatBrasa';
import {
  castCauldron,
  castDrown,
  castIceAge,
  castMangrove,
  castSteamJet,
  castTidalWave,
} from './kit/greatMarea';
import { castRootCatapult, castSowing, castThornRing, castTreeStride } from './kit/greatRaiz';
import {
  castAncientTree,
  castAshBird,
  castCarnivore,
  castGlacier,
  castMagmaGolem,
  castRootPack,
  castShadowTwin,
  castSwarm,
  castWanderingSparks,
} from './kit/greatSummons';
import {
  castAcid,
  castBubble,
  castCombustion,
  castEclipse,
  castGarden,
  castHealingRain,
  castHotSpring,
  castImmolation,
  castLifeLink,
  castLifeWater,
  castMist,
  castPlague,
  castPurify,
  castSacrifice,
  castSoulTide,
  castSpeedTheft,
  castStormEye,
  castTailwind,
} from './kit/greatSupport';
import {
  castBarometer,
  castBorrowedShadow,
  castCrimsonMist,
  castCursedGrove,
  castDeepRoots,
  castErasingRain,
  castForestFire,
  castHunter,
  castMagmaForm,
  castMirage,
  castMossCarpet,
  castSentinel,
  castShadowPanther,
  castSurf,
  castTameBeast,
  castTrack,
  castTreeSprout,
  castWeaveIllusion,
} from './kit/greatThird';
import {
  castErraticOrb,
  castHurricane,
  castSkySpear,
  castSwap,
  castTempest,
} from './kit/greatTormenta';
import { castAbyss, castNightmare, castPhantom, castPortal, castSoulPyre } from './kit/greatUmbra';
import {
  castCurrent,
  castGeyser,
  castIceCoffin,
  castIceWall,
  castSplash,
  castSpring,
} from './kit/marea';
import {
  castMossGuardian,
  castRootWall,
  castSap,
  castSpores,
  castThornRush,
  castVine,
} from './kit/raiz';
import {
  castBlink,
  castBlizzard,
  castChainLightning,
  castLightningRod,
  castShadowStep,
  castStep,
} from './kit/tormenta';
import { castBlinding, castClaw, castDecoy, castDrain, castShackle, castVeil } from './kit/umbra';

const CASTERS: Readonly<Record<SpellId, (ctx: CastContext) => void>> = {
  spark: castSpark,
  step: castStep,
  splash: castSplash,
  sap: castSap,
  claw: castClaw,
  fireball: castFireball,
  comet: castComet,
  blink: castBlink,
  chainLightning: castChainLightning,
  geyser: castGeyser,
  iceCoffin: castIceCoffin,
  thornRush: castThornRush,
  rootWall: castRootWall,
  veil: castVeil,
  drain: castDrain,
  obsidian: castObsidian,
  wisp: castWisp,
  ignite: castIgnite,
  blizzard: castBlizzard,
  lightningRod: castLightningRod,
  shadowStep: castShadowStep,
  current: castCurrent,
  iceWall: castIceWall,
  spring: castSpring,
  vine: castVine,
  mossGuardian: castMossGuardian,
  spores: castSpores,
  decoy: castDecoy,
  blinding: castBlinding,
  shackle: castShackle,
  meteor: castMeteor,
  fireRain: castFireRain,
  blackFlame: castBlackFlame,
  emberStride: castEmberStride,
  darkComet: castDarkComet,
  skySpear: castSkySpear,
  tempest: castTempest,
  hurricane: castHurricane,
  swap: castSwap,
  erraticOrb: castErraticOrb,
  iceAge: castIceAge,
  cauldron: castCauldron,
  steamJet: castSteamJet,
  drown: castDrown,
  mangrove: castMangrove,
  tidalWave: castTidalWave,
  rootCatapult: castRootCatapult,
  sowing: castSowing,
  thornRing: castThornRing,
  treeStride: castTreeStride,
  soulPyre: castSoulPyre,
  portal: castPortal,
  phantom: castPhantom,
  abyss: castAbyss,
  nightmare: castNightmare,
  ashBird: castAshBird,
  rootPack: castRootPack,
  wanderingSparks: castWanderingSparks,
  magmaGolem: castMagmaGolem,
  glacier: castGlacier,
  swarm: castSwarm,
  ancientTree: castAncientTree,
  shadowTwin: castShadowTwin,
  carnivore: castCarnivore,
  hotSpring: castHotSpring,
  tailwind: castTailwind,
  bubble: castBubble,
  lifeWater: castLifeWater,
  healingRain: castHealingRain,
  sacrifice: castSacrifice,
  garden: castGarden,
  lifeLink: castLifeLink,
  immolation: castImmolation,
  stormEye: castStormEye,
  purify: castPurify,
  soulTide: castSoulTide,
  combustion: castCombustion,
  speedTheft: castSpeedTheft,
  acid: castAcid,
  mist: castMist,
  eclipse: castEclipse,
  plague: castPlague,
  forestFire: castForestFire,
  tameBeast: castTameBeast,
  treeSprout: castTreeSprout,
  barometer: castBarometer,
  hunter: castHunter,
  track: castTrack,
  sentinel: castSentinel,
  crimsonMist: castCrimsonMist,
  erasingRain: castErasingRain,
  mirage: castMirage,
  cursedGrove: castCursedGrove,
  mossCarpet: castMossCarpet,
  weaveIllusion: castWeaveIllusion,
  borrowedShadow: castBorrowedShadow,
  magmaForm: castMagmaForm,
  surf: castSurf,
  deepRoots: castDeepRoots,
  shadowPanther: castShadowPanther,
};

/** Hechizos que no delatan a quien está con Velo. */
const QUIET: ReadonlySet<SpellId> = new Set([
  'step',
  'blink',
  'sap',
  'veil',
  'iceCoffin',
  'obsidian',
  'current',
  'spring',
  'decoy',
  'emberStride',
  'mangrove',
  'treeStride',
  'portal',
  'phantom',
  'purify',
  'lifeLink',
  'barometer',
  'hunter',
  'erasingRain',
  'mirage',
  'mossCarpet',
  'cursedGrove',
  'weaveIllusion',
  'borrowedShadow',
  'sentinel',
]);

/** Los hechizos que viajan: el apuntado automático se adelanta al rival según su velocidad. */
function leadSpeedOf(spell: SpellId, rules: GameRules): number {
  if (spell === 'spark') return rules.spells.spark.speed;
  if (spell === 'fireball') return rules.spells.fireball.speed;
  if (spell === 'blinding') return rules.spells.blinding.speed;
  if (spell === 'blackFlame') return rules.spells.blackFlame.speed;
  if (spell === 'darkComet') return rules.spells.darkComet.speed;
  return 0;
}

/** Hace salir un hechizo ya canalizado. */
export function castSpell(
  state: MatchState,
  caster: Wizard,
  spell: SpellId,
  weave: Weave,
  rawAim: Vec2,
  rules: GameRules,
): void {
  // Atacar desde el Velo lo rompe, y ese hechizo pega más. Moverse o curarse no lo rompe.
  const breaksVeil = caster.statuses.veiled !== undefined && !QUIET.has(spell);
  if (breaksVeil) delete caster.statuses.veiled;
  const bonus = breaksVeil ? rules.statuses.veiled.damageMultiplier : 1;
  const aim = resolveAim(state, caster, rawAim, rules, leadSpeedOf(spell, rules));
  const form = SPELL_FORM_BY_ELEMENT[weave[0] ?? 'brasa'];
  state.events.push({ type: 'release', wizardId: caster.id, form, spell });
  // Con Raíces profundas, todo llega más lejos.
  const reach = caster.statuses.deepRooted ? farRules(rules) : rules;
  CASTERS[spell]({ state, caster, spell, weave, aim, rules: reach, bonus });
}

const FAR = new WeakMap<GameRules, GameRules>();

/** Las mismas reglas con el alcance (`range`) de cada hechizo multiplicado. */
function farRules(rules: GameRules): GameRules {
  const cached = FAR.get(rules);
  if (cached) return cached;
  const k = rules.statuses.deepRooted.rangeMultiplier;
  const spells: Record<string, unknown> = {};
  for (const [id, spec] of Object.entries(rules.spells)) {
    const range = (spec as { range?: unknown }).range;
    spells[id] = typeof range === 'number' ? { ...spec, range: range * k } : spec;
  }
  const far = { ...rules, spells: spells as unknown as GameRules['spells'] };
  FAR.set(rules, far);
  return far;
}
