import { describe, expect, it } from 'vitest';
import { TEST_RULES } from '../testing/rules.fixture';
import { buildPayload } from './payload';

describe('buildPayload', () => {
  it('el primer elemento da la forma y los siguientes la modifican', () => {
    const payload = buildPayload(['brasa', 'tormenta'], TEST_RULES);
    expect(payload?.form).toBe('projectile');
    expect(payload?.speedMultiplier).toBe(2);
    expect(payload?.damage).toBe(10);
    expect(payload?.hasStorm).toBe(true);
  });

  it('suma los estados de la forma y de los modificadores sin repetir', () => {
    const payload = buildPayload(['marea', 'brasa', 'marea'], TEST_RULES);
    expect(payload?.form).toBe('wall');
    expect(payload?.statuses).toEqual(['slow', 'burn']);
    expect(payload?.damage).toBe(7.5);
  });

  it('el orden cambia el conjuro', () => {
    expect(buildPayload(['brasa', 'marea'], TEST_RULES)?.form).toBe('projectile');
    expect(buildPayload(['marea', 'brasa'], TEST_RULES)?.form).toBe('wall');
  });

  it('un tejido vacío no produce conjuro', () => {
    expect(buildPayload([], TEST_RULES)).toBeNull();
  });
});
