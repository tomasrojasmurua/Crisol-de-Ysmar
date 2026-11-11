import {
  autoTarget,
  type EntityId,
  type GameRules,
  isHiddenFrom,
  type MatchState,
  type Vec2,
  type Wizard,
} from '@crisol/core';

/**
 * Lo que se puede fijar para entrar en duelo: lo mismo que el núcleo acepta como blanco fijado
 * (vivo, a la vista y a `lockRange`). Si se aceptara algo más, el núcleo lo soltaría al cuadro
 * siguiente y parecería que el toque no hizo nada.
 */
export function canLock(
  state: MatchState,
  player: Wizard,
  rules: GameRules,
  id: EntityId,
): boolean {
  const reach = rules.aim.lockRange;
  const near = (pos: Vec2): boolean =>
    Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) <= reach;
  const wizard = state.wizards.find((w) => w.id === id);
  if (wizard) {
    return (
      wizard.team !== player.team &&
      wizard.hp > 0 &&
      !isHiddenFrom(wizard, player, rules) &&
      near(wizard.pos)
    );
  }
  const beast = state.beasts.find((b) => b.id === id);
  if (!beast || beast.hp <= 0 || !near(beast.pos)) return false;
  // Una bestia domada por tu equipo pelea contigo: no se le hace duelo.
  const tamer = beast.tamedBy === null ? null : state.wizards.find((w) => w.id === beast.tamedBy);
  return tamer?.team !== player.team;
}

/**
 * El botón de duelo. Sin duelo, fija al mejor puesto (el mismo que marca el disparo
 * automático). En duelo, pasa al siguiente de izquierda a derecha según la cámara, y del último
 * vuelve al primero. Va entre los magos rivales; las bestias solo entran si no hay ningún mago
 * al alcance, para no tener que pasar por todo un campamento hasta llegar a un rival.
 * Devuelve null si no hay nada que fijar.
 */
export function nextLockTarget(
  state: MatchState,
  player: Wizard,
  rules: GameRules,
  forward: Vec2,
  current: EntityId | null,
): EntityId | null {
  const lockable = (id: EntityId): boolean => canLock(state, player, rules, id);
  const wizards = state.wizards.filter((w) => lockable(w.id));
  const pool: { id: EntityId; pos: Vec2 }[] =
    wizards.length > 0 ? wizards : state.beasts.filter((b) => lockable(b.id));
  if (pool.length === 0) return null;

  // Ángulo de cada uno respecto de donde mira la cámara: negativo a la izquierda.
  const right = { x: -forward.z, z: forward.x };
  const angleOf = (pos: Vec2): number => {
    const dx = pos.x - player.pos.x;
    const dz = pos.z - player.pos.z;
    return Math.atan2(dx * right.x + dz * right.z, dx * forward.x + dz * forward.z);
  };
  const ordered = pool
    .map((entry) => ({ id: entry.id, angle: angleOf(entry.pos) }))
    .sort((a, b) => a.angle - b.angle || a.id - b.id);

  const index = current === null ? -1 : ordered.findIndex((entry) => entry.id === current);
  if (index < 0) {
    const best = autoTarget(state, { ...player, lockTarget: null }, rules);
    if (best && ordered.some((entry) => entry.id === best.id)) return best.id;
    // Si no, el más cercano al centro de la pantalla.
    return ordered.reduce((a, b) => (Math.abs(b.angle) < Math.abs(a.angle) ? b : a)).id;
  }
  return ordered[(index + 1) % ordered.length]?.id ?? null;
}
