import { applyStatus } from '../../combat/hit';
import { placeInArena } from '../../match/obstacles';
import type { GrownTree } from '../../match/state';
import { add, clampToCircle, distance, scale } from '../../math/vec2';
import { type CastContext, nextId, payloadFor, placeZone, summon } from './context';
import { sweeper } from './greatTormenta';
import { groundPoint, targetInCone } from './shared';

function fizzle(ctx: CastContext): void {
  ctx.state.events.push({ type: 'fizzle', wizardId: ctx.caster.id });
}

function pointAhead(ctx: CastContext, range: number) {
  const { state, caster, rules } = ctx;
  return clampToCircle(
    groundPoint(state, caster, ctx.aim, range, rules, ctx.reach),
    rules.arenaRadius - 1,
  );
}

// Mapa vivo.

/** Incendio forestal: un frente de fuego que quema rivales y árboles por el resto de la ronda. */
export function castForestFire(ctx: CastContext): void {
  const spell = ctx.rules.spells.forestFire;
  sweeper(ctx, 'wildfire', spell, spell.halfWidth, 0, payloadFor(ctx, spell.damage, ['burn']));
}

/** Domar bestia: la bestia apuntada pelea para ti un rato. */
export function castTameBeast(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.tameBeast;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  // Si hay un rival en el cono, igual se busca la bestia: el hechizo es para ellas.
  const beast =
    target?.kind === 'beast'
      ? target.beast
      : state.beasts.find(
          (b) =>
            !b.guardian &&
            b.hp > 0 &&
            distance(b.pos, caster.pos) <= spell.range &&
            (b.pos.x - caster.pos.x) * ctx.aim.x + (b.pos.z - caster.pos.z) * ctx.aim.z >
              spell.coneDot * distance(b.pos, caster.pos),
        );
  if (!beast || beast.guardian) {
    fizzle(ctx);
    return;
  }
  beast.tamedBy = caster.id;
  beast.tamedTicks = spell.durationTicks;
  beast.targetId = null;
  beast.aggroTicks = 0;
  state.events.push({ type: 'burst', spell: 'tameBeast', pos: beast.pos, radius: 1.2 });
}

/** Brote de árbol: un árbol nuevo que tapa paso, hechizos y vista hasta el fin de la ronda. */
export function castTreeSprout(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.treeSprout;
  const own = state.spells.filter(
    (s): s is GrownTree => s.kind === 'grownTree' && s.ownerId === caster.id,
  );
  if (own.length >= spell.maxPerWizard) {
    const oldest = own[0];
    state.spells = state.spells.filter((s) => s !== oldest);
  }
  const pos = pointAhead(ctx, spell.range);
  state.spells.push({
    kind: 'grownTree',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos,
    radius: spell.radius,
    age: 0,
  });
  state.events.push({ type: 'burst', spell: 'treeSprout', pos, radius: 1.2 });
}

/** Un árbol nuevo crece; si el fuego lo alcanza, se va. */
export function updateGrownTree(tree: GrownTree): boolean {
  if (tree.age < 0) return false;
  tree.age++;
  return true;
}

// Información.

/** Barómetro: ves el cansancio de cada elemento del rival. */
export function castBarometer(ctx: CastContext): void {
  applyStatus(ctx.state, ctx.caster, 'insight', ctx.caster.id, ctx.rules);
}

/** Cazador: ves a todos los rivales del mapa y corres más. */
export function castHunter(ctx: CastContext): void {
  applyStatus(ctx.state, ctx.caster, 'hunting', ctx.caster.id, ctx.rules);
}

/** Huella: el rival apuntado queda a la vista de tu equipo aunque se meta en la jungla. */
export function castTrack(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.track;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    fizzle(ctx);
    return;
  }
  applyStatus(state, target.wizard, 'tracked', caster.id, rules);
  state.events.push({ type: 'burst', spell: 'track', pos: target.wizard.pos, radius: 1 });
}

/** Centinela: un ojo de sombra que mira por tu equipo. */
export function castSentinel(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.sentinel;
  // Un solo ojo por mago.
  for (const s of state.spells) {
    if (s.kind === 'summon' && s.summon === 'sentinel' && s.ownerId === caster.id) s.hp = 0;
  }
  const pos = placeInArena(pointAhead(ctx, spell.range), spell.radius, rules);
  summon(ctx, 'sentinel', spell, pos, payloadFor(ctx, 0));
}

// Sigilo.

