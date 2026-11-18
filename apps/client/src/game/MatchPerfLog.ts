/** Sobre esto (menos de ~50 cuadros por segundo) un segundo cuenta como lento. */
const SLOW_FRAME_MS = 20;
/** Los cuadros se agrupan por milisegundo: alcanza para sacar promedios y percentiles. */
const BINS = 101;
/** Un cuadro más largo que esto es un tirón que se ve (el navegador mide lo mismo, ver abajo). */
const HITCH_MS = 50;
/** La línea de tiempo va en tramos de 10 s, igual que la de la red y la de la Sala. */
const BUCKET_MS = 10_000;
/** Una partida muy larga no hace crecer el informe sin fin (unos 20 minutos). */
const MAX_BUCKETS = 120;
/** Un momento o una cantidad de conjuros con menos tiempo que esto no dice nada. */
const MIN_SPAN_MS = 10_000;
/** Cuántos conjuros había en pantalla, de a tramos (el último es "o más"). */
const SPELL_BANDS = [0, 5, 10, 15] as const;

/** Tiempo y tirones de un tramo. */
interface Span {
  ms: number;
  frames: number;
  hitches: number;
  maxSpells: number;
}

function emptySpan(): Span {
  return { ms: 0, frames: 0, hitches: 0, maxSpells: 0 };
}

/** Lo que costó un cuadro por dentro, medido en el bucle principal. */
export interface FrameWork {
  /** La simulación de la partida (pasos fijos). */
  readonly simMs: number;
  /** Todo el trabajo de JavaScript del cuadro, simulación incluida. */
  readonly jsMs: number;
  /** Llamadas de dibujo a la tarjeta gráfica (sombras y resplandor incluidos). */
  readonly calls: number;
  readonly triangles: number;
  /** Lo que había en pantalla y en la memoria de la tarjeta gráfica. */
  readonly spells?: number | undefined;
  readonly particles?: number | undefined;
  readonly geometries?: number;
  readonly textures?: number;
  /** Sombreadores compilados: si suben en plena partida, cada uno trabó un cuadro. */
  readonly programs?: number | undefined;
}

/** Cuánto hay en pantalla en un cuadro. */
export interface SceneLoad {
  readonly spells: number;
  readonly particles: number;
}

/** Máximos y extremos de lo que hubo en pantalla durante la partida. */
interface LoadTrack {
  maxSpells: number;
  maxParticles: number;
  firstGeometries: number | null;
  lastGeometries: number;
  maxGeometries: number;
  firstTextures: number | null;
  lastTextures: number;
  firstPrograms: number | null;
  lastPrograms: number;
}

function emptyLoad(): LoadTrack {
  return {
    maxSpells: 0,
    maxParticles: 0,
    firstGeometries: null,
    lastGeometries: 0,
    maxGeometries: 0,
    firstTextures: null,
    lastTextures: 0,
    firstPrograms: null,
    lastPrograms: 0,
  };
}

/**
 * Un cuadro largo visto por el navegador (Chrome, `long-animation-frame`): cuánto trabajó la
 * página en él. Lo que no es código ni estilo y diseño es el resto del trabajo de la página.
 */
export interface PageHitch {
  readonly durationMs: number;
  /** El JavaScript (el juego, los toques, los mensajes de la red). */
  readonly scriptMs: number;
  /** Recalcular estilo, diseño y pintura de la interfaz HTML. */
  readonly layoutMs: number;
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
  private load = emptyLoad();
  private screenCapped = false;
  private pageHitches = 0;
  private pageMs = 0;
  private pageScriptMs = 0;
  private pageLayoutMs = 0;
  /** Cada 10 s de partida. */
  private timeline: Span[] = [];
  /** Por momento de la partida ("Caza", "Muerte súbita", "Entre rondas"). */
  private readonly moments = new Map<string, Span>();
  /** Por cantidad de conjuros en pantalla (índice de `SPELL_BANDS`). */
  private bands: Span[] = SPELL_BANDS.map(emptySpan);

