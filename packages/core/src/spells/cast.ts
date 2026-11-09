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
  CASTERS[spell]({ state, caster, spell, weave, aim, rules, bonus });
}
