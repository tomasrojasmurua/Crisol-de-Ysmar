/**
 * Piezas del juego en pausa hasta probarlas con gente (plan de debilidades, noviembre de 2026).
 * El código sigue ahí: volver a encender una pieza es cambiar su valor a `true`.
 */
export interface Features {
  /** El Guardián del Crisol despierta en la plaza durante la Caza. */
  readonly guardian: boolean;
  /** La regla de 3 Vidas se puede elegir en el menú. Si no, al caer solo existe el modo Espectro. */
  readonly livesRule: boolean;
  /** El 1v1 también se juega en la jungla. Si no, el duelo es en la plaza, sin campamentos. */
  readonly duelInJungle: boolean;
}

export const FEATURES: Features = {
  guardian: false,
  livesRule: false,
  duelInJungle: false,
};
