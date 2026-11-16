import type { Wizard } from '@crisol/core';
import { el } from './dom';

/** Lo que se ve el borde con un golpe mínimo, y cuánto daño lo enciende entero. */
const MIN_STRENGTH = 0.35;
const FULL_DAMAGE = 40;
/** Cuánto tarda en apagarse (por segundo). */
const FADE_PER_SECOND = 2.2;

/**
 * Golpe recibido visto por quien lo sufre: los bordes de la pantalla se tiñen de rojo un
 * instante, más fuerte cuanto más daño. Es una capa de la interfaz que solo existe mientras se
 * ve (oculta no le cuesta nada al celular) y no depende de la calidad gráfica.
 */
export class HurtEdge {
  private readonly root: HTMLElement;
  private strength = 0;
  private lastHp = -1;
  private lastId = -1;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hurt-edge');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      opacity: '0',
      background:
        'radial-gradient(ellipse at 50% 50%, transparent 0 52%, rgba(160, 20, 30, 0.45) 76%, rgba(130, 8, 20, 0.85) 100%)',
    });
    this.root.hidden = true;
    parent.prepend(this.root);
  }

  update(player: Wizard, deltaSeconds: number): void {
    // Otro mago (miras a alguien tras caer) o recién revivido: no cuenta como golpe.
    const drop = player.id === this.lastId && this.lastHp >= 0 ? this.lastHp - player.hp : 0;
    this.lastHp = player.hp;
    this.lastId = player.id;
    // El goteo (quemadura, zonas) no enciende el borde: solo los golpes de verdad.
    if (drop >= 3) {
      this.strength = Math.max(
        this.strength,
        MIN_STRENGTH + (1 - MIN_STRENGTH) * Math.min(1, drop / FULL_DAMAGE),
      );
    }
    if (this.strength === 0) return;
    this.strength = Math.max(0, this.strength - deltaSeconds * FADE_PER_SECOND);
    this.root.style.opacity = this.strength.toFixed(3);
    this.root.hidden = this.strength === 0;
  }

  /** Fuera de la partida no queda nada rojo. */
  reset(): void {
    this.strength = 0;
    this.lastHp = -1;
    this.lastId = -1;
    this.root.style.opacity = '0';
    this.root.hidden = true;
  }
}
