import { placeInArena } from '../../match/obstacles';
import { clampToCircle, distance, dot, normalize, sub } from '../../math/vec2';
import { launch } from './brasa';
import { type CastContext, nextId, payloadFor, placeStrike } from './context';
import { groundPoint } from './shared';

/** Meteoro: tras un aviso largo cae del cielo; pega muy fuerte y el cráter queda ardiendo. */
export function castMeteor(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.meteor;
  const pos = clampToCircle(
    groundPoint(state, caster, ctx.aim, spell.range, rules, ctx.reach),
    rules.arenaRadius,
  );
  placeStrike(ctx, pos, spell, 'scorch', payloadFor(ctx, spell.damage, ['burn']));
}

/** Lluvia de fuego: por un rato, cae fuego sobre cada rival cercano que se mueva. */
export function castFireRain(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.fireRain;
  // Una sola lluvia por mago: la nueva reemplaza a la anterior.
  state.spells = state.spells.filter((s) => !(s.kind === 'fireRain' && s.ownerId === caster.id));
  state.spells.push({
    kind: 'fireRain',
    id: nextId(state),
    ownerId: caster.id,
    team: caster.team,
    ticksLeft: spell.durationTicks,
    // La primera andanada cae enseguida.
    cooldown: 1,
    payload: payloadFor(ctx, spell.damage),
  });
}

/** Llama negra: un proyectil que atraviesa muros, escudos, invocaciones y árboles. */
export function castBlackFlame(ctx: CastContext): void {
  const spell = ctx.rules.spells.blackFlame;
  launch(ctx, spell, { ...payloadFor(ctx, spell.damage), pierce: true }, 'pierce');
}

/** Paso de ascuas: apareces en el suelo ardiendo más cercano a donde apuntas. */
export function castEmberStride(ctx: CastContext): void {
  const { state, caster, rules } = ctx;
  const spell = rules.spells.emberStride;
  let best: { pos: { x: number; z: number }; score: number } | null = null;
  for (const zone of state.spells) {
    if (zone.kind !== 'zone' || zone.effect !== 'burn') continue;
    const d = distance(zone.pos, caster.pos);
    if (d > spell.range || d < 1) continue;
    // Gana la brasa más alineada con la puntería; a igual dirección, la más lejana.
    const score = dot(normalize(sub(zone.pos, caster.pos)), ctx.aim) + d / 1000;
    if (!best || score > best.score) best = { pos: zone.pos, score };
  }
  if (!best) {
    state.events.push({ type: 'fizzle', wizardId: caster.id });
    return;
  }
  const from = caster.pos;
  caster.pos = placeInArena(best.pos, rules.wizard.radius, rules);
  caster.leap = null;
  state.events.push({
    type: 'blink',
    spell: 'emberStride',
    wizardId: caster.id,
    from,
    to: caster.pos,
  });
}

/** Cometa negro: si el proyectil acierta, te lleva junto al rival y lo silencia. */
export function castDarkComet(ctx: CastContext): void {
  const spell = ctx.rules.spells.darkComet;
  launch(ctx, spell, payloadFor(ctx, spell.damage, ['silenced']), 'pull');
}
