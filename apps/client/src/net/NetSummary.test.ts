import { describe, expect, test } from 'vitest';
import { NetSummary } from './NetMatch';

describe('NetSummary', () => {
  test('sin pings no hay resumen', () => {
    expect(new NetSummary().lines(2)).toEqual([]);
  });

  test('resume ping, confirmación, colchón y cortes', () => {
    const summary = new NetSummary();
    for (let i = 1; i <= 100; i++) summary.pings.push(i * 2);
    summary.acks.push(150, 180, 400);
    summary.stalls = 3;
    summary.maxTarget = 5;
    summary.cuts = 1;
    summary.holes = 4;
    summary.longestHole = 312.4;
    const lines = summary.lines(4);
    expect(lines[0]).toBe('Ping típico 102 ms · peor 5% 192 ms · máx 200 ms');
    expect(lines[1]).toBe('Toque confirmado típico 180 ms · peor 5% 400 ms');
    expect(lines[2]).toContain('vaciado 3 veces · cortes 1');
    expect(lines[4]).toBe('Silencios de más de 100 ms: 4 · el más largo 312 ms');
  });
});
