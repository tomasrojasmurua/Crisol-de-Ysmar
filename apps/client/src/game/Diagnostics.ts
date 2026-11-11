import type * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import { FpsMeter } from '../ui/FpsMeter';
import { type FrameWork, MatchPerfLog, type QualityName } from './MatchPerfLog';

/**
 * Los datos de rendimiento: el medidor de FPS, los datos de la conexión y el informe de la
 * partida. Solo se ven si se activan en Pausa; el informe se arma siempre (es barato).
 */
export class Diagnostics {
  private readonly fpsMeter: FpsMeter;
  private readonly perfLog = new MatchPerfLog();
  private readonly netBadge: HTMLElement;
  private online = false;
  private audioCutsSeen = 0;
  private frameStart = 0;

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

  matchStarted(pixelRatio: number, quality: QualityName): void {
    this.perfLog.start(pixelRatio, quality);
    this.audioCutsSeen = this.audio.interruptions;
  }

  /** Empieza un cuadro: se mide desde aquí. */
  beginFrame(frameMs: number): void {
    this.frameStart = performance.now();
    this.renderer.info.reset();
    this.fpsMeter.sample(frameMs);
  }

  /** Un cuadro de juego terminado (no se llama en pausa ni con el resultado a la vista). */
  matchFrame(frameMs: number, simMs: number): void {
    const work: FrameWork = {
      simMs,
      jsMs: performance.now() - this.frameStart,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
    this.perfLog.frame(frameMs, work);
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

  /** El informe de la partida, si los datos están activados (si no, nada). */
  report(): string[] {
    return this.enabled ? this.perfLog.summary(this.audio.playing) : [];
  }
}
