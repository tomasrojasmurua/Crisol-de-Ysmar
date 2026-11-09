import type { Wizard } from '@crisol/core';
import { el } from './dom';

/**
 * La Ceguera vista por quien la sufre: la pantalla se cierra en negro alrededor
 * y solo queda un claro en el centro. Aparece y se va de a poco.
 */
export class BlindVeil {
  private readonly root: HTMLElement;
  private strength = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'blind-veil');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      opacity: '0',
      background:
        'radial-gradient(circle at 50% 58%, transparent 0 14%, rgba(8, 4, 16, 0.86) 34%, rgba(4, 2, 10, 0.97) 60%)',
    });
    parent.prepend(this.root);
  }

  update(player: Wizard, deltaSeconds: number): void {
    const blind = player.statuses.blind;
    // Se aclara en el último medio segundo.
    const target = blind ? Math.min(1, blind.ticks / 15) : 0;
    const speed = target > this.strength ? 6 : 3;
    this.strength += (target - this.strength) * Math.min(1, deltaSeconds * speed);
    if (this.strength < 0.01 && !blind) this.strength = 0;
    this.root.style.opacity = this.strength.toFixed(3);
    this.root.hidden = this.strength === 0;
  }

  /** Fuera de la partida no queda nada oscuro. */
  reset(): void {
    this.strength = 0;
    this.root.style.opacity = '0';
    this.root.hidden = true;
  }
}
