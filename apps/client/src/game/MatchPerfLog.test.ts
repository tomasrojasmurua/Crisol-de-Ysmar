import { describe, expect, it } from 'vitest';
import { MatchPerfLog } from './MatchPerfLog';

function play(log: MatchPerfLog, frameMs: number, seconds: number): void {
  for (let t = 0; t < seconds * 1000; t += frameMs) log.frame(frameMs);
}

describe('MatchPerfLog', () => {
  it('una partida fluida dice que nunca fue lenta', () => {
    const log = new MatchPerfLog();
    log.start(2);
    play(log, 16, 90);
    const lines = log.summary(true);
    expect(lines[0]).toContain('típico 63 fps');
    expect(lines).toContain('Lento (menos de 50 fps): nunca');
    expect(lines).toContain('Resolución: 2 todo el rato');
    expect(lines).toContain('Sonido: sin cortes');
  });

  it('cuenta lo que pasó en toda la partida, no solo el final', () => {
    const log = new MatchPerfLog();
    log.start(2);
    play(log, 16, 120);
    log.audioCut();
    play(log, 16, 30);
    log.resolutionChanged(1.75);
    play(log, 25, 60);
    const lines = log.summary(false);
    expect(lines).toContain('Lento (menos de 50 fps): 28% del tiempo, desde 2:31');
    expect(lines).toContain(
      'Primer minuto 63 fps → último 40 fps (se fue frenando: ¿celular caliente?)',
    );
    expect(lines).toContain('Resolución: partió en 2; 1.75 en 2:30; terminó en 1.75');
    expect(lines).toContain('Sonido: se cortó 1 vez (2:00) y no volvió');
  });
});
