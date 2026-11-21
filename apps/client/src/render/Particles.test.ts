import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Particles } from './Particles';

// Sin navegador no hay imágenes: el atlas es una textura vacía.
vi.mock('./particleAtlas', async (original) => ({
  ...(await original<typeof import('./particleAtlas')>()),
  particleAtlas: () => new THREE.Texture(),
}));

describe('Particles', () => {
  it('sin chispas vivas no sube nada ni se dibuja', () => {
    const particles = new Particles(8);
    const position = particles.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    particles.update(1 / 60);
    const before = position.version;
    particles.update(1 / 60);
    expect(position.version).toBe(before);
    expect(particles.points.visible).toBe(false);
  });

  it('con una chispa viva se dibuja, y el cuadro en que se apaga todavía se sube', () => {
    const particles = new Particles(8);
    const position = particles.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    particles.emit({ x: 0, y: 1, z: 0, color: new THREE.Color('#fff'), life: 0.1, size: 1 });
    particles.update(0.05);
    expect(particles.points.visible).toBe(true);
    const alive = position.version;
    particles.update(0.1);
    expect(particles.points.visible).toBe(true);
    expect(position.version).toBeGreaterThan(alive);
    const dead = position.version;
    particles.update(0.1);
    expect(particles.points.visible).toBe(false);
    expect(position.version).toBe(dead);
  });
});
