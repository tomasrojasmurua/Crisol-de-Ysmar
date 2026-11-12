import { applyHit, applyStatus } from '../../combat/hit';
import { moveMultiplier } from '../../combat/statuses';
import { lineBlocked, placeInArena } from '../../match/obstacles';
import { wizardById } from '../../match/queries';
import type { MatchState, SpellPayload, Summon, Wizard } from '../../match/state';
import { add, distance, length, normalize, scale, sub, type Vec2 } from '../../math/vec2';
import type { GameRules } from '../../rules';
import { TICK_RATE } from '../../sim/fixedStep';
import { type CastContext, nextId, payloadFor, summon } from './context';
import { sweeper } from './greatTormenta';
import { hitArea, placedAt, targetInCone } from './shared';
import { move, nearestVisibleEnemy } from './summons';

/** Ave de ceniza: va hasta el final de su vuelo y vuelve, quemando en cada pasada. */
export function castAshBird(ctx: CastContext): void {
  const spell = ctx.rules.spells.ashBird;
  sweeper(ctx, 'bird', spell, 0, 0, payloadFor(ctx, spell.damage, ['burn']));
}

/** Manada de raíces: una fila ancha de bestias que enraíza a quien atropella. */
export function castRootPack(ctx: CastContext): void {
  const spell = ctx.rules.spells.rootPack;
  sweeper(ctx, 'stampede', spell, spell.halfWidth, 0);
}

/** Chispas errantes: tres chispas te rodean y salen, una tras otra, al rival que se acerca. */
export function castWanderingSparks(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.wanderingSparks;
  state.spells = state.spells.filter(
    (s) => !(s.kind === 'summon' && s.summon === 'wanderingSpark' && s.ownerId === caster.id),
  );
  const payload = payloadFor(ctx, spell.damage, ['burn']);
  // Medio segundo entre una y otra, para que no salgan las tres juntas.
  const gap = Math.round(TICK_RATE / 2);
  for (let slot = 0; slot < spell.count; slot++) {
    const pos = orbitPoint(state, caster, slot, spell.count, spell.orbitRadius);
    summon(ctx, 'wanderingSpark', spell, pos, payload, slot * gap, slot);
  }
}

/** Gólem de magma: se planta entre tú y el rival, y estalla cuando cae o se acaba. */
export function castMagmaGolem(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.magmaGolem;
  replaceOwn(state, caster, 'magmaGolem');
  const pos = placeInArena(
    add(caster.pos, scale(ctx.aim, spell.guardDistance)),
    spell.radius,
    rules,
  );
  summon(ctx, 'magmaGolem', spell, pos, payloadFor(ctx, spell.damage, ['burn']));
}

/** Glaciar vivo: camina hacia el rival y lo congela al tocarlo. */
export function castGlacier(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.glacier;
  const pos = placeInArena(add(caster.pos, scale(ctx.aim, 2)), spell.radius, rules);
  summon(ctx, 'glacier', spell, pos, payloadFor(ctx, spell.damage));
}

/** Enjambre: sale tras el rival apuntado (o el más cercano) y no lo suelta. */
export function castSwarm(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.swarm;
  const target = targetInCone(state, caster, ctx.aim, spell.range, spell.coneDot, rules);
  const pos = add(caster.pos, scale(ctx.aim, 1));
  const created = summon(ctx, 'swarm', spell, pos, payloadFor(ctx, 0));
  if (target?.kind === 'wizard') created.targetId = target.wizard.id;
}

/** Árbol ancestral: brota delante tuyo, ataja proyectiles y azota alrededor. */
export function castAncientTree(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.ancientTree;
  replaceOwn(state, caster, 'ancientTree');
  const pos = placeInArena(placedAt(ctx, spell.distance), spell.radius, rules);
  summon(ctx, 'ancientTree', spell, pos, payloadFor(ctx, spell.damage), spell.intervalTicks);
}

/** Gemelo sombrío: un clon tuyo que se acerca al rival y le dispara dardos. */
export function castShadowTwin(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.shadowTwin;
  replaceOwn(state, caster, 'shadowTwin');
  const side = { x: -ctx.aim.z, z: ctx.aim.x };
  const pos = placeInArena(add(caster.pos, scale(side, 1.2)), spell.radius, rules);
  summon(ctx, 'shadowTwin', spell, pos, payloadFor(ctx, spell.damage), spell.intervalTicks);
}

/** Planta carnívora: brota delante tuyo y se traga al primer rival que se le acerca. */
export function castCarnivore(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.carnivore;
  replaceOwn(state, caster, 'carnivore');
  const pos = placeInArena(placedAt(ctx, spell.distance), spell.radius, rules);
  summon(ctx, 'carnivore', spell, pos, payloadFor(ctx, spell.damage));
}

/** Una sola invocación de cada clase por mago: la nueva reemplaza a la anterior. */
function replaceOwn(state: MatchState, caster: Wizard, kind: Summon['summon']): void {
  for (const s of state.spells) {
    if (s.kind === 'summon' && s.summon === kind && s.ownerId === caster.id && s.hp > 0) {
      s.hp = 0;
      state.events.push({ type: 'summonGone', summon: kind, pos: s.pos });
    }
  }
}

