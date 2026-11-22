import { describe, expect, it } from 'vitest';
import { turnToward } from './turn';

describe('turnToward', () => {
  it('la primera vez mira directo hacia donde dice el estado', () => {
    expect(turnToward(Number.NaN, 1.2, 0.016)).toBe(1.2);
  });

  it('gira de a poco y llega en unos cuadros', () => {
    let yaw = 0;
    yaw = turnToward(yaw, 1, 1 / 60);
    expect(yaw).toBeGreaterThan(0.2);
    expect(yaw).toBeLessThan(0.5);
    for (let i = 0; i < 20; i++) yaw = turnToward(yaw, 1, 1 / 60);
    expect(yaw).toBeCloseTo(1, 2);
  });

  it('gira por el lado más corto (de casi π a casi -π no da la vuelta entera)', () => {
    const yaw = turnToward(3.1, -3.1, 1 / 60);
    expect(Math.abs(yaw)).toBeGreaterThan(3.1);
  });

  it('a 30 o a 120 cuadros por segundo llega igual de rápido', () => {
    let slow = 0;
    let fast = 0;
    for (let i = 0; i < 3; i++) slow = turnToward(slow, 1, 1 / 30);
    for (let i = 0; i < 12; i++) fast = turnToward(fast, 1, 1 / 120);
    expect(fast).toBeCloseTo(slow, 6);
  });

  it('en pausa no gira', () => {
    expect(turnToward(0.3, 2, 0)).toBe(0.3);
  });
});
