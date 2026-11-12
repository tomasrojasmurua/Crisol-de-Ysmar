import { applyHit, applyStatus, healWizard } from '../../combat/hit';
import { placeInArena } from '../../match/obstacles';
import { isHiddenFrom } from '../../match/queries';
import type { Field, FieldMode, SpellPayload, Summon } from '../../match/state';
import type { Vec2 } from '../../math/vec2';
import { add, clampToCircle, distance, dot, length, normalize, scale, sub } from '../../math/vec2';
import { type CastContext, nextId, payloadFor, summon } from './context';
import { detonateOrb } from './greatFieldUpdates';
import { groundPoint, hitArea, placedAt } from './shared';

function fizzle(ctx: CastContext): void {
  ctx.state.events.push({ type: 'fizzle', wizardId: ctx.caster.id });
}

/** El punto donde cae un hechizo lanzado al suelo, dentro de la arena. */
function pointAhead(ctx: CastContext, range: number): Vec2 {
  const { state, caster, rules } = ctx;
  if (range <= 0) return caster.pos;
  return clampToCircle(
    groundPoint(state, caster, ctx.aim, range, rules, ctx.reach),
    rules.arenaRadius - 1,
  );
}

/** Deja algo de la cuarta tanda en el campo. */
function field(
  ctx: CastContext,
  mode: FieldMode,
  pos: Vec2,
  radius: number,
  durationTicks: number,
  payload: SpellPayload = payloadFor(ctx, 0),
  points: readonly Vec2[] = [],
  cooldown = 0,
): Field {
  const { state, caster } = ctx;
  const created: Field = {
    kind: 'field',
    mode,
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos,
    radius,
    points,
    durationTicks,
    ticksLeft: durationTicks,
    cooldown,
    inside: [],
    payload,
  };
  state.spells.push(created);
  return created;
}

/** Los rivales vivos dentro de un cono, a la vista. */
function rivalsInCone(ctx: CastContext, range: number, coneDot: number) {
  const { state, caster, rules } = ctx;
  return state.wizards.filter((w) => {
    if (w.team === caster.team || w.hp <= 0 || isHiddenFrom(w, caster, rules)) return false;
    const offset = sub(w.pos, caster.pos);
    const d = length(offset);
    if (d > range + rules.wizard.radius) return false;
    return d < 1 || dot(normalize(offset), ctx.aim) >= coneDot;
  });
}

// Terreno.

/** Erupción: un volcán pequeño que corta el paso y lanza rocas ardientes alrededor. */
export function castEruption(ctx: CastContext): void {
  const spell = ctx.rules.spells.eruption;
  const pos = pointAhead(ctx, spell.range);
  const payload = payloadFor(ctx, spell.damage, ['burn']);
  field(ctx, 'volcano', pos, spell.radius, spell.durationTicks, payload, [], spell.intervalTicks);
  ctx.state.events.push({ type: 'burst', spell: 'eruption', pos, radius: spell.radius * 1.5 });
}

/** Monzón: una tormenta en un punto que lanza rayos a los rivales que estén adentro. */
export function castMonsoon(ctx: CastContext): void {
  const spell = ctx.rules.spells.monsoon;
  const pos = pointAhead(ctx, spell.range);
  const payload = payloadFor(ctx, spell.damage);
  field(ctx, 'monsoon', pos, spell.radius, spell.durationTicks, payload, [], spell.intervalTicks);
}

/** Humo de hoguera: una columna de humo que nadie atraviesa con la vista. */
export function castBonfireSmoke(ctx: CastContext): void {
  const spell = ctx.rules.spells.bonfireSmoke;
  field(ctx, 'smoke', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks);
}

/** Hoguera: una fogata donde tú y tus aliados descansan los elementos más rápido. */
export function castBonfire(ctx: CastContext): void {
  const spell = ctx.rules.spells.bonfire;
  // Una fogata por mago: la nueva apaga la anterior.
  for (const s of ctx.state.spells) {
    if (s.kind === 'field' && s.mode === 'bonfire' && s.ownerId === ctx.caster.id) s.ticksLeft = 0;
  }
  field(ctx, 'bonfire', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks);
}

/** Pista de hielo: un camino recto donde todo el que entra se desliza sin poder girar. */
export function castIceTrack(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.iceTrack;
  const limit = rules.arenaRadius - 1;
  const from = clampToCircle(add(caster.pos, scale(ctx.aim, rules.wizard.radius * 3)), limit);
  const to = clampToCircle(add(from, scale(ctx.aim, spell.length)), limit);
  const mid = scale(add(from, to), 0.5);
  field(ctx, 'iceTrack', mid, spell.halfWidth, spell.durationTicks, payloadFor(ctx, 0), [from, to]);
}

