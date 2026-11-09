import { applyHit } from '../combat/hit';
import { damageBeast } from '../match/beasts';
import { currentTarget, enemiesOf } from '../match/queries';
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

/** Hace salir un conjuro ya canalizado, según su forma. */
export function releaseSpell(
  state: MatchState,
  caster: Wizard,
  payload: SpellPayload,
  aim: Vec2,
  rules: GameRules,
): void {
  state.events.push({ type: 'release', wizardId: caster.id, form: payload.form });
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
  const target = currentTarget(state, caster);
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
  for (const enemy of enemiesOf(state, caster)) {
    const toEnemy = sub(enemy.pos, caster.pos);
    if (length(toEnemy) > range) continue;
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
    return length(toBeast) <= range && dot(normalize(toBeast), aim) >= form.coneDot;
  });
  if (beast) {
    state.events.push({ type: 'markBeast', wizardId: caster.id, beastId: beast.id });
    damageBeast(state, beast, caster.id, payload.damage, rules);
  } else {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
  }
}
