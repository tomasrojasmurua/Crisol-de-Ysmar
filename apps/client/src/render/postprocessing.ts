import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Resplandor de la magia: solo lo muy brillante (orbes, conjuros, braseros) se derrama en luz.
 * La escena en sí queda apagada, como pide la dirección de arte.
 */
export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  /** Con gráficos livianos se dibuja directo, sin resplandor ni corrección de color. */
  enabled = true;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(GRADE_SHADER));
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    // El resplandor se calcula a media resolución: casi no se nota y cuesta mucho menos.
    this.bloom.resolution.set(width / 2, height / 2);
  }

  render(): void {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

/**
 * Toque final de color, en una sola pasada barata: bordes oscuros (viñeta) que centran la
 * mirada y además ayudan a leer el HUD de las esquinas, sombras teñidas de violeta frío y un
 * poco más de contraste. Las zonas iluminadas (magia, velas) quedan intactas.
 */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float shadow = 1.0 - smoothstep(0.0, 0.45, lum);
      color.rgb = mix(color.rgb, color.rgb * vec3(0.9, 0.88, 1.1), shadow);
      color.rgb = clamp((color.rgb - 0.5) * 1.06 + 0.5, 0.0, 1.0);
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
      float vignette = smoothstep(0.8, 0.3, length(d));
      color.rgb *= mix(0.5, 1.0, vignette);
      gl_FragColor = color;
    }
  `,
};