/** Diluvio: una lluvia pesada donde nadie puede saltar ni teletransportarse. */
export function castDeluge(ctx: CastContext): void {
  const spell = ctx.rules.spells.deluge;
  field(ctx, 'deluge', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks);
}

/** Hongo gigante: tapa la vista y el paso; al golpearlo suelta esporas que frenan. */
export function castGiantMushroom(ctx: CastContext): void {
  const { rules } = ctx;
  const spell = rules.spells.giantMushroom;
  const pos = placeInArena(pointAhead(ctx, spell.range), spell.radius, rules);
  const created: Summon = summon(ctx, 'mushroom', spell, pos, payloadFor(ctx, 0));
  // El hongo recuerda su vida para notar cuándo lo golpean.
  created.cooldown = created.hp;
  ctx.state.events.push({ type: 'burst', spell: 'giantMushroom', pos, radius: spell.radius });
}

// Detonadores.

/** Granada solar: una esfera en el suelo que explota cuando un hechizo tuyo la toca. */
export function castSolarGrenade(ctx: CastContext): void {
  const spell = ctx.rules.spells.solarGrenade;
  const payload = payloadFor(ctx, spell.damage, ['burn'], spell.blastRadius);
  field(ctx, 'solarOrb', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks, payload);
}

/** Polen: una nube que explota si la toca cualquier hechizo con Brasa. */
export function castPollen(ctx: CastContext): void {
  const spell = ctx.rules.spells.pollen;
  const payload = payloadFor(ctx, spell.damage, ['burn']);
  field(ctx, 'pollen', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks, payload);
}

/** Red eléctrica: activa a la vez tus trampas, esferas, plantas e invocaciones cercanas. */
export function castPowerGrid(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.powerGrid;
  const zap = payloadFor(ctx, spell.damage);
  let triggered = 0;
  const near = (pos: Vec2): boolean => distance(pos, caster.pos) <= spell.radius;
  for (const s of state.spells) {
    if (s.ownerId !== caster.id) continue;
    if (s.kind === 'trap' && !s.friendly && near(s.pos)) {
      hitArea(state, caster.id, caster.team, s.pos, s.radius + 1, s.payload, 'powerGrid', rules);
      s.ticksLeft = 0;
      s.armTicks = 0;
      triggered++;
    } else if (s.kind === 'field' && s.ticksLeft > 0 && near(s.pos)) {
      if (s.mode === 'solarOrb') {
        detonateOrb(state, s, rules);
        triggered++;
      } else if (s.mode === 'mandrake') {
        s.cooldown = 0;
        triggered++;
      }
    } else if (s.kind === 'summon' && s.hp > 0 && near(s.pos)) {
      const prey = state.wizards
        .filter((w) => w.team !== caster.team && w.hp > 0)
        .filter((w) => distance(w.pos, s.pos) <= spell.reach)
        .sort((a, b) => distance(a.pos, s.pos) - distance(b.pos, s.pos))[0];
      if (!prey) continue;
      state.events.push({ type: 'zap', from: s.pos, to: prey.pos });
      applyHit(state, prey, caster.id, zap, rules);
      triggered++;
    }
  }
  if (triggered === 0) {
    fizzle(ctx);
    return;
  }
  state.events.push({ type: 'burst', spell: 'powerGrid', pos: caster.pos, radius: spell.radius });
}

/** Mandrágora: una planta escondida que grita al pisarla: silencia y revela. */
export function castMandrake(ctx: CastContext): void {
  const spell = ctx.rules.spells.mandrake;
  const pos = pointAhead(ctx, spell.range);
  field(
    ctx,
    'mandrake',
    pos,
    spell.radius,
    spell.durationTicks,
    payloadFor(ctx, 0),
    [],
    spell.armTicks,
  );
}

// Anti.

/** Escaldar: un cono de vapor que rompe los escudos y no deja tener otros por un rato. */
export function castScald(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.scald;
  const payload = payloadFor(ctx, spell.damage);
  const victims = rivalsInCone(ctx, spell.range, spell.coneDot);
  const ids = new Set(victims.map((v) => v.id));
  // La Burbuja y la Obsidiana se deshacen sin estallar.
  state.spells = state.spells.filter(
    (s) =>
      !(
        (s.kind === 'bubble' && ids.has(s.targetId)) ||
        (s.kind === 'obsidian' && ids.has(s.ownerId))
      ),
  );
  for (const victim of victims) {
    victim.shield = 0;
    applyHit(state, victim, caster.id, payload, rules);
    applyStatus(state, victim, 'scalded', caster.id, rules);
  }
  const pos = add(caster.pos, scale(ctx.aim, spell.range * 0.5));
  state.events.push({ type: 'burst', spell: 'scald', pos, radius: spell.range * 0.5 });
}