/** Niebla carmesí: los rivales dentro no ven y tus golpes te curan. */
export function castCrimsonMist(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  placeZone(ctx, 'crimsonMist', rules.spells.crimsonMist, caster.pos);
  applyStatus(state, caster, 'leeching', caster.id, rules, rules.spells.crimsonMist.durationTicks);
}

/** Lluvia que borra: te quita marcas y rastros, y desapareces del minimapa rival. */
export function castErasingRain(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  delete caster.statuses.tracked;
  // Las marcas que otros te pusieron (Pira, Ignición, Grillete, Ahogo) se lavan.
  state.spells = state.spells.filter(
    (s) =>
      !(
        (s.kind === 'pyre' || s.kind === 'ignite' || s.kind === 'shackle' || s.kind === 'drown') &&
        s.targetId === caster.id
      ),
  );
  applyStatus(state, caster, 'unseen', caster.id, rules);
  state.events.push({ type: 'burst', spell: 'erasingRain', pos: caster.pos, radius: 1.5 });
}

/** Espejismo: tres copias tuyas que se mueven como tú. */
export function castMirage(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.mirage;
  for (const s of state.spells) {
    if (s.kind === 'summon' && s.summon === 'mirage' && s.ownerId === caster.id) s.hp = 0;
  }
  const forward = ctx.aim;
  const side = { x: -forward.z, z: forward.x };
  const offsets = [
    scale(side, spell.spread),
    scale(side, -spell.spread),
    scale(forward, -spell.spread),
  ];
  for (let slot = 0; slot < spell.count; slot++) {
    const offset = offsets[slot % offsets.length] ?? side;
    const pos = placeInArena(add(caster.pos, offset), rules.wizard.radius, rules);
    summon(ctx, 'mirage', spell, pos, payloadFor(ctx, 0), 0, slot);
  }
  state.events.push({ type: 'burst', spell: 'mirage', pos: caster.pos, radius: 2 });
}

/** Bosque maldito: un bosquecillo que esconde a tu equipo y debilita a los rivales. */
export function castCursedGrove(ctx: CastContext): void {
  const spell = ctx.rules.spells.cursedGrove;
  placeZone(ctx, 'grove', spell, pointAhead(ctx, spell.range));
}

/** Alfombra de musgo: tu equipo dentro no aparece en el minimapa rival. */
export function castMossCarpet(ctx: CastContext): void {
  placeZone(ctx, 'moss', ctx.rules.spells.mossCarpet, ctx.caster.pos);
}

/** Ilusión de tejido: el rival ve elementos falsos en tu tejido. */
export function castWeaveIllusion(ctx: CastContext): void {
  applyStatus(ctx.state, ctx.caster, 'disguised', ctx.caster.id, ctx.rules);
}

/** Sombra prestada: el rival apuntado deja de verte. */
export function castBorrowedShadow(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.borrowedShadow;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  if (target?.kind !== 'wizard') {
    fizzle(ctx);
    return;
  }
  const victim = target.wizard;
  caster.statuses.shadowed = {
    ticks: rules.statuses.shadowed.ticks,
    sourceId: caster.id,
    targetId: victim.id,
  };
  // Si te tenía fijado, te pierde.
  if (victim.lockTarget === caster.id) victim.lockTarget = null;
}

// Transformaciones.

function transform(ctx: CastContext, form: 'magma' | 'surfing' | 'deepRooted' | 'panther'): void {
  const { state, caster, rules } = ctx;
  applyStatus(state, caster, form, caster.id, rules);
  caster.weave = [];
  if (form === 'deepRooted') {
    caster.leap = null;
    for (const id of ['root', 'slow', 'soaked', 'airborne', 'frozen', 'asleep'] as const) {
      delete caster.statuses[id];
    }
  }
  if (form === 'magma') {
    for (const id of ['root', 'slow', 'soaked'] as const) delete caster.statuses[id];
  }
  state.events.push({ type: 'burst', spell: ctx.spell, pos: caster.pos, radius: 1.3 });
}

/** Forma de magma. */
export function castMagmaForm(ctx: CastContext): void {
  transform(ctx, 'magma');
}

/** Surf. */
export function castSurf(ctx: CastContext): void {
  transform(ctx, 'surfing');
}

/** Raíces profundas. */
export function castDeepRoots(ctx: CastContext): void {
  transform(ctx, 'deepRooted');
}

/** Pantera de sombra. */
export function castShadowPanther(ctx: CastContext): void {
  transform(ctx, 'panther');
}
