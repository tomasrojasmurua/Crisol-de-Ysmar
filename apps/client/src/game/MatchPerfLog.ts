/** Sobre esto (menos de ~50 cuadros por segundo) un segundo cuenta como lento. */
const SLOW_FRAME_MS = 20;
/** Los cuadros se agrupan por milisegundo: alcanza para sacar promedios y percentiles. */
const BINS = 101;

/** Lo que costó un cuadro por dentro, medido en el bucle principal. */
export interface FrameWork {
  /** La simulación de la partida (pasos fijos). */
  readonly simMs: number;
  /** Todo el trabajo de JavaScript del cuadro, simulación incluida. */
  readonly jsMs: number;
  /** Llamadas de dibujo a la tarjeta gráfica (sombras y resplandor incluidos). */
  readonly calls: number;
  readonly triangles: number;
}

export type QualityName = 'alta' | 'liviana';
const QUALITY_LABEL: Record<QualityName, string> = { alta: 'Alta', liviana: 'Liviana' };

/**
 * Informe de rendimiento de una partida entera. Un pantallazo del medidor de FPS solo muestra
 * un instante; esto junta todo lo que pasó, para leerlo en la pantalla de resultado (con los
 * datos de rendimiento activados en Pausa). Guarda contadores, no cada cuadro.
 */
export class MatchPerfLog {
  private readonly histogram = new Uint32Array(BINS);
  private frames = 0;
  private playedMs = 0;
  private secondMs = 0;
  private secondFrames = 0;
  private slowSeconds = 0;
  private firstSlowMs: number | null = null;
  private readonly perMinute: { ms: number; frames: number }[] = [];
  private readonly resolutionChanges: { atMs: number; ratio: number }[] = [];
  private readonly audioCuts: number[] = [];
  private startRatio = 1;
  private ratio = 1;
  private worked = 0;
  private simMs = 0;
  private jsMs = 0;
  private calls = 0;
  private triangles = 0;
  private startQuality: QualityName = 'alta';
  private readonly qualityChanges: { atMs: number; quality: QualityName }[] = [];

  start(pixelRatio: number, quality: QualityName = 'alta'): void {
    this.worked = 0;
    this.simMs = 0;
    this.jsMs = 0;
    this.calls = 0;
    this.triangles = 0;
    this.startQuality = quality;
    this.qualityChanges.length = 0;
    this.histogram.fill(0);
    this.frames = 0;
    this.playedMs = 0;
    this.secondMs = 0;
    this.secondFrames = 0;
    this.slowSeconds = 0;
    this.firstSlowMs = null;
    this.perMinute.length = 0;
    this.resolutionChanges.length = 0;
    this.audioCuts.length = 0;
    this.startRatio = pixelRatio;
    this.ratio = pixelRatio;
  }

  /** Un cuadro de juego (no se llama en pausa). */
  frame(frameMs: number, work?: FrameWork): void {
    if (frameMs <= 0) return;
    if (work) {
      this.worked += 1;
      this.simMs += work.simMs;
      this.jsMs += work.jsMs;
      this.calls += work.calls;
      this.triangles += work.triangles;
    }
    const bin = Math.min(BINS - 1, Math.round(frameMs));
    this.histogram[bin] = (this.histogram[bin] ?? 0) + 1;
    this.frames += 1;
    const minute = Math.floor(this.playedMs / 60_000);
    let bucket = this.perMinute[minute];
    if (!bucket) {
      bucket = { ms: 0, frames: 0 };
      this.perMinute[minute] = bucket;
    }
    bucket.ms += frameMs;
    bucket.frames += 1;
    this.playedMs += frameMs;
    this.secondMs += frameMs;
    this.secondFrames += 1;
    if (this.secondMs >= 1000) {
      if (this.secondMs / this.secondFrames > SLOW_FRAME_MS) {
        this.slowSeconds += 1;
        if (this.firstSlowMs === null) this.firstSlowMs = this.playedMs;
      }
      this.secondMs = 0;
      this.secondFrames = 0;
    }
  }

  resolutionChanged(pixelRatio: number): void {
    this.ratio = pixelRatio;
    this.resolutionChanges.push({ atMs: this.playedMs, ratio: pixelRatio });
  }

  qualityChanged(quality: QualityName): void {
    this.qualityChanges.push({ atMs: this.playedMs, quality });
  }

  audioCut(): void {
    this.audioCuts.push(this.playedMs);
  }