function orbitPoint(
  state: MatchState,
  owner: Wizard,
  slot: number,
  count: number,
  radius: number,
): Vec2 {
  const angle = (slot / count) * Math.PI * 2 + state.tick * 0.08;
  return add(owner.pos, { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
}

/** Lo que pasa cuando una invocación se va: el Gólem estalla y la Planta suelta lo que tragó. */
export function summonGone(state: MatchState, gone: Summon, rules: GameRules): void {
  if (gone.summon === 'magmaGolem') {
    const radius = rules.spells.magmaGolem.blastRadius;
    hitArea(state, gone.ownerId, gone.team, gone.pos, radius, gone.payload, 'magmaGolem', rules);
  } else if (gone.summon === 'carnivore') {
    const victim = wizardById(state, gone.targetId);
    if (victim?.statuses.stasis?.sourceId === gone.ownerId) delete victim.statuses.stasis;
  }
}

/** Una Chispa errante gira a tu alrededor; si un rival se acerca, sale disparada hacia él. */
export function updateWanderingSpark(
  state: MatchState,
  spark: Summon,
  owner: Wizard,
  rules: GameRules,
): boolean {
  const spell = rules.spells.wanderingSparks;
  spark.pos = orbitPoint(state, owner, spark.slot, spell.count, spell.orbitRadius);
  if (spark.cooldown > 0) spark.cooldown--;
  const prey = nearestVisibleEnemy(state, owner, owner.pos, spell.seekRange, rules);
  if (!prey || spark.cooldown > 0) return true;
  const dir = normalize(sub(prey.pos, spark.pos), owner.facing);
  shoot(state, spark, dir, spell.speed, spell.seekRange + 3, spark.payload);
  // Las que quedan esperan su turno.
  for (const other of state.spells) {
    if (other.kind === 'summon' && other.summon === 'wanderingSpark' && other !== spark) {
      if (other.ownerId === spark.ownerId) other.cooldown = Math.max(other.cooldown, 15);
    }
  }
  return false;
}

function shoot(
  state: MatchState,
  from: Summon,
  dir: Vec2,
  speed: number,
  range: number,
  payload: SpellPayload,
): void {
  state.spells.push({
    kind: 'projectile',
    id: nextId(state),
    ownerId: from.ownerId,
    team: from.team,
    pos: add(from.pos, scale(dir, from.radius)),
    velocity: scale(dir, speed),
    deflected: false,
    radius: 0.3,
    travelled: 0,
    maxRange: range,
    payload,
    trait: null,
  });
}

/** El Gólem de magma se queda entre su mago y el rival más cercano. */
export function updateMagmaGolem(
  state: MatchState,
  golem: Summon,
  owner: Wizard,
  rules: GameRules,
): void {
  const spell = rules.spells.magmaGolem;
  const threat = nearestVisibleEnemy(state, owner, owner.pos, 18, rules);
  const toward = threat ? normalize(sub(threat.pos, owner.pos), owner.facing) : owner.facing;
  const post = add(owner.pos, scale(toward, spell.guardDistance));
  if (distance(post, golem.pos) > 0.3) move(golem, sub(post, golem.pos), spell.speed, rules);
}

/** El Glaciar vivo camina hacia el rival más cercano y lo congela al tocarlo. */
export function updateGlacier(
  state: MatchState,
  glacier: Summon,
  owner: Wizard,
  rules: GameRules,
): boolean {
  const spell = rules.spells.glacier;
  const prey = nearestVisibleEnemy(state, owner, glacier.pos, spell.seekRange, rules);
  if (!prey) return true;
  if (distance(prey.pos, glacier.pos) <= glacier.radius + rules.wizard.radius + 0.1) {
    state.events.push({ type: 'burst', spell: 'glacier', pos: prey.pos, radius: 1.2 });
    applyHit(state, prey, glacier.ownerId, glacier.payload, rules);
    applyStatus(state, prey, 'frozen', glacier.ownerId, rules);
    if (prey.statuses.frozen) {
      prey.channel = null;
      prey.leap = null;
    }
    state.events.push({ type: 'summonGone', summon: 'glacier', pos: glacier.pos });
    return false;
  }
  move(glacier, sub(prey.pos, glacier.pos), spell.speed, rules);
  return true;
}

/** El Enjambre vuela hasta su presa y, pegado a ella, la frena y le tapa la vista. */
export function updateSwarm(
  state: MatchState,
  swarm: Summon,
  owner: Wizard,
  rules: GameRules,
): void {
  const spell = rules.spells.swarm;
  let prey = wizardById(state, swarm.targetId);
  if (!prey || prey.hp <= 0) {
    prey = nearestVisibleEnemy(state, owner, swarm.pos, spell.range, rules);
    swarm.targetId = prey?.id ?? null;
  }
  const goal = prey ? prey.pos : owner.pos;
  const offset = sub(goal, swarm.pos);
  const gap = distance(goal, swarm.pos);
  if (gap > 0.4) {
    // Vuela por encima de árboles y rocas.
    const step = scale(normalize(offset), Math.min(gap, spell.speed / TICK_RATE));
    swarm.pos = add(swarm.pos, step);
    swarm.facing = normalize(step, swarm.facing);
  }
  if (prey && gap <= spell.reach) {
    // Un estorbo de un instante que se renueva mientras siga encima.
    applyStatus(state, prey, 'slow', swarm.ownerId, rules, 6);
    applyStatus(state, prey, 'blind', swarm.ownerId, rules, 6);
  }
}

/** El Árbol ancestral azota cada tanto a los rivales cercanos y los enraíza. */
export function updateAncientTree(state: MatchState, tree: Summon, rules: GameRules): void {
  if (--tree.cooldown > 0) return;
  const spell = rules.spells.ancientTree;
  tree.cooldown = spell.intervalTicks;
  const near = state.wizards.filter(
    (w) =>
      w.team !== tree.team &&
      w.hp > 0 &&
      distance(w.pos, tree.pos) <= spell.reach + rules.wizard.radius,
  );
  if (near.length === 0 && !state.beasts.some((b) => distance(b.pos, tree.pos) <= spell.reach)) {
    return;
  }
  hitArea(
    state,
    tree.ownerId,
    tree.team,
    tree.pos,
    spell.reach,
    tree.payload,
    'ancientTree',
    rules,
  );
  for (const wizard of near) {
    applyStatus(state, wizard, 'root', tree.ownerId, rules);
    wizard.leap = null;
  }
}

/** El Gemelo sombrío se acerca al rival hasta su distancia de tiro y le dispara. */
export function updateShadowTwin(
  state: MatchState,
  twin: Summon,
  owner: Wizard,
  rules: GameRules,
): void {
  const spell = rules.spells.shadowTwin;
  if (twin.cooldown > 0) twin.cooldown--;
  const prey = nearestVisibleEnemy(state, owner, twin.pos, 20, rules);
  if (!prey) {
    if (distance(owner.pos, twin.pos) > 2) move(twin, sub(owner.pos, twin.pos), spell.speed, rules);
    return;
  }
  const gap = distance(prey.pos, twin.pos);
  if (gap > spell.keepDistance) {
    move(twin, sub(prey.pos, twin.pos), spell.speed, rules);
  } else {
    twin.facing = normalize(sub(prey.pos, twin.pos), twin.facing);
  }
  if (twin.cooldown > 0 || gap > spell.boltRange) return;
  if (lineBlocked(twin.pos, prey.pos, rules.map.obstacles)) return;
  twin.cooldown = spell.intervalTicks;
  shoot(state, twin, twin.facing, spell.boltSpeed, spell.boltRange + 1, twin.payload);
}

/**
 * La Planta carnívora se traga al primer rival que se le acerca: adentro no actúa ni recibe
 * daño, y al rato lo escupe herido. Luego se marchita.
 */
export function updateCarnivore(state: MatchState, plant: Summon, rules: GameRules): boolean {
  const spell = rules.spells.carnivore;
  const swallowed = wizardById(state, plant.targetId);
  if (swallowed) {
    swallowed.pos = plant.pos;
    if (--plant.cooldown > 0 && swallowed.hp > 0) return true;
    delete swallowed.statuses.stasis;
    const out = normalize(plant.facing, { x: 0, z: 1 });
    swallowed.pos = placeInArena(
      add(plant.pos, scale(out, spell.reach)),
      rules.wizard.radius,
      rules,
    );
    state.events.push({ type: 'burst', spell: 'carnivore', pos: swallowed.pos, radius: 1 });
    applyHit(state, swallowed, plant.ownerId, plant.payload, rules);
    state.events.push({ type: 'summonGone', summon: 'carnivore', pos: plant.pos });
    return false;
  }
  for (const wizard of state.wizards) {
    if (wizard.team === plant.team || wizard.hp <= 0 || wizard.leap) continue;
    if (wizard.statuses.stasis) continue;
    if (distance(wizard.pos, plant.pos) > spell.reach + rules.wizard.radius) continue;
    plant.targetId = wizard.id;
    plant.cooldown = spell.swallowTicks;
    plant.facing = normalize(sub(wizard.pos, plant.pos), plant.facing);
    wizard.statuses.stasis = { ticks: spell.swallowTicks + 1, sourceId: plant.ownerId };
    wizard.channel = null;
    wizard.weave = [];
    wizard.pos = plant.pos;
    state.events.push({ type: 'burst', spell: 'carnivore', pos: plant.pos, radius: 1.2 });
    return true;
  }
  return true;
}

/** Una copia del Espejismo camina igual que su mago. */
export function updateMirage(copy: Summon, owner: Wizard, rules: GameRules): void {
  copy.facing = owner.facing;
  const speed = rules.wizard.moveSpeed * owner.mods.moveSpeed * moveMultiplier(owner, rules);
  if (length(owner.moveInput) > 0.05)
    move(copy, owner.moveInput, speed * length(owner.moveInput), rules);
  copy.facing = owner.facing;
}
