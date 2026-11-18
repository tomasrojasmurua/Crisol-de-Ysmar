/** Atrasos del reloj por milisegundo, hasta este tope (lo que pasa de aquí cuenta en el último). */
const BINS = 501;
/** Un atraso de más de esto ya vacía el colchón chico de los celulares (dos pasos). */
const LATE_MS = 50;
/** La línea de tiempo va en tramos de este largo, igual que la de los celulares. */
const BUCKET_MS = 10_000;
/** Una partida muy larga no hace crecer el informe sin fin (unos 20 minutos). */
const MAX_BUCKETS = 120;

/** Lo que la Sala manda al registro al terminar cada serie. */
export interface RoomPerfReport {
  readonly message: string;
  readonly detail: string;
}

/** Quiénes jugaron la serie. */
export interface RoomPerfPlayers {
  readonly humans: number;
  readonly bots: number;
}

/**
 * Cómo anduvo la Sala en una serie: cuánto se atrasó su reloj (pasos que tocaban y salieron
 * tarde), cuánto tardó en correr cada vuelta y, cada 10 s, el peor atraso. Junto a los informes
 * de los celulares de esa sala dice si los silencios de la red vienen de la Sala o de la red:
 * si la Sala va al día cuando los celulares ven silencios, el problema es de la conexión.
 */
export class RoomPerf {
  private startedAt: number | null = null;
  private players: RoomPerfPlayers = { humans: 0, bots: 0 };
  private readonly histogram = new Uint32Array(BINS);
  private samples = 0;
  private lateCount = 0;
  private maxLate = 0;
  private dropped = 0;
  private workTotal = 0;
  private maxWork = 0;
  private buckets: number[] = [];

  get running(): boolean {
    return this.startedAt !== null;
  }

  start(now: number, players: RoomPerfPlayers): void {
    this.startedAt = now;
    this.players = players;
    this.histogram.fill(0);
    this.samples = 0;
    this.lateCount = 0;
    this.maxLate = 0;
    this.dropped = 0;
    this.workTotal = 0;
    this.maxWork = 0;
    this.buckets = [];
  }

  /**
   * Una vuelta del reloj que corrió pasos. `lateMs`: cuánto después de lo debido salió el primer
   * paso; `workMs`: lo que tardó la vuelta entera; `dropped`: pasos que no se alcanzaron a correr.
   */
  clock(now: number, lateMs: number, workMs: number, dropped = 0): void {
    if (this.startedAt === null) return;
    const late = Math.max(0, lateMs);
    const bin = Math.min(BINS - 1, Math.round(late));
    this.histogram[bin] = (this.histogram[bin] ?? 0) + 1;
    this.samples += 1;
    if (late > LATE_MS) this.lateCount += 1;
    this.maxLate = Math.max(this.maxLate, late);
    this.dropped += dropped;
    this.workTotal += workMs;
    this.maxWork = Math.max(this.maxWork, workMs);
    const index = Math.floor((now - this.startedAt) / BUCKET_MS);
    if (index >= MAX_BUCKETS) return;
    while (this.buckets.length <= index) this.buckets.push(0);
    this.buckets[index] = Math.max(this.buckets[index] ?? 0, late);
  }

  /** Termina la serie y arma el informe (nada si no se jugó). `machine`: cómo va la máquina. */
  finish(now: number, machine = ''): RoomPerfReport | null {
    const startedAt = this.startedAt;
    this.startedAt = null;
    if (startedAt === null || this.samples === 0) return null;
    const message =
      this.lateCount === 0
        ? 'Sala: reloj al día'
        : `Sala: reloj atrasado ${this.lateCount} ${this.lateCount === 1 ? 'vez' : 'veces'} (máx ${Math.round(this.maxLate)} ms)`;
    const { humans, bots } = this.players;
    const lines = [
      `Sala: ${humans} ${humans === 1 ? 'persona' : 'personas'} · ${bots} de la IA · ${clock(now - startedAt)}`,
      `Reloj: atraso típico ${this.percentile(0.5)} ms · peor 1% ${this.percentile(0.99)} ms · máx ${Math.round(this.maxLate)} ms · más de ${LATE_MS} ms: ${this.lateCount} · pasos perdidos ${this.dropped}`,
      `Trabajo por vuelta: promedio ${(this.workTotal / this.samples).toFixed(1)} ms · máx ${Math.round(this.maxWork)} ms`,
    ];
    if (machine) lines.push(`Máquina: ${machine}`);
    lines.push(
      `Cada 10 s, peor atraso (ms): ${this.buckets.map((late) => Math.round(late)).join(' ')}`,
    );
    return { message, detail: lines.join('\n') };
  }

  private percentile(fraction: number): number {
    const wanted = Math.ceil(this.samples * fraction);
    let seen = 0;
    for (let bin = 0; bin < BINS; bin++) {
      seen += this.histogram[bin] ?? 0;
      if (seen >= wanted) return bin;
    }
    return BINS - 1;
  }
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
