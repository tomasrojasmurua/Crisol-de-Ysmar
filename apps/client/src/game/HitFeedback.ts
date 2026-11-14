import type { GameEvent, MatchState, StatusId } from '@crisol/core';

/** La palabra de cada estado que se nota en el rival (los que no son daño). */
export const STATUS_WORDS: Readonly<Partial<Record<StatusId, string>>> = {
  root: 'Atrapado',
  frozen: 'Congelado',
  asleep: 'Dormido',
  blind: 'Ciego',
  silenced: 'Silenciado',
  airborne: 'Por los aires',
  stunned: 'Aturdido',
  slow: 'Lento',
  weak: 'Débil',
  burn: 'Quemado',
  curse: 'Maldito',
  soaked: 'Empapado',
  exposed: 'Expuesto',
  sluggish: 'Torpe',
  halted: 'Detenido',
  plague: 'Plaga',
};

/** Lo poco que tiene que juntar el goteo (quemaduras, zonas) antes de mostrarse. */
const TRICKLE_TICKS = 10;

export interface HitShow {
  readonly damage: (amount: number, targetId: number) => void;
  readonly status: (word: string, targetId: number) => void;
}

/**
 * Lo que sirve para saber si un hechizo acertó: el daño que haces a cada rival (en números) y los
 * estados nuevos que le pones (en palabras). Los golpes se muestran al tiro; el goteo de una
 * quemadura o una zona se junta unos pasos para no llenar la pantalla de "1".
 */
export class HitFeedback {
  private readonly pending = new Map<number, { amount: number; ticks: number }>();
  private readonly seen = new Map<number, Set<string>>();

  constructor(private readonly show: HitShow) {}

  reset(): void {
    this.pending.clear();
    this.seen.clear();
  }

  onStep(events: readonly GameEvent[], state: MatchState, playerId: number): void {
    for (const event of events) {
      if (event.type !== 'hit' || event.sourceId !== playerId || event.targetId === playerId) {
        continue;
      }
      const tally = this.pending.get(event.targetId) ?? { amount: 0, ticks: 0 };
      tally.amount += event.amount;
      this.pending.set(event.targetId, tally);
      // Un golpe de verdad sale ya, sin esperar el goteo.
      if (event.amount >= 3) this.flush(event.targetId);
    }
    for (const [targetId, tally] of this.pending) {
      tally.ticks++;
      if (tally.ticks >= TRICKLE_TICKS) this.flush(targetId);
    }
    const team = state.wizards.find((w) => w.id === playerId)?.team;
    for (const wizard of state.wizards) {
      // Solo en los rivales: tus estados ya los muestra tu columna de vida.
      if (wizard.team === team) continue;
      const now = new Set(Object.keys(wizard.statuses));
      const before = this.seen.get(wizard.id);
      if (before && wizard.fallen === null) {
        for (const status of now) {
          const word = STATUS_WORDS[status as StatusId];
          if (word && !before.has(status)) this.show.status(word, wizard.id);
        }
      }
      this.seen.set(wizard.id, now);
    }
  }

  private flush(targetId: number): void {
    const tally = this.pending.get(targetId);
    this.pending.delete(targetId);
    if (tally && tally.amount >= 1) this.show.damage(tally.amount, targetId);
  }
}
