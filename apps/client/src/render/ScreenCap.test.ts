import { describe, expect, it } from 'vitest';
import { ScreenCap } from './ScreenCap';

function feed(cap: ScreenCap, screenMs: number, times: number): void {
  for (let i = 0; i < times; i++) cap.sample(screenMs);
}

describe('ScreenCap', () => {
  it('una pantalla de 60 Hz no está limitada y los cuadros se juzgan tal cual', () => {
    const cap = new ScreenCap();
    feed(cap, 16.7, 120);
    expect(cap.capped).toBe(false);
    expect(cap.judged(33)).toBe(33);
  });

  it('en Modo de bajo consumo (30 Hz) se da cuenta en un segundo y 33 ms cuenta como a tope', () => {
    const cap = new ScreenCap();
    feed(cap, 33.3, 29);
    expect(cap.capped).toBe(false);
    feed(cap, 33.3, 1);
    expect(cap.capped).toBe(true);
    // A tope del freno: ni la resolución ni la calidad automáticas deben bajar.
    expect(cap.judged(33.3)).toBeLessThan(17.5);
    // Más lento que el freno sí cuenta como lento.
    expect(cap.judged(50)).toBeGreaterThan(20);
  });

  it('un tirón suelto no lo cambia, y al apagar el bajo consumo vuelve a lo normal', () => {
    const cap = new ScreenCap();
    feed(cap, 16.7, 10);
    feed(cap, 40, 5);
    feed(cap, 16.7, 10);
    expect(cap.capped).toBe(false);
    feed(cap, 33.3, 40);
    expect(cap.capped).toBe(true);
    // Entre 22 y 27 ms no se decide nada: queda como estaba.
    feed(cap, 24, 60);
    expect(cap.capped).toBe(true);
    feed(cap, 16.7, 30);
    expect(cap.capped).toBe(false);
  });
});
