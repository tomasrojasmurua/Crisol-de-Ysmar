import { describe, expect, it } from 'vitest';
import { RoomPerf } from './roomPerf';

describe('RoomPerf: cómo anduvo la Sala en una serie', () => {
  it('sin serie empezada no hay informe', () => {
    expect(new RoomPerf().finish(1000)).toBeNull();
  });

  it('reloj al día: atrasos chicos y la línea de tiempo cada 10 s', () => {
    const perf = new RoomPerf();
    perf.start(0, { humans: 3, bots: 1 });
    for (let t = 0; t < 25_000; t += 33) perf.clock(t, 1, 0.5);
    const report = perf.finish(25_000, 'CPU 6% · atraso p99 2 ms');
    expect(report?.message).toBe('Sala: reloj al día');
    const lines = report?.detail.split('\n') ?? [];
    expect(lines[0]).toBe('Sala: 3 personas · 1 de la IA · 0:25');
    expect(lines[1]).toContain('atraso típico 1 ms');
    expect(lines).toContain('Máquina: CPU 6% · atraso p99 2 ms');
    expect(lines.at(-1)).toBe('Cada 10 s, peor atraso (ms): 1 1 1');
  });

  it('anota cuántas veces y cuándo se atrasó el reloj, y los pasos perdidos', () => {
    const perf = new RoomPerf();
    perf.start(0, { humans: 2, bots: 0 });
    perf.clock(1000, 2, 1);
    perf.clock(12_000, 180, 3, 2);
    perf.clock(13_000, 70, 1);
    const report = perf.finish(20_000);
    expect(report?.message).toBe('Sala: reloj atrasado 2 veces (máx 180 ms)');
    expect(report?.detail).toContain('más de 50 ms: 2 · pasos perdidos 2');
    expect(report?.detail).toContain('Cada 10 s, peor atraso (ms): 2 180');
    // Terminada, no vuelve a informar hasta otra serie.
    expect(perf.finish(30_000)).toBeNull();
  });
});

describe('RoomPerf: la vuelta más lenta', () => {
  it('dice cuándo fue, en qué se fue el tiempo y qué había en la arena', () => {
    const perf = new RoomPerf();
    perf.start(0, { humans: 3, bots: 1 });
    perf.clock(1000, 2, 3);
    expect(perf.isSlowest(5)).toBe(false);
    expect(perf.isSlowest(268)).toBe(true);
    perf.slowest(525_000, 268, { stepMs: 20, botMs: 230, sendMs: 18 }, '2 de 4 magos en pie');
    perf.clock(525_000, 200, 268);
    const report = perf.finish(530_000);
    expect(report?.detail).toContain(
      'Vuelta más lenta: 268 ms a los 8:45 (núcleo 20 ms · IA 230 ms · estados 18 ms) · vueltas de más de 50 ms: 1 · 2 de 4 magos en pie',
    );
  });
});