/** Vendaval: una ráfaga en cono que apaga invocaciones, trampas y zonas rivales. */
export function castGale(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.gale;
  const inCone = (pos: Vec2, reach: number): boolean => {
    const offset = sub(pos, caster.pos);
    const d = length(offset);
    if (d > spell.range + reach) return false;
    return d < reach + 1 || dot(normalize(offset), ctx.aim) >= spell.coneDot;
  };
  state.spells = state.spells.filter((s) => {
    if (s.team === caster.team || s.ownerId === caster.id) return true;
    let gone = false;
    if (s.kind === 'summon') {
      if (inCone(s.pos, s.radius)) {
        s.hp = 0;
        state.events.push({ type: 'summonGone', summon: s.summon, pos: s.pos });
      }
      return true;
    }
    if (s.kind === 'trap' || s.kind === 'zone' || s.kind === 'thornRing' || s.kind === 'field') {
      gone = inCone(s.pos, s.radius);
      if (gone) state.events.push({ type: 'blocked', pos: s.pos });
    } else if (s.kind === 'current') {
      gone = inCone(add(s.origin, scale(s.dir, s.length * 0.5)), s.length * 0.5);
    }
    return !gone;
  });
  const pos = add(caster.pos, scale(ctx.aim, spell.range * 0.5));
  state.events.push({ type: 'burst', spell: 'gale', pos, radius: spell.range * 0.5 });
}

/** Sequía: secas el agua cercana (de quien sea) y te curas por cada cosa que secas. */
export function castDrought(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.drought;
  const near = (pos: Vec2): boolean => distance(pos, caster.pos) <= spell.radius;
  const WATER = new Set(['spring', 'healingRain', 'hotSpring', 'mist', 'blizzard']);
  let dried = 0;
  state.spells = state.spells.filter((s) => {
    let dry = false;
    if (s.kind === 'wall') dry = !s.solid && near(s.center);
    else if (s.kind === 'zone') dry = WATER.has(s.effect) && near(s.pos);
    else if (s.kind === 'current') dry = near(s.origin);
    else if (s.kind === 'field')
      dry = (s.mode === 'deluge' || s.mode === 'iceTrack') && near(s.pos);
    else if (s.kind === 'bubble') {
      const target = state.wizards.find((w) => w.id === s.targetId);
      dry = target !== undefined && near(target.pos);
      if (dry && target) target.shield = 0;
    }
    if (dry) {
      dried++;
      state.events.push({ type: 'blocked', pos: s.kind === 'wall' ? s.center : caster.pos });
    }
    return !dry;
  });
  for (const wizard of state.wizards) {
    if (wizard.hp > 0 && near(wizard.pos) && wizard.statuses.soaked) {
      delete wizard.statuses.soaked;
      dried++;
    }
  }
  state.events.push({ type: 'burst', spell: 'drought', pos: caster.pos, radius: spell.radius });
  if (dried === 0) {
    fizzle(ctx);
    return;
  }
  healWizard(state, caster, dried * spell.healPerItem);
}

/** Marchitar: una zona donde los rivales no descansan sus elementos. */
export function castWither(ctx: CastContext): void {
  const spell = ctx.rules.spells.wither;
  field(ctx, 'wither', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks);
}

// Apoyo.

/** Tirolesa: un cable desde tus pies por el que tu equipo viaja rápido; tú partes en el acto. */
export function castZipline(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.zipline;
  const from = caster.pos;
  const to = clampToCircle(add(from, scale(ctx.aim, spell.length)), rules.arenaRadius - 1);
  const mid = scale(add(from, to), 0.5);
  // Quien lo tiende sale por el cable en el acto: está parado en su punta.
  field(ctx, 'zipline', mid, spell.grab, spell.durationTicks, payloadFor(ctx, 0), [from, to]);
}

/** Crecimiento acelerado: a tus pies, tu equipo y tus invocaciones actúan más rápido. */
export function castAcceleratedGrowth(ctx: CastContext): void {
  const spell = ctx.rules.spells.acceleratedGrowth;
  field(ctx, 'growth', pointAhead(ctx, spell.range), spell.radius, spell.durationTicks);
}

