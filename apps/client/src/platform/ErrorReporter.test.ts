import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorReporter } from './ErrorReporter';

const environment = { version: 'v79', device: 'iPhone', screen: '844×390 @3x', session: 'abc' };

describe('ErrorReporter', () => {
  let now = 0;
  let sent: string[] = [];
  const make = (): ErrorReporter =>
    new ErrorReporter(
      { ...environment },
      () => ({ room: 'ABCD', match: 'red #1 · ronda 2' }),
      (body) => sent.push(body),
      () => now,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    now = 5_000;
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it('junta los informes y los manda juntos con la sala y la partida', () => {
    const reporter = make();
    reporter.report('error', 'a');
    reporter.report('red', 'b', 'código 1006');
    expect(sent).toHaveLength(0);
    vi.advanceTimersByTime(3_000);
    expect(sent).toHaveLength(1);
    const batch = JSON.parse(sent[0] ?? '[]');
    expect(batch).toHaveLength(2);
    expect(batch[1]).toMatchObject({
      kind: 'red',
      message: 'b',
      detail: 'código 1006',
      room: 'ABCD',
      version: 'v79',
      uptime: 5,
    });
  });

  it('no repite el mismo problema en 30 s', () => {
    const reporter = make();
    reporter.report('error', 'igual');
    reporter.report('error', 'igual');
    now += 31_000;
    reporter.report('error', 'igual');
    reporter.flush();
    expect(JSON.parse(sent[0] ?? '[]')).toHaveLength(2);
  });

  it('tiene un tope por visita', () => {
    const reporter = make();
    for (let i = 0; i < 100; i++) reporter.report('error', `n${i}`);
    reporter.flush();
    expect(JSON.parse(sent[0] ?? '[]')).toHaveLength(40);
  });

  it('un contexto que falla no impide el informe', () => {
    const reporter = new ErrorReporter(
      { ...environment },
      () => {
        throw new Error('sin partida');
      },
      (body) => sent.push(body),
      () => now,
    );
    reporter.report('promesa', 'x');
    reporter.flush();
    expect(JSON.parse(sent[0] ?? '[]')[0]).toMatchObject({ room: '', match: '' });
  });
});
