import type { Glyph, Omen } from '@crisol/content';
import type { ElementId, GameEvent, MatchState, SeriesState, Vec2, Wizard } from '@crisol/core';
import type { MatchOptions, MatchStage } from './LocalMatch';

/**
 * Lo que la pantalla necesita de una partida, sea contra la IA en el celular (`LocalMatch`)
 * o en red contra un amigo (`NetMatch`). Así el dibujo y el HUD no saben de dónde viene.
 */
export interface MatchView {
  readonly options: MatchOptions;
  readonly state: MatchState;
  readonly series: SeriesState;
  readonly stage: MatchStage;
  readonly omen: Omen;
  readonly affinities: ReadonlyMap<number, ElementId | null>;
  /** El id del mago de este celular. */
  readonly playerId: number;
  readonly player: Wizard;
  readonly roundNumber: number;
  /** Avanza un paso y devuelve lo que pasó. */
  step(): readonly GameEvent[];
  chooseGlyph(glyph: Glyph): void;
  glyphsOf(id: number): readonly Glyph[];
  interpolated(id: number, current: Vec2, alpha: number): Vec2;
  /** Cómo se ve un mago en este celular, si difiere del estado (en red, tu tejido predicho). */
  present?(wizard: Wizard): Wizard;
  /** En red: si la Sala dice que no ves a ese rival. */
  isHidden?(id: number): boolean;
}
