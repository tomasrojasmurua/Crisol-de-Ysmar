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
}
