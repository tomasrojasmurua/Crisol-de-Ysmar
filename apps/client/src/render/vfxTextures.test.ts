import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { textureView } from './vfxTextures';

describe('textureView', () => {
  it('comparte la imagen sin marcarla para volver a subirla', () => {
    const base = new THREE.Texture();
    base.needsUpdate = true;
    const version = base.source.version;
    const view = textureView(base);
    view.repeat.set(0.5, 0.5);
    expect(view.source).toBe(base.source);
    expect(base.source.version).toBe(version);
    expect(base.repeat.x).toBe(1);
  });

  it('con clone() de three.js la imagen sí se marcaba (por eso existe textureView)', () => {
    const base = new THREE.Texture();
    const version = base.source.version;
    base.clone();
    expect(base.source.version).toBe(version + 1);
  });
});
