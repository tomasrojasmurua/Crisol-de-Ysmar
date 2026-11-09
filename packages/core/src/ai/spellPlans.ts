import type { ElementId } from '../elements';
import type { MatchState, SummonKind, Wizard } from '../match/state';
import { distance } from '../math/vec2';

export type AimMode = 'lead' | 'target' | 'away';

export interface Plan {
  readonly elements: ElementId[];
  readonly aimMode: AimMode;
}

interface Option extends Plan {
  readonly weight: number;
}

/** Lo que el bot mira para elegir un hechizo. */
export interface Situation {
  readonly state: Readonly<MatchState>;
  readonly self: Readonly<Wizard>;
  readonly target: Readonly<Wizard>;
  /** Elementos sin cansancio. */
  readonly available: readonly ElementId[];
  /** Si viene un proyectil rival hacia él. */
  readonly threatened: boolean;
}

/**
 * Los hechizos que tienen sentido ahora, con un peso cada uno: el bot se cura o se protege si
 * está mal, escapa si lo encimaron, castiga a un rival que no se puede mover, corta un conjuro
 * grande que le están preparando y pelea según la distancia.
 */
export function spellOptions(s: Situation): Option[] {
  const { state, self, target, available, threatened } = s;
  const d = distance(self.pos, target.pos);
  const health = self.hp / self.maxHp;
  const t = target.statuses;
  const helpless = Boolean(t.airborne || t.root || t.frozen || t.asleep);
  const owns = (kind: SummonKind): boolean =>
    state.spells.some((e) => e.kind === 'summon' && e.summon === kind && e.ownerId === self.id);
  const options: Option[] = [];
  const add = (elements: ElementId[], aimMode: AimMode, weight: number): void => {
    if (weight > 0 && elements.every((e) => available.includes(e))) {
      options.push({ elements, aimMode, weight });
    }
  };

  // Defensa.
  add(['marea', 'umbra'], 'target', health < 0.35 && d < 7 ? 6 : 0);
  add(['raiz'], 'target', health < 0.6 && d > 8 ? 3 : 0);
  add(['marea', 'raiz'], 'target', health < 0.55 && d > 6 ? 2.5 : 0);
  add(['umbra', 'brasa'], 'target', health < 0.6 && d < 6.5 ? 3 : 0);
  add(['raiz', 'raiz'], 'target', threatened ? 2 : 0);
  add(['marea', 'marea'], 'target', threatened ? 2.5 : 0);
  add(['brasa', 'marea'], 'target', d < 5 && self.shield === 0 ? 2.5 : 0);
  add(['umbra', 'umbra'], 'target', health < 0.5 && d > 7 ? 1.5 : 0);
  add(['umbra', 'tormenta'], 'away', health < 0.4 && d < 8 ? 2 : 0);

  // Escapar si lo encimaron.
  if (d < 3.5) {
    add(['tormenta', 'tormenta'], 'away', 3);
    add(['marea'], 'target', 3);
    add(['tormenta'], 'away', 2);
    add(['umbra'], 'target', 1);
    add(['marea', 'tormenta'], 'away', 1.5);
  }

  // Castigar a quien no se puede mover, y cortar un Gran hechizo que le están preparando.
  add(['brasa', 'brasa'], 'target', helpless && d < 12 ? 6 : 0);
  const bigCast = target.weave.length >= 2 || (target.channel?.weave.length ?? 0) >= 3;
  add(['tormenta', 'umbra'], 'target', bigCast && d <= 6 ? 5 : 0);

  // Pelear según la distancia.
  if (d >= 3.5 && d <= 9) {
    add(['marea', 'brasa'], 'target', 2.5);
    add(['tormenta', 'brasa'], 'target', 2);
    add(['raiz', 'brasa'], 'target', 2);
    add(['brasa', 'brasa'], 'lead', 1.5);
    add(['umbra'], 'target', d <= 6 ? 1.5 : 0);
    add(['umbra', 'brasa'], 'target', d <= 6.5 ? 1 : 0);
    add(['brasa'], 'lead', 1);
    add(['brasa', 'raiz'], 'target', owns('wisp') ? 0 : 1.5);
    add(['tormenta', 'raiz'], 'target', owns('lightningRod') ? 0 : 1.2);
    add(['raiz', 'marea'], 'target', owns('mossGuardian') || d > 8 ? 0 : 1.2);
    add(['raiz', 'umbra'], 'target', d <= 6 ? 1.5 : 0);
    add(['tormenta', 'marea'], 'target', 1);
    add(['tormenta', 'umbra'], 'target', d <= 6 ? 1 : 0);
    add(['umbra', 'raiz'], 'target', d <= 8 ? 1.5 : 0);
    add(['umbra', 'marea'], 'lead', target.statuses.blind ? 0 : 1.5);
    add(['brasa', 'umbra'], 'target', 1.2);
    add(['raiz', 'tormenta'], 'target', d > 6 && health > 0.6 ? 1 : 0);
  }
  if (d > 9) {
    add(['brasa'], 'lead', 3);
    add(['brasa', 'tormenta'], 'target', health > 0.6 && d < 14 ? 1.5 : 0);
    add(['brasa', 'brasa'], 'lead', d < 14 ? 1 : 0);
    add(['umbra', 'umbra'], 'target', 0.5);
    add(['brasa', 'raiz'], 'target', owns('wisp') ? 0 : 1.5);
    add(['umbra', 'marea'], 'lead', d < 12 && !target.statuses.blind ? 1 : 0);
    add(['marea', 'tormenta'], 'target', health > 0.6 ? 1 : 0);
  }
  greatOptions(s, add, d, health, helpless, bigCast);
  return options;
}

