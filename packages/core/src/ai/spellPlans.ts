import type { ElementId } from '../elements';
import type { Wizard } from '../match/state';
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
  readonly self: Readonly<Wizard>;
  readonly target: Readonly<Wizard>;
  /** Elementos sin cansancio. */
  readonly available: readonly ElementId[];
  /** Si viene un proyectil rival hacia él. */
  readonly threatened: boolean;
}

/**
 * Los hechizos propios que tienen sentido ahora, con un peso cada uno: el bot se cura si está mal,
 * escapa si lo encimaron, castiga a un rival que no se puede mover y pelea según la distancia.
 */
export function spellOptions(s: Situation): Option[] {
  const { self, target, available, threatened } = s;
  const d = distance(self.pos, target.pos);
  const health = self.hp / self.maxHp;
  const helpless = Boolean(target.statuses.airborne || target.statuses.root);
  const options: Option[] = [];
  const add = (elements: ElementId[], aimMode: AimMode, weight: number): void => {
    if (weight > 0 && elements.every((e) => available.includes(e))) {
      options.push({ elements, aimMode, weight });
    }
  };

  // Defensa.
  add(['marea', 'umbra'], 'target', health < 0.35 && d < 7 ? 6 : 0);
  add(['raiz'], 'target', health < 0.6 && d > 8 ? 3 : 0);
  add(['umbra', 'brasa'], 'target', health < 0.6 && d < 6.5 ? 3 : 0);
  add(['raiz', 'raiz'], 'target', threatened ? 3 : 0);
  add(['umbra', 'umbra'], 'target', health < 0.5 && d > 7 ? 1.5 : 0);

  // Escapar si lo encimaron.
  if (d < 3.5) {
    add(['tormenta', 'tormenta'], 'away', 3);
    add(['marea'], 'target', 3);
    add(['tormenta'], 'away', 2);
    add(['umbra'], 'target', 1);
  }

  // Castigar a quien no se puede mover.
  add(['brasa', 'brasa'], 'target', helpless && d < 12 ? 6 : 0);

  // Pelear según la distancia.
  if (d >= 3.5 && d <= 9) {
    add(['marea', 'brasa'], 'target', 2.5);
    add(['tormenta', 'brasa'], 'target', 2);
    add(['raiz', 'brasa'], 'target', 2);
    add(['brasa', 'brasa'], 'lead', 1.5);
    add(['umbra'], 'target', d <= 6 ? 1.5 : 0);
    add(['umbra', 'brasa'], 'target', d <= 6.5 ? 1 : 0);
    add(['brasa'], 'lead', 1);
  }
  if (d > 9) {
    add(['brasa'], 'lead', 3);
    add(['brasa', 'tormenta'], 'target', health > 0.6 && d < 14 ? 1.5 : 0);
    add(['brasa', 'brasa'], 'lead', d < 14 ? 1 : 0);
    add(['umbra', 'umbra'], 'target', 0.5);
  }
  return options;
}
