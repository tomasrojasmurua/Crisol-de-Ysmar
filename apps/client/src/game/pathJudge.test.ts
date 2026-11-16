import { linajePath } from '@crisol/content';
import { describe, expect, it } from 'vitest';
import { judgePath } from './pathJudge';

const path = linajePath('brasa');
const step = (kind: string) => {
  const found = path.find((s) => s.goal.kind === kind);
  if (!found) throw new Error(kind);
  return found;
};

describe('juez del Camino', () => {
  it('sin ganar la serie no se supera ningún paso', () => {
    const verdict = judgePath(step('win'), { won: false, roundsLost: 2, spells: {} });
    expect(verdict.passed).toBe(false);
    expect(verdict.won).toBe(false);
  });

  it('sin perder ronda: una ronda perdida no cuenta', () => {
    const sweep = step('sweep');
    expect(judgePath(sweep, { won: true, roundsLost: 1, spells: {} }).passed).toBe(false);
    expect(judgePath(sweep, { won: true, roundsLost: 0, spells: {} }).passed).toBe(true);
  });

  it('solo tus hechizos: Paso sí vale, uno de otro Linaje no', () => {
    const own = step('ownSpells');
    expect(judgePath(own, { won: true, roundsLost: 1, spells: { spark: 3, step: 1 } }).passed).toBe(
      true,
    );
    expect(judgePath(own, { won: true, roundsLost: 0, spells: { spark: 3, claw: 1 } }).passed).toBe(
      false,
    );
  });

  it('hechizos distintos: cuenta los que salieron', () => {
    const variety = step('variety');
    const five = { spark: 1, fireball: 1, meteor: 1, claw: 1, step: 1 };
    expect(judgePath(variety, { won: true, roundsLost: 0, spells: five }).passed).toBe(false);
    expect(
      judgePath(variety, { won: true, roundsLost: 0, spells: { ...five, splash: 2 } }).passed,
    ).toBe(true);
  });
});