/**
 * Los Grandes hechizos: tardan más y cansan tres elementos, así que el bot los guarda
 * para cuando cuadran (rematar a quien no se mueve, cortar un conjuro, escapar de cerca).
 */
function greatOptions(
  s: Situation,
  add: (elements: ElementId[], aimMode: AimMode, weight: number) => void,
  d: number,
  health: number,
  helpless: boolean,
  bigCast: boolean,
): void {
  const { state, self, target, threatened } = s;
  const targetHealth = target.hp / target.maxHp;
  const near = d < 4;
  const mid = d >= 4 && d <= 10;
  const ownsEmbers = state.spells.some(
    (e) =>
      e.kind === 'zone' &&
      e.effect === 'burn' &&
      e.ownerId === self.id &&
      distance(e.pos, self.pos) <= 15 &&
      distance(e.pos, target.pos) > 6,
  );

  // Rematar a quien no se puede mover.
  add(['brasa', 'brasa', 'brasa'], 'target', helpless && d < 13 ? 5 : mid ? 0.5 : 0);
  add(['tormenta', 'tormenta', 'brasa'], 'target', helpless && d < 13 ? 5 : mid ? 0.8 : 0);
  add(['marea', 'brasa', 'brasa'], 'target', helpless && d < 8 ? 4 : 0);
  add(['umbra', 'umbra', 'brasa'], 'target', d < 12 ? (targetHealth < 0.5 ? 3 : 0.5) : 0);

  // Control.
  add(['marea', 'marea', 'marea'], 'target', d < 5 ? 2.5 : 0);
  add(['umbra', 'umbra', 'marea'], 'target', d < 8 ? (health < 0.4 ? 2.5 : 1) : 0);
  add(['umbra', 'tormenta', 'marea'], 'target', d < 10 ? (bigCast ? 3 : 0.6) : 0);
  add(['marea', 'umbra', 'brasa'], 'target', d < 6 ? (bigCast ? 2 : 0.8) : 0);
  add(['tormenta', 'tormenta', 'marea'], 'target', d >= 3 && d < 10 ? 1 : 0);
  add(['marea', 'marea', 'tormenta'], 'target', d >= 4 && d < 14 ? 0.8 : 0);
  add(['raiz', 'raiz', 'brasa'], 'target', mid ? 0.8 : 0);
  add(['raiz', 'tormenta', 'marea'], 'target', mid ? 0.6 : 0);

  // Daño a distancia.
  add(['brasa', 'umbra', 'marea'], 'lead', d >= 4 && d < 14 ? (self.shield > 0 ? 1 : 0.8) : 0);
  add(['brasa', 'umbra', 'marea'], 'lead', target.shield > 0 && d < 14 ? 3 : 0);
  add(['brasa', 'brasa', 'tormenta'], 'target', d < 9 ? 0.8 : 0);
  add(['tormenta', 'brasa', 'marea'], 'target', d >= 3 && d < 9 ? 0.8 : 0);

  // Entrar a la pelea.
  add(['brasa', 'tormenta', 'umbra'], 'lead', d >= 6 && d < 12 ? (bigCast ? 2 : 0.6) : 0);
  add(['raiz', 'tormenta', 'brasa'], 'target', d >= 10 && d < 13 && health > 0.5 ? 1 : 0);
  add(['tormenta', 'umbra', 'tormenta'], 'target', d >= 6 && d < 12 ? 0.3 : 0);

  // Escapar o protegerse.
  add(['marea', 'brasa', 'tormenta'], 'target', near ? 2.5 : 0);
  add(['tormenta', 'tormenta', 'tormenta'], 'away', near && health < 0.6 ? 1.5 : 0);
  add(['brasa', 'umbra', 'tormenta'], 'away', near && ownsEmbers ? 2.5 : 0);
  add(['umbra', 'brasa', 'tormenta'], 'away', near && health < 0.35 ? 1.2 : 0);
  add(['umbra', 'tormenta', 'tormenta'], 'away', near && health < 0.4 ? 1 : 0);
  add(['marea', 'raiz', 'brasa'], 'target', threatened ? 2 : 0);

  // Segunda tanda: invocaciones.
  const t = target.statuses;
  const owns = (kind: string): boolean =>
    state.spells.some((e) => e.kind === 'summon' && e.summon === kind && e.ownerId === self.id);
  add(['brasa', 'brasa', 'raiz'], 'target', d >= 3 && d < 11 ? 0.8 : 0);
  add(['brasa', 'raiz', 'tormenta'], 'target', !owns('wanderingSpark') && d < 8 ? 0.8 : 0);
  add(['brasa', 'raiz', 'umbra'], 'target', !owns('magmaGolem') && d < 9 ? 0.8 : 0);
  add(['marea', 'raiz', 'raiz'], 'target', !owns('glacier') && d >= 4 && d < 12 ? 0.7 : 0);
  add(['raiz', 'tormenta', 'tormenta'], 'target', !owns('swarm') && d >= 4 && d < 12 ? 0.8 : 0);
  add(['raiz', 'raiz', 'tormenta'], 'target', d >= 3 && d < 12 ? 0.7 : 0);
  add(['raiz', 'raiz', 'raiz'], 'target', !owns('ancientTree') && d < 7 ? 0.8 : 0);
  add(['umbra', 'umbra', 'tormenta'], 'target', !owns('shadowTwin') && d < 14 ? 0.8 : 0);
  add(['raiz', 'umbra', 'brasa'], 'target', !owns('carnivore') && near ? 1.2 : 0);

  // Apoyo: los de aliados solo con aliados cerca.
  const allies = state.wizards.filter(
    (w) => w.team === self.team && w.id !== self.id && distance(w.pos, self.pos) < 9,
  );
  const hurtAlly = allies.some((a) => a.hp > 0 && a.hp / a.maxHp < 0.5);
  const fallenAlly = allies.some((a) => a.fallen !== null);
  add(['brasa', 'marea', 'raiz'], 'target', d >= 6 && d < 14 ? 0.5 : 0);
  add(['tormenta', 'marea', 'tormenta'], 'away', d > 12 ? 0.5 : 0);
  add(['marea', 'brasa', 'marea'], 'target', threatened && self.shield <= 0 ? 1.5 : 0);
  add(['marea', 'brasa', 'raiz'], 'target', fallenAlly ? 4 : 0);
  add(['marea', 'marea', 'raiz'], 'target', health < 0.5 || hurtAlly ? 1.5 : 0);
  add(['marea', 'umbra', 'raiz'], 'target', hurtAlly && health > 0.6 ? 2 : 0);
  add(['raiz', 'raiz', 'marea'], 'target', health < 0.6 && d > 6 ? 0.8 : 0);
  add(['umbra', 'brasa', 'raiz'], 'target', allies.length > 0 && hurtAlly ? 1.5 : 0);

  // Refuerzo.
  add(['brasa', 'brasa', 'umbra'], 'target', d < 3.5 ? 2 : 0);
  add(['tormenta', 'marea', 'raiz'], 'target', threatened || (near && health < 0.5) ? 1.5 : 0);
  const afflicted = Boolean(self.statuses.burn || self.statuses.slow || self.statuses.curse);
  add(['marea', 'raiz', 'marea'], 'target', afflicted || self.statuses.plague ? 2 : 0);
  add(['umbra', 'marea', 'tormenta'], 'target', health < 0.7 && d < 10 ? 1 : 0);

  // Estados.
  add(['brasa', 'umbra', 'brasa'], 'target', !t.combusting && d < 10 ? 0.8 : 0);
  add(['tormenta', 'umbra', 'umbra'], 'target', !t.slow && d < 9 ? 0.8 : 0);
  add(['marea', 'brasa', 'umbra'], 'lead', !t.exposed && d < 12 ? 0.8 : 0);
  add(['marea', 'marea', 'brasa'], 'target', !t.sluggish && mid ? 0.6 : 0);
  add(['umbra', 'umbra', 'umbra'], 'target', !t.blind && d > 6 ? 0.6 : 0);
  add(['umbra', 'marea', 'raiz'], 'target', !t.plague && d < 9 ? 0.8 : 0);

  // Tercera tanda: la jungla, ver, esconderse y transformarse.
  const me = self.statuses;
  const transformed = Boolean(me.magma || me.surfing || me.deepRooted || me.panther);
  add(['brasa', 'tormenta', 'raiz'], 'target', d >= 4 && d < 12 ? 0.6 : 0);
  add(['raiz', 'brasa', 'raiz'], 'target', threatened && d > 6 ? 0.8 : 0);
  const beastNear = state.beasts.some(
    (b) => !b.guardian && b.tamedBy === null && distance(b.pos, self.pos) < 8,
  );
  add(['raiz', 'brasa', 'brasa'], 'target', beastNear ? 1.5 : 0);
  add(['tormenta', 'raiz', 'umbra'], 'target', d > 16 ? 0.8 : 0);
  add(['raiz', 'tormenta', 'umbra'], 'target', !t.tracked && d >= 8 && d < 14 ? 0.5 : 0);
  add(['umbra', 'tormenta', 'raiz'], 'away', d > 14 ? 0.4 : 0);
  add(['tormenta', 'marea', 'brasa'], 'target', d > 10 ? 0.3 : 0);
  add(['brasa', 'marea', 'umbra'], 'target', near && health < 0.6 ? 1.5 : 0);
  add(['marea', 'tormenta', 'raiz'], 'target', me.tracked ? 2 : 0);
  add(['marea', 'umbra', 'tormenta'], 'target', threatened ? 1 : 0);
  add(['raiz', 'raiz', 'umbra'], 'target', mid ? 0.6 : 0);
  add(['raiz', 'umbra', 'marea'], 'target', d > 14 ? 0.3 : 0);
  add(['umbra', 'tormenta', 'umbra'], 'target', mid ? 0.4 : 0);
  add(['umbra', 'raiz', 'umbra'], 'target', d < 12 && health < 0.5 ? 1 : 0);
  add(['brasa', 'marea', 'marea'], 'target', !transformed && near ? 1 : 0);
  add(['marea', 'tormenta', 'tormenta'], 'away', !transformed && near && health < 0.5 ? 1 : 0);
  add(['raiz', 'tormenta', 'raiz'], 'target', !transformed && d >= 12 && d < 18 ? 0.8 : 0);
  add(['umbra', 'raiz', 'tormenta'], 'target', !transformed && d < 5 && health > 0.4 ? 1.2 : 0);

  fourthOptions(s, add, d, health, bigCast, allies.length > 0, hurtAlly);
}

