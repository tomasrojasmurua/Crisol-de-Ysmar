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

  it('cuenta los tirones y, si Chrome lo sabe, cuánto fue trabajo de la página', () => {
    const log = new MatchPerfLog();
    log.start(1.5);
    play(log, 16, 60);
    for (let i = 0; i < 12; i++) log.frame(70);
    expect(log.summary(true)).toContain('Tirones (cuadros de más de 50 ms): 12, 12 por minuto');
    log.pageHitch({ durationMs: 100, scriptMs: 60, layoutMs: 30 });
    log.pageHitch({ durationMs: 100, scriptMs: 40, layoutMs: 10 });
    expect(log.summary(true)).toContain(
      'Tirones (cuadros de más de 50 ms): 12, 12 por minuto · la página ocupada en 2 (código 50% · estilo y diseño 20% · otro 30%)',
    );
  });

  it('sin tirones lo dice', () => {
    const log = new MatchPerfLog();
    log.start(1.5);
    play(log, 16, 30);
    expect(log.summary(true)).toContain('Tirones (cuadros de más de 50 ms): ninguno');
  });

  it('si el celular frena la pantalla a 30, lo dice (para no buscar el lag en el juego)', () => {
    const log = new MatchPerfLog();
    log.start(1.5, 'alta', true);
    play(log, 33.3, 60);
    expect(log.summary(true)).toContain(
      'Pantalla frenada a 30 fps por el celular (¿Modo de bajo consumo?)',
    );
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

  it('separa la lógica, el dibujo y la espera, y dice qué frena', () => {
    const log = new MatchPerfLog();
    log.start(2, 'liviana');
    for (let t = 0; t < 30_000; t += 25) {
      log.frame(25, { simMs: 2, jsMs: 8, calls: 180, triangles: 90_000 });
    }
    log.qualityChanged('alta');
    const lines = log.summary(true);
    expect(lines).toContain(
      'Por cuadro: lógica 2.0 ms · dibujo 6.0 ms · espera 17.0 ms (frena la tarjeta gráfica)',
    );
    expect(lines).toContain('Dibujos por cuadro 180 · 90 mil triángulos');
    expect(lines).toContain('Calidad: Liviana; Alta en 0:30');
  });

  it('cuenta lo que hubo en pantalla y si la memoria gráfica creció', () => {
    const log = new MatchPerfLog();
    log.start(1.5);
    for (let t = 0; t < 10_000; t += 16) {
      const geometries = 200 + Math.floor(t / 1000);
      log.frame(16, {
        simMs: 1,
        jsMs: 6,
        calls: 300,
        triangles: 60_000,
        spells: t < 5000 ? 4 : 12,
        particles: 350,
        geometries,
        textures: 20,
        programs: 54,
      });
    }
    const lines = log.summary(true);
    expect(lines).toContain('En pantalla: hasta 12 conjuros y 350 partículas');
    expect(lines).toContain(
      'Memoria gráfica: geometrías 200→209 (máx. 209) · texturas 20→20 · sombreadores 54→54',
    );
  });

  it('dice en qué momento, con cuántos conjuros y en qué tramo de 10 s hubo tirones', () => {
    const log = new MatchPerfLog();
    log.start(1.5);
    const work = (spells: number) => ({ simMs: 0.1, jsMs: 2, calls: 100, triangles: 1, spells });
    // 20 s de Caza tranquila, luego 20 s de Muerte súbita con 12 conjuros y un tirón por segundo.
    for (let t = 0; t < 20_000; t += 20) log.frame(20, work(2), 'Caza');
    for (let s = 0; s < 20; s++) {
      for (let t = 0; t < 900; t += 20) log.frame(20, work(12), 'Muerte súbita');
      log.frame(100, work(12), 'Muerte súbita');
    }
    const lines = log.summary(true);
    expect(lines).toContain('Tirones por momento: Caza 0 (0/min) · Muerte súbita 20 (60/min)');
    expect(lines).toContain('Tirones según conjuros en pantalla: 0 a 4: 0/min · 10 a 14: 60/min');
    expect(lines.at(-1)).toBe('Cada 10 s (fps/tirones/conjuros): 50/0/2 50/0/2 46/10/12 46/10/12');
  });
});
