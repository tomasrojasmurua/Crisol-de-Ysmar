import { type GameEvent, TICK_RATE } from '@crisol/core';

/**
 * Cuenta, en tu celular, los momentos que hacen al Crisol distinto: choques de tejidos,
 * reacciones, combos, hechizos distintos y descubrimientos, más cuánto duró cada ronda. Va en el
 * informe de la partida en red, para saber con datos si el tejido se está jugando de verdad.
 */
export class MatchMoments {
  private clashes = 0;
  private reactions = 0;
  private combos = 0;
  private discoveries = 0;
  private knockouts = 0;
  private readonly spells = new Set<string>();
  private readonly roundSeconds: number[] = [];

  reset(): void {
    this.clashes = 0;
    this.reactions = 0;
    this.combos = 0;
    this.discoveries = 0;
    this.knockouts = 0;
    this.spells.clear();
    this.roundSeconds.length = 0;
  }

  onStep(events: readonly GameEvent[], playerId: number): void {
    const lastHit = new Map<number, number>();
    for (const event of events) {
      if (event.type === 'clash') this.clashes++;
      else if (event.type === 'combo' && event.sourceId === playerId) this.reactions++;
      else if (event.type === 'release' && event.wizardId === playerId)
        this.spells.add(event.spell);
      else if (event.type === 'hit') lastHit.set(event.targetId, event.sourceId);
      else if (event.type === 'defeated' && lastHit.get(event.wizardId) === playerId)
        this.knockouts++;
    }
  }

  discovered(): void {
    this.discoveries++;
  }

  combo(): void {
    this.combos++;
  }

  /** Terminó una ronda que duró estos pasos. */
  roundEnded(ticks: number): void {
    this.roundSeconds.push(Math.round(ticks / TICK_RATE));
  }

  /** Las líneas para el informe. */
  report(): string[] {
    const rounds = this.roundSeconds.length > 0 ? this.roundSeconds.join(' / ') : '?';
    return [
      `Momentos: ${this.clashes} choques · ${this.reactions} reacciones tuyas · ${this.combos} combos · ${this.knockouts} derribos tuyos`,
      `Tejido: ${this.spells.size} hechizos distintos · ${this.discoveries} descubiertos`,
      `Rondas (s): ${rounds}`,
    ];
  }
}
