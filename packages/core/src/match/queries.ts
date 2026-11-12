import { add, distance, dot, normalize, scale, sub, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';
import type { EntityId, MatchState, Wizard } from './state';

export const isAlive = (wizard: Wizard): boolean => wizard.hp > 0;

export function wizardById(state: MatchState, id: EntityId | null): Wizard | undefined {
  return id === null ? undefined : state.wizards.find((w) => w.id === id);
}

export function enemiesOf(state: MatchState, wizard: Wizard): Wizard[] {
  return state.wizards.filter((w) => w.team !== wizard.team && isAlive(w));
}

/**
 * Un rival con Velo (o dentro del Bosque maldito) no se puede elegir como blanco salvo de muy
 * cerca, y un mago cegado no ve a ningún rival más allá de unos pocos metros.
 */
export function isHiddenFrom(target: Wizard, viewer: Wizard, rules: GameRules): boolean {
  if (isConcealedFrom(target, viewer, rules)) return true;
  if (target.team === viewer.team) return false;
  if (viewer.statuses.hunting && !target.statuses.unseen) return false;
  const d = distance(target.pos, viewer.pos);
  return viewer.statuses.blind !== undefined && d > rules.statuses.blind.sightRadius;
}

/**
 * Lo que ven las invocaciones, los orbes y las bestias domadas de un mago: tienen ojos propios,
 * así que la ceguera de su dueño no las toca, pero el Velo, la Sombra prestada y demás sigilos
 * del rival las engañan igual que a él.
 */
export function isHiddenFromServantsOf(target: Wizard, owner: Wizard, rules: GameRules): boolean {
  return isConcealedFrom(target, owner, rules);
}

/** Lo que esconde a un rival por sí mismo, sin contar la vista de quien mira. */
function isConcealedFrom(target: Wizard, viewer: Wizard, rules: GameRules): boolean {
  if (target.team === viewer.team) return false;
  const t = target.statuses;
  // La Sombra prestada esconde de un solo rival, hasta pegado.
  if (t.shadowed?.targetId === viewer.id) return true;
  // El Cazador ve a todos, salvo a quien borró su rastro con la Lluvia que borra.
  if (viewer.statuses.hunting && !t.unseen) return false;
  const d = distance(target.pos, viewer.pos);
  const close = rules.statuses.veiled.revealRadius;
  return Boolean((t.veiled || t.shrouded) && d > close);
}

export function nearestEnemy(
  state: MatchState,
  wizard: Wizard,
  rules: GameRules,
): Wizard | undefined {
  let best: Wizard | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemiesOf(state, wizard)) {
    if (isHiddenFrom(enemy, wizard, rules)) continue;
    const d = distance(enemy.pos, wizard.pos);
    if (d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

/** El objetivo fijado si sigue vivo y a la vista; si no, el enemigo visible más cercano. */
export function currentTarget(
  state: MatchState,
  wizard: Wizard,
  rules: GameRules,
): Wizard | undefined {
  const locked = wizardById(state, wizard.lockTarget);
  if (
    locked &&
    isAlive(locked) &&
    locked.team !== wizard.team &&
    !isHiddenFrom(locked, wizard, rules)
  ) {
    return locked;
  }
  return nearestEnemy(state, wizard, rules);
}

/** A qué apunta el disparo automático: un mago rival o una bestia. */
export interface AimTarget {
  readonly id: EntityId;
  readonly kind: 'wizard' | 'beast';
  readonly pos: Vec2;
  readonly velocity: Vec2;
}

/**
 * El blanco del disparo automático, el mismo que marca el suelo:
 * 1. lo fijado a mano (mago o bestia), mientras siga vivo, a la vista y a `lockRange`;
 * 2. si no, el rival visible a `range` mejor puesto (cerca y delante);
 * 3. si no hay rivales a tiro, la bestia mejor puesta a `range`;
 * 4. si no hay nada, null (se dispara hacia donde se mira).
 * Antes solo se buscaban magos, a cualquier distancia: con un campamento al lado, el hechizo
 * salía hacia un rival lejano.
 */
export function autoTarget(state: MatchState, wizard: Wizard, rules: GameRules): AimTarget | null {
  const { range, lockRange, frontWeight } = rules.aim;
  const moveSpeed = rules.wizard.moveSpeed;
  const asWizard = (w: Wizard): AimTarget => ({
    id: w.id,
    kind: 'wizard',
    pos: w.pos,
    velocity: scale(w.moveInput, moveSpeed),
  });

  if (wizard.lockTarget !== null) {
    const locked = wizardById(state, wizard.lockTarget);
    if (
      locked &&
      isAlive(locked) &&
      locked.team !== wizard.team &&
      !isHiddenFrom(locked, wizard, rules) &&
      distance(locked.pos, wizard.pos) <= lockRange
    ) {
      return asWizard(locked);
    }
    const beast = state.beasts.find((b) => b.id === wizard.lockTarget && b.hp > 0);
    if (beast && distance(beast.pos, wizard.pos) <= lockRange) {
      return { id: beast.id, kind: 'beast', pos: beast.pos, velocity: beast.velocity };
    }
  }

  // Cerca y delante: a la espalda cuenta como más lejos.
  const score = (pos: Vec2): number => {
    const offset = sub(pos, wizard.pos);
    const d = Math.hypot(offset.x, offset.z);
    if (d > range) return Number.POSITIVE_INFINITY;
    const ahead = d > 1e-3 ? dot(scale(offset, 1 / d), wizard.facing) : 1;
    return d * (1 + (frontWeight * (1 - ahead)) / 2);
  };

  let bestWizard: Wizard | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const enemy of enemiesOf(state, wizard)) {
    if (isHiddenFrom(enemy, wizard, rules)) continue;
    const s = score(enemy.pos);
    if (s < bestScore) {
      bestWizard = enemy;
      bestScore = s;
    }
  }
  if (bestWizard) return asWizard(bestWizard);

  let bestBeast: AimTarget | null = null;
  for (const beast of state.beasts) {
    // Una bestia domada por tu equipo pelea contigo: no se le dispara.
    if (beast.hp <= 0 || tamedByAlly(state, wizard, beast.tamedBy)) continue;
    const s = score(beast.pos);
    if (s < bestScore) {
      bestBeast = { id: beast.id, kind: 'beast', pos: beast.pos, velocity: beast.velocity };
      bestScore = s;
    }
  }
  return bestBeast;
}

function tamedByAlly(state: MatchState, wizard: Wizard, tamer: EntityId | null): boolean {
  if (tamer === null) return false;
  return wizardById(state, tamer)?.team === wizard.team;
}

/**
 * Dirección de lanzamiento: la elegida, o hacia el objetivo si se tocó sin arrastrar.
 * Con `leadSpeed` (proyectiles), el apuntado automático se adelanta al movimiento del rival.
 */
export function resolveAim(
  state: MatchState,
  wizard: Wizard,
  aim: Vec2,
  rules: GameRules,
  leadSpeed = 0,
): Vec2 {
  const chosen = normalize(aim);
  if (chosen.x !== 0 || chosen.z !== 0) {
    return chosen;
  }
  const target = autoTarget(state, wizard, rules);
  if (!target) {
    return wizard.facing;
  }
  let aimPoint = target.pos;
  if (leadSpeed > 0) {
    const time = distance(wizard.pos, target.pos) / leadSpeed;
    aimPoint = add(target.pos, scale(target.velocity, time));
  }
  return normalize(sub(aimPoint, wizard.pos), wizard.facing);
}
