import { masterOf } from '@crisol/content';
import { describe, expect, it } from 'vitest';
import { masterQuote } from './masterLine';

describe('la frase del maestro', () => {
  it('distingue victoria fácil, reñida, derrota y empate', () => {
    const { lines } = masterOf('raiz');
    expect(lines.win).toContain(masterQuote('raiz', 'win', [2, 0], 2, 0).line);
    expect(lines.closeWin).toContain(masterQuote('raiz', 'win', [2, 1], 2, 0).line);
    expect(lines.loss).toContain(masterQuote('raiz', 'loss', [0, 2], 2, 0.5).line);
    expect(lines.closeLoss).toContain(masterQuote('raiz', 'loss', [1, 2], 2, 0.99).line);
    expect(lines.draw).toContain(masterQuote('raiz', 'draw', [1, 1], 2, 0).line);
  });

  it('en todos contra todos, reñida es si alguien más quedó a una ronda', () => {
    const { lines } = masterOf('umbra');
    expect(lines.closeWin).toContain(masterQuote('umbra', 'win', [0, 2, 1, 0], 2, 0).line);
    expect(lines.win).toContain(masterQuote('umbra', 'win', [0, 2, 0, 0], 2, 0).line);
  });

  it('dice quién habla, con el color de su elemento', () => {
    const quote = masterQuote('brasa', 'win', [2, 0], 2, 0);
    expect(quote.name).toBe('Vesk, la Salamandra');
    expect(quote.color).toMatch(/^#/);
  });
});
