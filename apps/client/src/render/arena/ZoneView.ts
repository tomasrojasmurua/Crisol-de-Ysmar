import * as THREE from 'three';

/**
 * La zona segura: un velo de la Trama que se cierra en la Convergencia.
 * Afuera, el suelo se oscurece para que se note dónde no hay que estar.
 */
export class ZoneView {
  readonly group = new THREE.Group();
  private readonly veilMaterial: THREE.ShaderMaterial;
  private readonly veil: THREE.Mesh;
  private readonly shadeMaterial: THREE.ShaderMaterial;

  /**
   * `arenaRadius` es el de la arena más grande (el disco oscuro la cubre entera); la partida
   * dice con `setArenaRadius` desde dónde empieza a cerrarse.
   */
  constructor(private arenaRadius: number) {
    this.veilMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#b49cff') },
        uStrength: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          // Hilos verticales que suben, más intensos abajo.
          float threads = 0.5 + 0.5 * sin(vUv.x * 420.0 + sin(vUv.y * 6.0 + uTime) * 2.0);
          float rise = 0.5 + 0.5 * sin(vUv.y * 18.0 - uTime * 3.0);
          float fade = pow(1.0 - vUv.y, 2.2);
          float alpha = (0.25 + 0.5 * threads * rise) * fade * uStrength;
          gl_FragColor = vec4(uColor * 1.6, alpha);
        }
      `,
    });
    this.veil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 96, 1, true), this.veilMaterial);
    this.veil.position.y = 2.5;

    // Un disco grande que oscurece todo lo que queda fuera de la zona.
    this.shadeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uRadius: { value: arenaRadius } },
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uRadius;
        varying vec2 vPos;
        void main() {
          float outside = smoothstep(uRadius, uRadius + 0.6, length(vPos));
          gl_FragColor = vec4(0.02, 0.0, 0.05, outside * 0.55);
        }
      `,
    });
    const shade = new THREE.Mesh(
      new THREE.CircleGeometry(arenaRadius + 10, 96),
      this.shadeMaterial,
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = 0.03;
    this.group.add(this.veil, shade);
  }

  /** Radio de la arena de esta partida: la zona se ve solo cuando se cierra por debajo de él. */
  setArenaRadius(radius: number): void {
    this.arenaRadius = radius;
  }

  update(radius: number, timeSeconds: number): void {
    const closing = radius < this.arenaRadius - 0.01;
    this.group.visible = closing;
    if (!closing) return;
    // Un radio 0 (muerte súbita) daría una escala nula: se deja un punto.
    const r = Math.max(radius, 0.05);
    this.veil.scale.set(r, 1, r);
    const shadeRadius = this.shadeMaterial.uniforms.uRadius;
    if (shadeRadius) shadeRadius.value = radius;
    const uniforms = this.veilMaterial.uniforms;
    if (uniforms.uTime) uniforms.uTime.value = timeSeconds;
    if (uniforms.uStrength) uniforms.uStrength.value = Math.min(1, (this.arenaRadius - radius) / 2);
  }
}
