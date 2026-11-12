import { type ElementId, opposingOf } from '../elements';
import type { EntityId, MatchState, Projectile } from '../match/state';
import { distance, scale, type Vec2 } from '../math/vec2';
import type { GameRules } from '../rules';

/**
 * Choque de tejidos. Lo único que se desarma son proyectiles rivales en el aire; lo que los
 * desarma es cualquier hechizo tuyo cuyo primer elemento sea opuesto al suyo y que los toque:
 * otro proyectil (abajo) o el área de un cono o una explosión al lanzarse (`dismantleInArea`).
 *
 * Entre proyectiles: dos proyectiles de equipos distintos cuyos primeros elementos son opuestos
 * en el pentágono se encuentran en el aire (contra Brasa chocan Marea y Raíz). Con el mismo
 * número de elementos se deshacen los dos; si no, el más fuerte sigue, con el daño rebajado en la
 * proporción del más débil (2 contra 1: queda la mitad; 3 contra 1: dos tercios; 3 contra 2: un
 * tercio). Iguales o vecinos se cruzan sin chocar. Solo proyectiles: lo que cae del cielo
 * (Meteoro) se esquiva moviéndose.
 *
 * Devuelve los ids de los proyectiles que se deshicieron en este paso.
 */
export function resolveClashes(state: MatchState, rules: GameRules): Set<EntityId> {
  const gone = new Set<EntityId>();
  const flying = state.spells.filter(
    (s): s is Projectile => s.kind === 'projectile' && !s.held && s.payload.weave.length > 0,
  );
  const margin = rules.interactions.clash.margin;
  for (let i = 0; i < flying.length; i++) {
    const a = flying[i];
    if (!a || gone.has(a.id)) continue;
    for (let j = i + 1; j < flying.length; j++) {
      const b = flying[j];
      if (!b || gone.has(b.id) || a.team === b.team) continue;
      if (!opposed(a, b)) continue;
      if (distance(a.pos, b.pos) > a.radius + b.radius + margin) continue;
      clash(state, a, b, gone);
      if (gone.has(a.id)) break;
    }
  }
  return gone;
}

function firstElement(projectile: Projectile) {
  return projectile.payload.weave[0];
}

function opposed(a: Projectile, b: Projectile): boolean {
  const ea = firstElement(a);
  const eb = firstElement(b);
  return ea !== undefined && eb !== undefined && opposingOf(ea).includes(eb);
}

function clash(state: MatchState, a: Projectile, b: Projectile, gone: Set<EntityId>): void {
  const ea = firstElement(a);
  const eb = firstElement(b);
  if (ea === undefined || eb === undefined) return;
  const la = a.payload.weave.length;
  const lb = b.payload.weave.length;
  const pos = scale({ x: a.pos.x + b.pos.x, z: a.pos.z + b.pos.z }, 0.5);
  if (la === lb) {
    gone.add(a.id);
    gone.add(b.id);
    state.events.push({ type: 'clash', pos, elements: [ea, eb], survivorId: null });
    return;
  }
  const [strong, weak] = la > lb ? [a, b] : [b, a];
  const left = 1 - weak.payload.weave.length / strong.payload.weave.length;
  gone.add(weak.id);
  strong.power = (strong.power ?? 1) * left;
  strong.payload = { ...strong.payload, damage: strong.payload.damage * left };
  state.events.push({ type: 'clash', pos, elements: [ea, eb], survivorId: strong.id });
}

/**
 * El área de un hechizo tuyo recién lanzado (el cono del Salpicón, una explosión) desarma los
 * proyectiles rivales opuestos que toca. Con tantos o más elementos que el proyectil, lo
 * deshace; con menos, lo debilita en esa proporción y el proyectil sigue.
 */
export function dismantleInArea(
  state: MatchState,
  team: number,
  weave: readonly ElementId[],
  pos: Vec2,
  radius: number,
  rules: GameRules,
): Set<EntityId> {
  const gone = new Set<EntityId>();
  const first = weave[0];
  if (first === undefined) return gone;
  const margin = rules.interactions.clash.margin;
  for (const projectile of state.spells) {
    if (projectile.kind !== 'projectile' || projectile.team === team || projectile.held) continue;
    const element = firstElement(projectile);
    if (element === undefined || !opposingOf(first).includes(element)) continue;
    if (distance(projectile.pos, pos) > radius + projectile.radius + margin) continue;
    const length = projectile.payload.weave.length;
    if (weave.length >= length) {
      gone.add(projectile.id);
      state.events.push({
        type: 'clash',
        pos: projectile.pos,
        elements: [first, element],
        survivorId: null,
      });
      continue;
    }
    const left = 1 - weave.length / length;
    projectile.power = (projectile.power ?? 1) * left;
    projectile.payload = { ...projectile.payload, damage: projectile.payload.damage * left };
    state.events.push({
      type: 'clash',
      pos: projectile.pos,
      elements: [first, element],
      survivorId: projectile.id,
    });
  }
  if (gone.size > 0) state.spells = state.spells.filter((s) => !gone.has(s.id));
  return gone;
}
