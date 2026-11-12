import { resolveAim } from '../match/queries';
import type { MatchState, Wizard } from '../match/state';
import type { Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import { SPELL_FORM_BY_ELEMENT, type Weave } from '../weaving/weave';
import type { SpellId } from './catalog';
import { dismantleInArea } from './clash';
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
  castAcceleratedGrowth,
  castBonfire,
  castBonfireSmoke,
  castDeluge,
  castDrought,
  castEruption,
  castFertilize,
  castGale,
  castGiantMushroom,
  castGuidedBolt,
  castIceTrack,
  castLilyPads,
  castMandrake,
  castMonsoon,
  castPollen,
  castPowerGrid,
  castScald,
  castSolarGrenade,
  castThousandSteps,
  castThrownShadow,
  castTotemCircle,
  castWither,
  castZipline,
} from './kit/greatGround';
import {
  castCauldron,
  castDrown,
  castIceAge,
  castMangrove,
  castSteamJet,
  castTidalWave,
} from './kit/greatMarea';
import {
  castAbyssWail,
  castAshHunger,
  castBurningEcho,
  castDepth,
  castDew,
  castEmberSeed,
  castEvilEye,
  castFatalShadow,
  castForge,
  castGraft,
  castHumanRod,
  castInstant,
  castLament,
  castLinkBolt,
  castNettle,
  castOath,
  castOblivionMist,
  castOverload,
  castPickpocket,
  castPropulsion,
  castRebirth,
  castReflection,
  castRewind,
  castRot,
  castShortCircuit,
  castSiphon,
  castSoulHarvest,
  castThunderclap,
  castTransfusion,
  castVengeance,
  castVoodooDoll,
  castWaterMirror,
} from './kit/greatMind';
import { castRootCatapult, castSowing, castThornRing, castTreeStride } from './kit/greatRaiz';
import { afterCast, MOBILITY } from './kit/greatReactions';
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
  eruption: castEruption,
  solarGrenade: castSolarGrenade,
  propulsion: castPropulsion,
  monsoon: castMonsoon,
  forge: castForge,
  scald: castScald,
  emberSeed: castEmberSeed,
  bonfireSmoke: castBonfireSmoke,
  bonfire: castBonfire,
  ashHunger: castAshHunger,
  burningEcho: castBurningEcho,
  overload: castOverload,
  humanRod: castHumanRod,
  shortCircuit: castShortCircuit,
  thunderclap: castThunderclap,
  totemCircle: castTotemCircle,
  thousandSteps: castThousandSteps,
  iceTrack: castIceTrack,
  gale: castGale,
  guidedBolt: castGuidedBolt,
  zipline: castZipline,
  acceleratedGrowth: castAcceleratedGrowth,
  powerGrid: castPowerGrid,
  rewind: castRewind,
  instant: castInstant,
  linkBolt: castLinkBolt,
  siphon: castSiphon,
  deluge: castDeluge,
  reflection: castReflection,
  waterMirror: castWaterMirror,
  lilyPads: castLilyPads,
  rebirth: castRebirth,
  depth: castDepth,
  oblivionMist: castOblivionMist,
  pollen: castPollen,
  giantMushroom: castGiantMushroom,
  nettle: castNettle,
  fertilize: castFertilize,
  dew: castDew,
  drought: castDrought,
  graft: castGraft,
  rot: castRot,
  wither: castWither,
  pickpocket: castPickpocket,
  fatalShadow: castFatalShadow,
  evilEye: castEvilEye,
  oath: castOath,
  thrownShadow: castThrownShadow,
  lament: castLament,
  abyssWail: castAbyssWail,
  transfusion: castTransfusion,
  voodooDoll: castVoodooDoll,
  soulHarvest: castSoulHarvest,
  mandrake: castMandrake,
  vengeance: castVengeance,
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
  'propulsion',
  'forge',
  'bonfire',
  'burningEcho',
  'overload',
  'humanRod',
  'rewind',
  'reflection',
  'waterMirror',
  'lilyPads',
  'rebirth',
  'depth',
  'nettle',
  'dew',
  'graft',
  'emberSeed',
  'soulHarvest',
  'mandrake',
  'thrownShadow',
  'zipline',
  'abyssWail',
  'acceleratedGrowth',
]);

/** Los hechizos que viajan: el apuntado automático se adelanta al rival según su velocidad. */
function leadSpeedOf(spell: SpellId, rules: GameRules): number {
  if (spell === 'spark') return rules.spells.spark.speed;
  if (spell === 'fireball') return rules.spells.fireball.speed;
  if (spell === 'blinding') return rules.spells.blinding.speed;
  if (spell === 'blackFlame') return rules.spells.blackFlame.speed;
  if (spell === 'darkComet') return rules.spells.darkComet.speed;
  if (spell === 'siphon') return rules.spells.siphon.speed;
  return 0;
}

/** Hace salir un hechizo ya canalizado. `fromEcho` es la segunda salida del Eco ardiente. */
export function castSpell(
  state: MatchState,
  caster: Wizard,
  spell: SpellId,
  weave: Weave,
  rawAim: Vec2,
  rules: GameRules,
  fromEcho = false,
  reach?: number,
): void {
  // Dentro del Diluvio no se salta ni se teletransporta.
  if (caster.statuses.grounded && MOBILITY.has(spell)) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    caster.lastWeave = weave;
    return;
  }
  // Atacar desde el Velo lo rompe, y ese hechizo pega más. Moverse o curarse no lo rompe.
  const breaksVeil = caster.statuses.veiled !== undefined && !QUIET.has(spell);
  if (breaksVeil) delete caster.statuses.veiled;
  // Con el Réquiem encima, los hechizos salen pero no hacen daño.
  const muted = caster.statuses.muted ? 0 : 1;
  const bonus = (breaksVeil ? rules.statuses.veiled.damageMultiplier : 1) * muted;
  const aim = resolveAim(state, caster, rawAim, rules, leadSpeedOf(spell, rules));
  const form = SPELL_FORM_BY_ELEMENT[weave[0] ?? 'brasa'];
  state.events.push({ type: 'release', wizardId: caster.id, form, spell });
  // Con Raíces profundas, todo llega más lejos.
  const far = caster.statuses.deepRooted ? farRules(rules) : rules;
  const before = state.events.length;
  CASTERS[spell]({
    state,
    caster,
    spell,
    weave,
    aim,
    rules: far,
    bonus,
    ...(reach === undefined ? {} : { reach }),
  });
  // Choque de tejidos: el área de lo que acabas de lanzar desarma proyectiles rivales opuestos.
  if (muted) dismantleWithCast(state, caster, weave, before, rules);
  afterCast(state, caster, spell, weave, aim, rules, fromEcho);
}

/** Revisa las explosiones y conos que salieron de este lanzamiento (eventos `burst`). */
function dismantleWithCast(
  state: MatchState,
  caster: Wizard,
  weave: Weave,
  firstEvent: number,
  rules: GameRules,
): void {
  const bursts = state.events.slice(firstEvent).filter((e) => e.type === 'burst');
  for (const burst of bursts) {
    if (burst.type !== 'burst') continue;
    dismantleInArea(state, caster.team, weave, burst.pos, burst.radius, rules);
  }
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
