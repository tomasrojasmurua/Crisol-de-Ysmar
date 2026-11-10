/**
 * Simula una mala conexión para medir la fluidez sin salir de casa. Se activa con la dirección:
 * `?lag=150&perdida=5` agrega 150 ms de ida y vuelta (con algo de vaivén) y hace que el 5% de los
 * mensajes llegue tarde, como cuando el 4G pierde un paquete y hay que reenviarlo.
 *
 * El WebSocket nunca pierde ni desordena mensajes: un paquete perdido se ve como un mensaje que
 * llega tarde y atrasa a todos los que vienen detrás. Eso es lo que se imita.
 */

/** Lo que tarda en reenviarse un paquete perdido. */
const RESEND_MS = 220;
/** Vaivén del lag, como fracción del lag base. */
const JITTER = 0.25;

/**
 * Una fila que entrega en orden estricto. No basta con un `setTimeout` por mensaje: el navegador
 * redondea los tiempos y dos mensajes casi simultáneos pueden salir al revés, y un estado
 * aplicado fuera de orden rompe la diferencia siguiente.
 */
class OrderedQueue {
  private readonly items: { at: number; run: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  last = 0;

  push(at: number, run: () => void): void {
    this.items.push({ at, run });
    this.last = at;
    if (this.timer === null) this.arm();
  }

  private arm(): void {
    const head = this.items[0];
    if (!head) {
      this.timer = null;
      return;
    }
    this.timer = setTimeout(() => this.flush(), Math.max(0, head.at - performance.now()));
  }

  private flush(): void {
    const now = performance.now();
    while (this.items.length > 0 && (this.items[0]?.at ?? 0) <= now + 1) this.items.shift()?.run();
    this.arm();
  }
}

export class LagSimulator {
  private readonly inbox = new OrderedQueue();
  private readonly outbox = new OrderedQueue();

  constructor(
    /** Ida y vuelta agregada, en ms. */
    readonly lagMs: number,
    /** Porcentaje de mensajes que llegan tarde (0 a 100). */
    readonly lossPercent: number,
  ) {}

  /** Lee `?lag=` y `?perdida=` de la dirección; null si no se pidió simular. */
  static fromUrl(search: string): LagSimulator | null {
    const params = new URLSearchParams(search);
    const lag = Number(params.get('lag') ?? 0);
    const loss = Number(params.get('perdida') ?? 0);
    if (!(lag > 0) && !(loss > 0)) return null;
    return new LagSimulator(
      Math.max(0, Math.min(2000, lag || 0)),
      Math.max(0, Math.min(50, loss || 0)),
    );
  }

  get label(): string {
    return `simulando ${this.lagMs} ms y ${this.lossPercent}% de pérdida`;
  }

  /** Entrega algo que llegó del servidor, con la demora de media ida y vuelta. */
  incoming(deliver: () => void): void {
    this.schedule(this.inbox, deliver);
  }

  /** Manda algo al servidor, con la demora de media ida y vuelta. */
  outgoing(send: () => void): void {
    this.schedule(this.outbox, send);
  }

  private schedule(queue: OrderedQueue, run: () => void): void {
    const half = this.lagMs / 2;
    let delay = half + (Math.random() * 2 - 1) * half * JITTER;
    if (Math.random() * 100 < this.lossPercent) delay += RESEND_MS;
    // En orden: nadie se adelanta al que llegó antes.
    queue.push(Math.max(queue.last, performance.now() + delay), run);
  }
}
