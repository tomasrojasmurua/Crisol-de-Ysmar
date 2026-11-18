import type * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import { DeviceWatch } from '../platform/DeviceWatch';
import { FpsMeter } from '../ui/FpsMeter';
import { type FrameWork, MatchPerfLog, type QualityName, type SceneLoad } from './MatchPerfLog';

/** Lo que usa este archivo de `PerformanceLongAnimationFrameTiming` (Chrome 123 o más nuevo). */
interface LongFrameEntry extends PerformanceEntry {
  readonly styleAndLayoutStart: number;
  readonly scripts: readonly { readonly duration: number }[];
}

/**
 * Los datos de rendimiento: el medidor de FPS, los datos de la conexión y el informe de la
 * partida. Solo se ven si se activan en Pausa; el informe se arma siempre (es barato).
 */
export class Diagnostics {
  private readonly fpsMeter: FpsMeter;
  private readonly perfLog = new MatchPerfLog();
  /** Conexión y batería del celular (solo Chrome en Android las dice). */
  private readonly device = new DeviceWatch();
  private readonly netBadge: HTMLElement;
  private online = false;
  private audioCutsSeen = 0;
  private frameStart = 0;
  /** Cuándo terminó el último cuadro de partida: los cuadros largos del menú no cuentan. */
  private lastMatchFrameAt = Number.NEGATIVE_INFINITY;

  constructor(
    parent: HTMLElement,
    private readonly audio: AudioEngine,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.fpsMeter = new FpsMeter(parent);
    this.netBadge = document.createElement('div');
    this.netBadge.className = 'net-badge';
    this.netBadge.hidden = true;
    parent.append(this.netBadge);
    this.watchLongFrames();
  }

  /**
   * Chrome avisa cada cuadro de más de 50 ms en que la página estuvo ocupada, y en qué: así el
   * informe distingue un tirón del juego (código, estilo y diseño) de uno de la tarjeta gráfica.
   */
  private watchLongFrames(): void {
    if (!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) return;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LongFrameEntry[]) {
          if (entry.startTime - this.lastMatchFrameAt > 500) continue;
          const end = entry.startTime + entry.duration;
          const layoutMs = entry.styleAndLayoutStart > 0 ? end - entry.styleAndLayoutStart : 0;
          const scriptMs = (entry.scripts ?? []).reduce((sum, script) => sum + script.duration, 0);
          this.perfLog.pageHitch({ durationMs: entry.duration, scriptMs, layoutMs });
        }
      }).observe({ type: 'long-animation-frame' });
    } catch {
      // Sin este dato el informe dice igual cuántos tirones hubo.
    }
  }

  get enabled(): boolean {
    return this.fpsMeter.enabled;
  }

  set enabled(on: boolean) {
    this.fpsMeter.enabled = on;
    this.netBadge.hidden = !(on && this.online);
  }

  /** En red se muestran también los datos de la conexión (si los datos están activados). */
  set net(online: boolean) {
    this.online = online;
    this.netBadge.hidden = !(online && this.fpsMeter.enabled);
  }

  netStats(text: string): void {
    this.netBadge.textContent = text;
  }

  /** `screenCapped`: el celular frena la pantalla a 30 cuadros (ver render/ScreenCap.ts). */
  matchStarted(pixelRatio: number, quality: QualityName, screenCapped = false): void {
    this.perfLog.start(pixelRatio, quality, screenCapped);
    this.device.start();
    this.audioCutsSeen = this.audio.interruptions;
  }

  /** Empieza un cuadro: se mide desde aquí. */
  beginFrame(frameMs: number): void {
    this.frameStart = performance.now();
    this.renderer.info.reset();
    this.fpsMeter.sample(frameMs);
  }

  /** Un cuadro de juego terminado (no se llama en pausa ni con el resultado a la vista). */
  matchFrame(frameMs: number, simMs: number, load?: SceneLoad, moment?: string): void {
    const info = this.renderer.info;
    const work: FrameWork = {
      simMs,
      jsMs: performance.now() - this.frameStart,
      calls: info.render.calls,
      triangles: info.render.triangles,
      spells: load?.spells,
      particles: load?.particles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length,
    };
    this.perfLog.frame(frameMs, work, moment);
    this.lastMatchFrameAt = performance.now();
    while (this.audioCutsSeen < this.audio.interruptions) {
      this.audioCutsSeen += 1;
      this.perfLog.audioCut();
    }
  }

  resolutionChanged(pixelRatio: number): void {
    this.perfLog.resolutionChanged(pixelRatio);
  }

  qualityChanged(quality: QualityName): void {
    this.perfLog.qualityChanged(quality);
  }

  /** El informe de la partida aunque los datos estén apagados (para el registro remoto). */
  fullReport(): string[] {
    const lines = this.perfLog.summary(this.audio.playing);
    // La línea de tiempo va al final: es la más larga y la que menos importa si se corta.
    const last = lines.at(-1);
    if (last?.startsWith('Cada 10 s')) return [...lines.slice(0, -1), ...this.device.lines(), last];
    return [...lines, ...this.device.lines()];
  }

  /** El informe de la partida, si los datos están activados (si no, nada). */
  report(): string[] {
    return this.enabled ? this.perfLog.summary(this.audio.playing) : [];
  }
}
