import { ELEMENTS, masterOf } from '@crisol/content';
import type { ElementId } from '@crisol/core';
import type { Outcome } from '../ui/ResultScreen';

/** Lo que dice tu maestro al final, listo para la pantalla de resultado. */
export interface MasterQuote {
  readonly name: string;
  readonly line: string;
  /** El color de su elemento. */
  readonly color: string;
}

/**
 * La frase de tu maestro según cómo terminó la serie. Reñida es cuando el segundo mejor quedó a
 * una ronda de ganar (la serie se definió en la última). `roll` en [0, 1) elige entre sus
 * frases: fuera del núcleo no hace falta que sea determinista, pero así se puede probar.
 */
export function masterQuote(
  element: ElementId,
  outcome: Outcome,
  wins: readonly number[],
  roundsToWin: number,
  roll: number,
): MasterQuote {
  const master = masterOf(element);
  const sorted = [...wins].sort((a, b) => b - a);
  const close = roundsToWin > 1 && (sorted[1] ?? 0) >= roundsToWin - 1;
  const { lines } = master;
  const pool =
    outcome === 'draw'
      ? lines.draw
      : outcome === 'win'
        ? close
          ? lines.closeWin
          : lines.win
        : close
          ? lines.closeLoss
          : lines.loss;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, roll) * pool.length));
  return {
    name: master.name,
    line: pool[index] ?? '',
    color: ELEMENTS.find((e) => e.id === element)?.color ?? '#fff',
  };
}
