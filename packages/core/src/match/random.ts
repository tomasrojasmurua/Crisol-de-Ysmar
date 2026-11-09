import { SeededRng } from '../sim/rng';
import type { MatchState } from './state';

/** Usa el azar guardado en el estado y lo deja avanzado, para que la partida se pueda repetir. */
export function withRng<T>(state: MatchState, use: (rng: SeededRng) => T): T {
  const rng = SeededRng.restore(state.rngState);
  const result = use(rng);
  state.rngState = rng.snapshot();
  return result;
}