/**
 * Cuarta tanda: terreno, detonadores, tiempo, copias y contrahechizos. Casi todos son de
 * oportunidad: cortar un conjuro, rematar, salvarse o aprovechar lo que ya tiene en el campo.
 */
function fourthOptions(
  s: Situation,
  add: (elements: ElementId[], aimMode: AimMode, weight: number) => void,
  d: number,
  health: number,
  bigCast: boolean,
  hasAllies: boolean,
  hurtAlly: boolean,
): void {
  const { state, self, target, threatened } = s;
  const targetHealth = target.hp / target.maxHp;
  const near = d < 4;
  const mid = d >= 4 && d <= 10;
  const me = self.statuses;
  const t = target.statuses;
  const helpless = Boolean(t.airborne || t.root || t.frozen || t.asleep || t.stunned);
  const mine = state.spells.filter((e) => e.ownerId === self.id);
  const ownsSummons = mine.some(
    (e) => e.kind === 'summon' && e.summon !== 'voodooDoll' && distance(e.pos, self.pos) < 8,
  );
  const ownsTriggers = mine.some(
    (e) =>
      (e.kind === 'trap' && !e.friendly) ||
      (e.kind === 'field' && (e.mode === 'solarOrb' || e.mode === 'mandrake')),
  );
  const rivalStuff = state.spells.some(
    (e) =>
      e.team !== self.team &&
      e.ownerId !== self.id &&
      (e.kind === 'summon' || e.kind === 'zone' || e.kind === 'trap' || e.kind === 'field') &&
      distance('pos' in e ? e.pos : self.pos, self.pos) < 9,
  );
  const tired = Object.values(self.fatigue).filter((f) => f > 0).length;
  const past = self.past[0];

  // Cortar, robar u olvidar el conjuro grande que le preparan.
  add(['tormenta', 'brasa', 'raiz'], 'target', bigCast && d <= 8 ? 4 : 0);
  add(['raiz', 'umbra', 'umbra'], 'target', bigCast && d < 10 ? 2.5 : 0);
  add(['marea', 'umbra', 'umbra'], 'target', bigCast && d < 6 ? 3 : 0);
  add(['tormenta', 'umbra', 'marea'], 'target', bigCast && d < 9 ? 2 : 0);
  add(['umbra', 'marea', 'brasa'], 'target', d < 6 ? (threatened ? 2 : 0.8) : 0);
  add(['tormenta', 'brasa', 'umbra'], 'target', d < 6 && target.lastWeave ? 0.8 : 0);
  add(['marea', 'tormenta', 'umbra'], 'target', target.lastWeave?.length === 3 && d < 12 ? 1.2 : 0);

  // Rematar o castigar.
  add(['umbra', 'brasa', 'brasa'], 'target', targetHealth < 0.25 && d < 10 ? 6 : 0);
  add(['brasa', 'umbra', 'raiz'], 'target', targetHealth < 0.45 && d < 10 ? 2 : 0);
  add(['brasa', 'tormenta', 'marea'], 'target', mid ? (helpless ? 2 : 0.6) : 0);
  add(['tormenta', 'raiz', 'brasa'], 'target', d >= 5 && d < 11 ? 0.8 : 0);
  add(['tormenta', 'tormenta', 'umbra'], 'target', d < 8 && health > 0.4 ? 1 : 0);
  add(['brasa', 'marea', 'tormenta'], 'target', d < 6 ? (target.shield > 0 ? 3 : 0.4) : 0);
  add(['marea', 'tormenta', 'brasa'], 'lead', d >= 4 && d < 12 ? 0.6 : 0);
  add(['umbra', 'raiz', 'brasa'], 'target', d < 10 ? 0.6 : 0);

  // Terreno y trampas.
  add(['brasa', 'brasa', 'marea'], 'target', mid ? 0.6 : 0);
  add(['brasa', 'tormenta', 'brasa'], 'target', d < 8 ? 0.3 : 0);
  add(['raiz', 'brasa', 'tormenta'], 'target', mid ? 0.4 : 0);
  add(['tormenta', 'tormenta', 'raiz'], 'target', mid ? 0.5 : 0);
  add(['raiz', 'umbra', 'raiz'], 'target', mid ? 0.5 : 0);
  add(['marea', 'tormenta', 'marea'], 'target', d < 8 ? 0.4 : 0);
  add(['umbra', 'raiz', 'raiz'], 'target', d > 6 ? 0.4 : 0);
  add(['tormenta', 'raiz', 'raiz'], 'target', ownsSummons || ownsTriggers ? 1.5 : 0);
  add(['tormenta', 'marea', 'umbra'], 'target', rivalStuff ? 2 : 0);

  // Ritmo y carga.
  add(['brasa', 'marea', 'brasa'], 'target', d > 6 && !me.forged ? 0.5 : 0);
  add(['tormenta', 'brasa', 'brasa'], 'target', mid ? 0.4 : 0);
  add(['brasa', 'umbra', 'umbra'], 'target', mid ? 0.4 : 0);
  add(['brasa', 'tormenta', 'tormenta'], 'target', d >= 4 && d < 12 && health > 0.5 ? 0.4 : 0);
  add(['raiz', 'marea', 'tormenta'], 'target', health < 0.7 ? 0.6 : 0);
  add(['brasa', 'raiz', 'raiz'], 'target', d > 10 && tired >= 2 ? 0.8 : 0);
  add(['raiz', 'marea', 'brasa'], 'target', ownsSummons ? 1.5 : 0);
  add(['tormenta', 'raiz', 'marea'], 'target', ownsSummons ? 1 : 0);
  add(['umbra', 'raiz', 'marea'], 'target', d > 10 ? 0.4 : 0);

  // Defenderse.
  add(['tormenta', 'brasa', 'tormenta'], 'target', threatened ? 2 : 0);
  add(['marea', 'marea', 'umbra'], 'target', threatened ? 2 : 0);
  add(['umbra', 'marea', 'marea'], 'target', threatened ? 1.5 : 0);
  add(['marea', 'umbra', 'marea'], 'target', threatened && health < 0.5 ? 1.5 : 0);
  add(['raiz', 'brasa', 'marea'], 'target', threatened && d > 6 ? 1 : 0);
  add(['raiz', 'brasa', 'umbra'], 'target', near ? 1.2 : 0);
  add(['brasa', 'raiz', 'brasa'], 'target', near ? 1 : 0);
  add(['brasa', 'raiz', 'marea'], 'target', health < 0.4 && d < 8 ? 1 : 0);
  add(['raiz', 'marea', 'marea'], 'target', me.soaked ? 1.5 : 0);
  add(['umbra', 'brasa', 'umbra'], 'target', health < 0.3 && d < 9 ? 1.5 : 0);
  add(['umbra', 'umbra', 'raiz'], 'target', health < 0.4 && health > 0.2 && d < 12 ? 1.5 : 0);

  // Salvarse en las últimas.
  const once = (spell: 'rebirth' | 'transfusion'): boolean => !self.spent.includes(spell);
  add(['marea', 'raiz', 'umbra'], 'target', health < 0.3 && once('rebirth') ? 3 : 0);
  add(
    ['umbra', 'marea', 'umbra'],
    'target',
    health < targetHealth - 0.3 && once('transfusion') ? 4 : 0,
  );
  add(
    ['tormenta', 'umbra', 'brasa'],
    'target',
    health < 0.35 && past && past.hp > self.hp + 25 ? 3 : 0,
  );

  // Moverse.
  add(['tormenta', 'marea', 'marea'], 'away', near && health < 0.5 ? 0.8 : 0);
  add(['tormenta', 'raiz', 'tormenta'], 'away', near && health < 0.4 ? 1 : 0);
  add(['marea', 'raiz', 'tormenta'], 'away', near && health < 0.5 ? 0.6 : 0);
  add(['umbra', 'tormenta', 'brasa'], 'away', near && health < 0.5 ? 1 : 0);

  // Control y estados.
  add(['tormenta', 'umbra', 'raiz'], 'target', d < 9 ? 0.5 : 0);
  add(['umbra', 'brasa', 'marea'], 'target', d < 10 ? 0.5 : 0);
  add(['raiz', 'marea', 'umbra'], 'target', d < 9 ? 0.6 : 0);

  // Con aliados.
  add(['raiz', 'marea', 'raiz'], 'target', hasAllies && hurtAlly ? 1.5 : 0);
}