  /** Líneas para mostrar. `audioPlaying`: si el sonido anda al terminar. */
  summary(audioPlaying: boolean): string[] {
    if (this.frames === 0) return [];
    const seconds = Math.max(1, Math.round(this.playedMs / 1000));
    const typical = fps(this.percentile(0.5));
    const worst = fps(this.percentile(0.99));
    const lines = [
      `Duración ${clock(this.playedMs)} · típico ${typical} fps · peor 1% ${worst} fps`,
    ];

    if (this.worked > 0) {
      const sim = this.simMs / this.worked;
      const js = this.jsMs / this.worked;
      const frame = this.playedMs / this.frames;
      const wait = Math.max(0, frame - js);
      // Si el JavaScript se come casi todo el cuadro, frena el procesador; si sobra mucho
      // tiempo y aun así va lento, se está esperando a la tarjeta gráfica.
      const verdict =
        frame <= SLOW_FRAME_MS
          ? ''
          : js > frame * 0.75
            ? ' (frena el procesador)'
            : js < frame * 0.5
              ? ' (frena la tarjeta gráfica)'
              : '';
      lines.push(
        `Por cuadro: lógica ${ms(sim)} · dibujo ${ms(js - sim)} · espera ${ms(wait)}${verdict}`,
      );
      lines.push(
        `Dibujos por cuadro ${Math.round(this.calls / this.worked)} · ${Math.round(this.triangles / this.worked / 1000)} mil triángulos`,
      );
    }

    const quality =
      this.qualityChanges.length === 0
        ? `Calidad: ${QUALITY_LABEL[this.startQuality]}`
        : `Calidad: ${QUALITY_LABEL[this.startQuality]}; ${this.qualityChanges
            .slice(0, 3)
            .map((change) => `${QUALITY_LABEL[change.quality]} en ${clock(change.atMs)}`)
            .join(', ')}`;
    lines.push(quality);

    const slowShare = Math.round((this.slowSeconds / seconds) * 100);
    lines.push(
      this.firstSlowMs === null
        ? 'Lento (menos de 50 fps): nunca'
        : `Lento (menos de 50 fps): ${slowShare}% del tiempo, desde ${clock(this.firstSlowMs)}`,
    );

    const minutes = this.perMinute.filter((m) => m.frames > 0 && m.ms >= 30_000);
    const first = minutes[0];
    const last = minutes[minutes.length - 1];
    if (first && last && minutes.length >= 3) {
      const from = Math.round((first.frames * 1000) / first.ms);
      const to = Math.round((last.frames * 1000) / last.ms);
      const note = to < from * 0.85 ? ' (se fue frenando: ¿celular caliente?)' : '';
      lines.push(`Primer minuto ${from} fps → último ${to} fps${note}`);
    }

    if (this.resolutionChanges.length === 0) {
      lines.push(`Resolución: ${this.startRatio} todo el rato`);
    } else {
      const changes = this.resolutionChanges
        .slice(0, 4)
        .map((change) => `${change.ratio} en ${clock(change.atMs)}`)
        .join(', ');
      const more = this.resolutionChanges.length > 4 ? '…' : '';
      lines.push(
        `Resolución: partió en ${this.startRatio}; ${changes}${more}; terminó en ${this.ratio}`,
      );
    }

    if (this.audioCuts.length === 0) {
      lines.push(audioPlaying ? 'Sonido: sin cortes' : 'Sonido: apagado al terminar');
    } else {
      const times = this.audioCuts.slice(0, 3).map(clock).join(', ');
      const count = this.audioCuts.length === 1 ? '1 vez' : `${this.audioCuts.length} veces`;
      lines.push(`Sonido: se cortó ${count} (${times}) y ${audioPlaying ? 'volvió' : 'no volvió'}`);
    }
    return lines;
  }

  /** Duración del cuadro (ms) bajo la cual cae esa fracción de los cuadros. */
  private percentile(fraction: number): number {
    const target = this.frames * fraction;
    let seen = 0;
    for (let ms = 0; ms < BINS; ms++) {
      seen += this.histogram[ms] ?? 0;
      if (seen >= target) return Math.max(1, ms);
    }
    return BINS - 1;
  }
}

function ms(value: number): string {
  return `${value.toFixed(1)} ms`;
}

function fps(frameMs: number): number {
  return Math.round(1000 / frameMs);
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