/** Fertilizar: tus invocaciones cercanas ganan vida y pegan más por un rato. */
export function castFertilize(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.fertilize;
  const mine = state.spells.filter(
    (s): s is Summon =>
      s.kind === 'summon' &&
      s.ownerId === caster.id &&
      s.hp > 0 &&
      s.summon !== 'voodooDoll' &&
      distance(s.pos, caster.pos) <= spell.radius,
  );
  if (mine.length === 0) {
    fizzle(ctx);
    return;
  }
  const summons = mine.map((s) => ({ id: s.id, damage: s.payload.damage }));
  for (const s of mine) {
    s.hp *= spell.multiplier;
    s.payload = { ...s.payload, damage: s.payload.damage * spell.multiplier };
    state.events.push({ type: 'burst', spell: 'fertilize', pos: s.pos, radius: s.radius + 0.5 });
  }
  state.spells.push({
    kind: 'boon',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    ticksLeft: spell.durationTicks,
    summons,
  });
}

// Movilidad.

/** Nenúfares: cuatro hojas en rombo; quien de tu equipo pisa una salta a otra. */
export function castLilyPads(ctx: CastContext): void {
  const { caster, rules } = ctx;
  const spell = rules.spells.lilyPads;
  const forward = ctx.aim;
  const side = { x: -forward.z, z: forward.x };
  const center = add(caster.pos, scale(forward, spell.spread));
  const limit = rules.arenaRadius - 1;
  const pads = [
    caster.pos,
    add(center, scale(side, spell.spread)),
    add(center, scale(forward, spell.spread)),
    add(center, scale(side, -spell.spread)),
  ]
    .slice(0, spell.count)
    .map((p) => clampToCircle(p, limit));
  const created = field(
    ctx,
    'lilyPads',
    center,
    spell.radius,
    spell.durationTicks,
    payloadFor(ctx, 0),
    pads,
  );
  // La hoja a tus pies no te lanza hasta que te bajes de ella.
  created.inside.push(caster.id);
}

/** Sombra lanzada: tu sombra vuela lejos; tocando ✦ sin tejer, apareces en ella. */
export function castThrownShadow(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.thrownShadow;
  for (const s of state.spells) {
    if (s.kind === 'field' && s.mode === 'shadowMark' && s.ownerId === caster.id) s.ticksLeft = 0;
  }
  const to = placedAt(ctx, spell.distance);
  const pos = placeInArena(to, rules.wizard.radius, rules);
  field(ctx, 'shadowMark', pos, rules.wizard.radius, spell.durationTicks);
  state.events.push({ type: 'zap', from: caster.pos, to: pos });
}

/** Mil pasos: intocable por un instante, saltas golpeando a los rivales cercanos. */
export function castThousandSteps(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.thousandSteps;
  applyStatus(state, caster, 'untouchable', caster.id, rules);
  state.spells.push({
    kind: 'stepper',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    hopsLeft: spell.hops,
    ticksToNext: 1,
    struck: [],
    payload: payloadFor(ctx, spell.damage),
  });
}

/** Relámpago guiado: un rayo que diriges con el pulgar de moverte mientras te quedas quieto. */
export function castGuidedBolt(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.guidedBolt;
  state.spells.push({
    kind: 'guidedBolt',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    pos: add(caster.pos, scale(ctx.aim, rules.wizard.radius + spell.radius)),
    dir: ctx.aim,
    ticksLeft: spell.durationTicks,
    payload: payloadFor(ctx, spell.damage),
  });
  applyStatus(state, caster, 'steering', caster.id, rules, spell.durationTicks);
}

/** Círculo de tótems: tres tótems unidos por rayos; quien cruza una línea queda aturdido. */
export function castTotemCircle(ctx: CastContext): void {
  const spell = ctx.rules.spells.totemCircle;
  const center = pointAhead(ctx, spell.range);
  const limit = ctx.rules.arenaRadius - 1;
  const base = Math.atan2(ctx.aim.z, ctx.aim.x);
  const points = [0, 1, 2].map((i) => {
    const angle = base + (i * Math.PI * 2) / 3;
    return clampToCircle(
      add(center, { x: Math.cos(angle) * spell.spread, z: Math.sin(angle) * spell.spread }),
      limit,
    );
  });
  field(ctx, 'totems', center, spell.halfWidth, spell.durationTicks, payloadFor(ctx, 0), points);
}
