import { describe, expect, it } from 'vitest';
import { isModestGpu } from './gpuTier';

describe('isModestGpu', () => {
  it('los Galaxy A con Mali van al perfil fluido, aunque el navegador no diga Android', () => {
    expect(isModestGpu('ANGLE (ARM, Mali-G68 MC4, OpenGL ES 3.2)')).toBe(true);
    expect(isModestGpu('Mali-G57 MC2')).toBe(true);
    expect(isModestGpu('PowerVR Rogue GE8320')).toBe(true);
  });

  it('Adreno de gama media sí, Adreno de los Galaxy S no', () => {
    expect(isModestGpu('Adreno (TM) 619')).toBe(true);
    expect(isModestGpu('ANGLE (Qualcomm, Adreno (TM) 830, OpenGL ES 3.2)')).toBe(false);
    expect(isModestGpu('Adreno (TM) 740')).toBe(false);
  });

  it('el iPhone y los computadores siguen con el perfil completo', () => {
    expect(isModestGpu('Apple GPU')).toBe(false);
    expect(isModestGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, D3D11)')).toBe(false);
    expect(isModestGpu('')).toBe(false);
  });
});