  start(pixelRatio: number, quality: QualityName = 'alta', screenCapped = false): void {
    this.screenCapped = screenCapped;
    this.pageHitches = 0;
    this.pageMs = 0;
    this.pageScriptMs = 0;
    this.pageLayoutMs = 0;
    this.timeline = [];
    this.moments.clear();
    this.bands = SPELL_BANDS.map(emptySpan);
    this.worked = 0;
    this.simMs = 0;
    this.jsMs = 0;
    this.calls = 0;
    this.triangles = 0;
    this.startQuality = quality;
    this.qualityChanges.length = 0;
    this.load = emptyLoad();
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

  /**
   * Un cuadro de juego (no se llama en pausa). `moment`: en qué parte de la partida se estaba
   * ("Caza", "Muerte súbita"…), para saber en qué momentos hay más tirones.
   */
  frame(frameMs: number, work?: FrameWork, moment?: string): void {
    if (frameMs <= 0) return;
    this.spans(frameMs, work?.spells ?? 0, moment);
    if (work) {
      this.worked += 1;
      this.simMs += work.simMs;
      this.jsMs += work.jsMs;
      this.calls += work.calls;
      this.triangles += work.triangles;
      this.track(work);
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

  /** Suma el cuadro a su tramo de 10 s, a su momento y a su cantidad de conjuros. */
  private spans(frameMs: number, spells: number, moment: string | undefined): void {
    const index = Math.floor(this.playedMs / BUCKET_MS);
    const touched: Span[] = [];
    if (index < MAX_BUCKETS) {
      while (this.timeline.length <= index) this.timeline.push(emptySpan());
      touched.push(this.timeline[index] as Span);
    }
    if (moment) {
      let span = this.moments.get(moment);
      if (!span) {
        span = emptySpan();
        this.moments.set(moment, span);
      }
      touched.push(span);
    }
    let band = 0;
    while (band + 1 < SPELL_BANDS.length && spells >= (SPELL_BANDS[band + 1] ?? 0)) band++;
    touched.push(this.bands[band] as Span);
    const hitch = frameMs > HITCH_MS;
    for (const span of touched) {
      span.ms += frameMs;
      span.frames += 1;
      if (hitch) span.hitches += 1;
      span.maxSpells = Math.max(span.maxSpells, spells);
    }
  }

  private track(work: FrameWork): void {
    const load = this.load;
    if (work.spells !== undefined) load.maxSpells = Math.max(load.maxSpells, work.spells);
    if (work.particles !== undefined) {
      load.maxParticles = Math.max(load.maxParticles, work.particles);
    }
    if (work.geometries !== undefined) {
      load.firstGeometries ??= work.geometries;
      load.lastGeometries = work.geometries;
      load.maxGeometries = Math.max(load.maxGeometries, work.geometries);
    }
    if (work.textures !== undefined) {
      load.firstTextures ??= work.textures;
      load.lastTextures = work.textures;
    }
    if (work.programs !== undefined) {
      load.firstPrograms ??= work.programs;
      load.lastPrograms = work.programs;
    }
  }

  /** Un cuadro largo en que la página estuvo ocupada (solo lo avisa Chrome). */
  pageHitch(hitch: PageHitch): void {
    this.pageHitches += 1;
    this.pageMs += hitch.durationMs;
    this.pageScriptMs += hitch.scriptMs;
    this.pageLayoutMs += hitch.layoutMs;
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

    const load = this.load;
    if (load.firstGeometries !== null) {
      lines.push(`En pantalla: hasta ${load.maxSpells} conjuros y ${load.maxParticles} partículas`);
      // Si la memoria crece toda la partida, algo no se libera y el celular se va frenando.
      const textures =
        load.firstTextures !== null ? ` · texturas ${load.firstTextures}→${load.lastTextures}` : '';
      const programs =
        load.firstPrograms !== null
          ? ` · sombreadores ${load.firstPrograms}→${load.lastPrograms}`
          : '';
      lines.push(
        `Memoria gráfica: geometrías ${load.firstGeometries}→${load.lastGeometries} (máx. ${load.maxGeometries})${textures}${programs}`,
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
    if (this.screenCapped) {
      lines.push('Pantalla frenada a 30 fps por el celular (¿Modo de bajo consumo?)');
    }

    const slowShare = Math.round((this.slowSeconds / seconds) * 100);
    lines.push(
      this.firstSlowMs === null
        ? 'Lento (menos de 50 fps): nunca'
        : `Lento (menos de 50 fps): ${slowShare}% del tiempo, desde ${clock(this.firstSlowMs)}`,
    );

    lines.push(this.hitchLine(seconds));
    lines.push(...this.contextLines());

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
    if (this.timeline.length > 0) {
      const steps = this.timeline.map((span) =>
        span.frames === 0
          ? '-'
          : `${Math.round((span.frames * 1000) / span.ms)}/${span.hitches}/${span.maxSpells}`,
      );
      lines.push(`Cada 10 s (fps/tirones/conjuros): ${steps.join(' ')}`);
    }
    return lines;
  }

  /** En qué momentos de la partida y con cuántos conjuros en pantalla hubo tirones. */
  private contextLines(): string[] {
    const rate = (span: Span) => Math.round((span.hitches * 60_000) / span.ms);
    const lines: string[] = [];
    const moments = [...this.moments].filter(([, span]) => span.ms >= MIN_SPAN_MS);
    if (moments.length > 0 && moments.some(([, span]) => span.hitches > 0)) {
      lines.push(
        `Tirones por momento: ${moments.map(([name, span]) => `${name} ${span.hitches} (${rate(span)}/min)`).join(' · ')}`,
      );
    }
    const bands = this.bands
      .map((span, i) => ({ span, i }))
      .filter(({ span }) => span.ms >= MIN_SPAN_MS);
    if (bands.length > 0 && bands.some(({ span }) => span.hitches > 0)) {
      const label = (i: number) => {
        const from = SPELL_BANDS[i] ?? 0;
        const next = SPELL_BANDS[i + 1];
        return next === undefined ? `${from} o más` : `${from} a ${next - 1}`;
      };
      lines.push(
        `Tirones según conjuros en pantalla: ${bands.map(({ span, i }) => `${label(i)}: ${rate(span)}/min`).join(' · ')}`,
      );
    }
    return lines;
  }

  /**
   * Cuántos tirones hubo y, si el navegador lo sabe, cuántos fueron por trabajo de la página
   * (y de qué tipo). Los demás los frenó la tarjeta gráfica o el sistema: la página estaba libre.
   */
  private hitchLine(seconds: number): string {
    let hitches = 0;
    for (let bin = HITCH_MS + 1; bin < BINS; bin++) hitches += this.histogram[bin] ?? 0;
    if (hitches === 0) return 'Tirones (cuadros de más de 50 ms): ninguno';
    const perMinute = Math.round((hitches * 60) / seconds);
    const base = `Tirones (cuadros de más de 50 ms): ${hitches}, ${perMinute} por minuto`;
    if (this.pageHitches === 0) return base;
    const share = (part: number) => `${Math.round((part / this.pageMs) * 100)}%`;
    const other = Math.max(0, this.pageMs - this.pageScriptMs - this.pageLayoutMs);
    return `${base} · la página ocupada en ${this.pageHitches} (código ${share(this.pageScriptMs)} · estilo y diseño ${share(this.pageLayoutMs)} · otro ${share(other)})`;
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
