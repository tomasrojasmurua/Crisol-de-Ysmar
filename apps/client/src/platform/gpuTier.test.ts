import { describe, expect, it } from 'vitest';
import { isModestGpu } from './gpuTier';

const ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/157.0 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15';

describe('isModestGpu', () => {
  it('los Galaxy A con Mali van al perfil fluido', () => {
    expect(isModestGpu('ANGLE (ARM, Mali-G68 MC4, OpenGL ES 3.2)', ANDROID)).toBe(true);
    expect(isModestGpu('Mali-G57 MC2', ANDROID)).toBe(true);
  });

  it('Adreno de gama media sí, Adreno de los Galaxy S no', () => {
    expect(isModestGpu('Adreno (TM) 619', ANDROID)).toBe(true);
    expect(isModestGpu('ANGLE (Qualcomm, Adreno (TM) 830, OpenGL ES 3.2)', ANDROID)).toBe(false);
    expect(isModestGpu('Adreno (TM) 740', ANDROID)).toBe(false);
  });

  it('el iPhone y los computadores siguen con el perfil completo', () => {
    expect(isModestGpu('Apple GPU', IPHONE)).toBe(false);
    expect(isModestGpu('ANGLE (ARM, Mali-G68)', 'Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
    expect(isModestGpu('', ANDROID)).toBe(false);
  });
});
