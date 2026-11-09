import { applyHit } from '../combat/hit';
import { damageBeast } from '../match/beasts';
import { lineBlocked } from '../match/obstacles';
import { currentTarget, enemiesOf, isHiddenFrom } from '../match/queries';
import type { MatchState, SpellPayload, Wizard } from '../match/state';
import {
  add,
  clampToCircle,
  distance,
  dot,
  length,
  normalize,
  perpendicular,
  scale,
  sub,
  type Vec2,
} from '../math/vec2';
import type { GameRules } from '../rules';

/** Grosor del muro de agua de la gramática antigua. */
const LEGACY_WALL_THICKNESS = 0.25;

/** Hace salir un conjuro ya canalizado, según su forma. */
export function releaseSpell(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  state.events.push({ type: 'release', wizardId: caster.id, form: payload.form, spell: null });
  switch (payload.form) {
    case 'projectile':
      releaseProjectile(state, caster, payload, aim, rules);
      return;
    case 'wall':
      releaseWall(state, caster, payload, aim, rules);
      return;
    case 'trap':
      releaseTrap(state, caster, payload, aim, rules);
      return;
    case 'leap':
      releaseLeap(caster, payload, aim, rules);
      return;
    case 'mark':
      releaseMark(state, caster, payload, aim, rules);
      return;
  }
}

function releaseProjectile(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  const form = rules.forms.projectile;
  state.spells.push({
    kind: 'projectile',
    id: state.nextEntityId++,
    ownerId: caster.id,
    team: caster.team,
    pos: add(caster.pos, scale(aim, rules.wizard.radius + form.radius)),
    velocity: scale(aim, form.speed * payload.speedMultiplier),
    radius: form.radius,
    travelled: 0,
    maxRange: form.range * payload.rangeMultiplier,
    payload,
  });
}

function releaseWall(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  const form = rules.forms.wall;
  const center = add(caster.pos, scale(aim, form.distance));
  state.spells.push({
    kind: 'wall',
    id: state.nextEntityId++,
    ownerId: caster.id,
    team: caster.team,
    center,
    along: perpendicular(aim),
    halfLength: form.halfLength,
    thickness: LEGACY_WALL_THICKNESS,
    solid: false,
    durationTicks: form.durationTicks,
    ticksLeft: form.durationTicks,
    payload,
  });
  // Al levantarse, el muro estalla contra quien esté cerca.
  for (const enemy of enemiesOf(state, caster)) {
    if (distance(enemy.pos, center) <= form.pulseRadius) {
      applyHit(state, enemy, caster.id, payload, rules);
    }
  }
  for (const beast of state.beasts) {
    if (distance(beast.pos, center) <= form.pulseRadius) {
      damageBeast(state, beast, caster.id, payload.damage, rules);
    }
  }
}

function releaseTrap(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  const form = rules.forms.trap;
  const range = form.range * payload.rangeMultiplier;
  // La trampa cae a los pies del objetivo si está a tiro; si no, al máximo alcance.
  const target = currentTarget(state, caster, rules);
  const toTarget = target ? sub(target.pos, caster.pos) : null;
  const aimedAtTarget =
    toTarget !== null && length(toTarget) <= range && dot(normalize(toTarget), aim) > 0.9;
  const pos = aimedAtTarget && target ? target.pos : add(caster.pos, scale(aim, range));
  state.spells.push({
    kind: 'trap',
    id: state.nextEntityId++,
    ownerId: caster.id,
    team: caster.team,
    pos: clampToCircle(pos, rules.arenaRadius),
    armTicks: form.armTicks,
    ticksLeft: form.durationTicks,
    payload,
  });
}

function releaseLeap(caster: Wizard, payload: SpellPayload, aim: Vec2, rules: GameRules): void {
  const form = rules.forms.leap;
  const distanceTotal = form.distance * payload.rangeMultiplier;
  caster.leap = {
    ticksLeft: form.durationTicks,
    step: scale(aim, distanceTotal / form.durationTicks),
    payload,
    trail: null,
  };
}

function releaseMark(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  const form = rules.forms.mark;
  const range = form.range * payload.rangeMultiplier;
  let best: Wizard | undefined;
  let bestAlignment = form.coneDot;
  // La marca necesita ver a su blanco: un árbol o una roca en medio la cortan.
  const seen = (pos: Vec2): boolean => !lineBlocked(caster.pos, pos, rules.map.obstacles);
  for (const enemy of enemiesOf(state, caster)) {
    const toEnemy = sub(enemy.pos, caster.pos);
    if (length(toEnemy) > range || !seen(enemy.pos) || isHiddenFrom(enemy, caster, rules)) continue;
    const alignment = dot(normalize(toEnemy), aim);
    if (alignment >= bestAlignment) {
      best = enemy;
      bestAlignment = alignment;
    }
  }
  if (best) {
    applyHit(state, best, caster.id, payload, rules);
    return;
  }
  // Sin rival a la vista, la marca alcanza a una bestia.
  const beast = state.beasts.find((b) => {
    const toBeast = sub(b.pos, caster.pos);
    return length(toBeast) <= range && dot(normalize(toBeast), aim) >= form.coneDot && seen(b.pos);
  });
  if (beast) {
    state.events.push({ type: 'markBeast', wizardId: caster.id, beastId: beast.id });
    damageBeast(state, beast, caster.id, payload.damage, rules);
  } else {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
  }
}
