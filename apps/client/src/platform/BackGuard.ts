/**
 * El botón o gesto "atrás" del celular. En Android (y deslizando desde el borde en iPhone)
 * "atrás" sacaba de la página en plena partida. Mientras juegas o esperas en una sala hay una
 * entrada de más en el historial: "atrás" la gasta, avisa (para abrir la Pausa) y la repone.
 * Para salir de verdad está el menú.
 */
export class BackGuard {
  private armed = false;

  constructor(
    /** Si hay algo que proteger (una partida o una sala). */
    private readonly active: () => boolean,
    /** Qué hacer cuando se pidió "atrás" con algo que proteger. */
    onBack: () => void,
  ) {
    window.addEventListener('popstate', () => {
      if (!this.armed) return;
      this.armed = false;
      if (!this.active()) return;
      onBack();
      this.arm();
    });
  }

  /** Pone la entrada de más (si no estaba). */
  arm(): void {
    if (this.armed) return;
    history.pushState({ crisol: 'juego' }, '');
    this.armed = true;
  }
}
