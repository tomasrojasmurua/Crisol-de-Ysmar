import type { Glyph } from '@crisol/content';
import type { GameEvent, MatchState, Vec2, Wizard } from '@crisol/core';
import type { MatchStage } from './LocalMatch';
import type { MatchSummary, MatchView } from './MatchView';
import type { ReplayClip, ReplayFrame } from './ReplayRecorder';

const PLAYING: MatchStage = { kind: 'playing' };
/** Más que esto en un paso es un salto, no un paso. */
const SNAP_DISTANCE = 3;
/** Alrededor del último golpe la repetición va a media velocidad: se alcanza a ver el remate. */
const SLOW_TICKS = 12;
/** Al final queda quieta un momento (si la jugada cerró la ronda, el último paso es el golpe). */
const HOLD_STEPS = 30;

/**
 * La repetición como si fuera una partida: avanza un paso guardado por paso de reloj, así el
 * mismo dibujo, efectos y sonidos de siempre la muestran. "Tu" mago es quien hizo la jugada:
 * la cámara va sobre su hombro. No simula nada: solo recorre lo que se guardó.
 */
export class ReplayView implements MatchView {
  private index = 0;
  /** Cuántos pasos de reloj dura el paso guardado actual (2 en cámara lenta) y cuántos lleva. */
  private span = 1;
  private spent = 0;
  /** Pasos de reloj quieta al final. */
  private held = 0;
  readonly playerId: number;

  constructor(
    private readonly clip: ReplayClip,
    private readonly source: MatchView,
  ) {
    // El desenlace (sin jugada elegida) se ve desde tu mago, como la partida.
    this.playerId = clip.highlight?.wizardId ?? source.playerId;
  }

  get options(): MatchView['options'] {
    return this.source.options;
  }

  get series(): MatchView['series'] {
    return this.source.series;
  }

  get omen(): MatchView['omen'] {
    return this.source.omen;
  }

  get affinities(): MatchView['affinities'] {
    return this.source.affinities;
  }

  get stage(): MatchStage {
    return PLAYING;
  }

  get roundNumber(): number {
    return this.clip.highlight?.round ?? this.source.series.roundsPlayed;
  }

  get state(): MatchState {
    return this.frame.state;
  }

  get player(): Wizard {
    const wizards = this.state.wizards;
    return wizards.find((w) => w.id === this.playerId) ?? (wizards[0] as Wizard);
  }

  /** Si ya mostró el último paso y su pausa. */
  get done(): boolean {
    return this.atEnd && this.held >= HOLD_STEPS;
  }

  private get atEnd(): boolean {
    return this.index >= this.clip.frames.length - 1;
  }

  /** Cuánto lleva, de 0 a 1 (para la barra de la repetición). */
  get progress(): number {
    return this.clip.frames.length <= 1 ? 1 : this.index / (this.clip.frames.length - 1);
  }

  private get frame(): ReplayFrame {
    return this.clip.frames[this.index] as ReplayFrame;
  }

  /** El paso anterior, para interpolar. */
  private get before(): ReplayFrame {
    return this.clip.frames[Math.max(0, this.index - 1)] as ReplayFrame;
  }

  matchSummary(): MatchSummary | null {
    return null;
  }

  /** Avanza un paso guardado y devuelve lo que pasó en él (efectos y sonidos). */
  step(): readonly GameEvent[] {
    if (this.spent + 1 < this.span) {
      this.spent++;
      return [];
    }
    if (this.atEnd) {
      this.held++;
      return [];
    }
    this.index++;
    const end = this.clip.highlight?.endTick;
    this.span = end !== undefined && Math.abs(this.frame.state.tick - end) <= SLOW_TICKS ? 2 : 1;
    this.spent = 0;
    return this.frame.state.events;
  }

  chooseGlyph(_glyph: Glyph): void {}

  glyphsOf(id: number): readonly Glyph[] {
    return this.source.glyphsOf(id);
  }

  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    // En cámara lenta un paso guardado se reparte en dos pasos de reloj.
    const t = this.atEnd && this.held > 0 ? 1 : (this.spent + alpha) / this.span;
    const before = this.before.state;
    const from =
      before.wizards.find((w) => w.id === id)?.pos ??
      (before.spells.find((s) => s.id === id) as { pos?: Vec2 } | undefined)?.pos ??
      before.beasts.find((b) => b.id === id)?.pos;
    // Un salto (Destello, Portal) no se recorre a medias.
    if (!from || Math.hypot(current.x - from.x, current.z - from.z) > SNAP_DISTANCE) return current;
    return { x: from.x + (current.x - from.x) * t, z: from.z + (current.z - from.z) * t };
  }

  isHidden(id: number): boolean {
    return this.frame.hidden.includes(id);
  }
}
