import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
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
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.88);
    this.composer.addPass(this.bloom);
    // El toque de color va dentro de la pasada final (tono y sRGB) y no en una pasada aparte:
    // cada pasada de pantalla completa lee y escribe todos los píxeles, y en un Android de gama
    // media esa sola pasada era cerca de un 12% del cuadro con calidad Alta.
    const output = new OutputPass();
    output.material.fragmentShader = withGrade(output.material.fragmentShader);
    this.composer.addPass(output);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    // El resplandor se calcula a media resolución: casi no se nota y cuesta mucho menos.
    this.bloom.resolution.set(width / 2, height / 2);
  }

  /**
   * Dónde se dibuja la escena: en Alta, en la textura intermedia del resplandor (color lineal y
   * sin tono, que se aplica al final); en Liviana, directo en la pantalla. Los sombreadores
   * dependen de eso, así que se compilan de antemano apuntando aquí (ver `ShaderWarmup`).
   */
  get sceneTarget(): THREE.WebGLRenderTarget | null {
    return this.enabled ? this.composer.renderTarget1 : null;
  }

  render(): void {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

/**
 * Toque final de color, en la misma pasada que el tono y el sRGB: bordes oscuros (viñeta) que
 * centran la mirada y además ayudan a leer el HUD de las esquinas, sombras teñidas de violeta
 * frío y un poco más de contraste. Las zonas iluminadas (magia, velas) quedan intactas. Se aplica
 * sobre el color ya en sRGB, igual que cuando era una pasada aparte.
 */
const GRADE = /* glsl */ `
  {
    vec4 color = clamp(gl_FragColor, 0.0, 1.0);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float shadow = 1.0 - smoothstep(0.0, 0.45, lum);
    color.rgb = mix(color.rgb, color.rgb * vec3(0.9, 0.88, 1.1), shadow);
    color.rgb = clamp((color.rgb - 0.5) * 1.06 + 0.5, 0.0, 1.0);
    vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
    float vignette = smoothstep(0.8, 0.3, length(d));
    color.rgb *= mix(0.5, 1.0, vignette);
    gl_FragColor = color;
  }
`;

/** Agrega el toque de color al final del sombreador de la pasada de salida de three.js. */
function withGrade(fragmentShader: string): string {
  const end = fragmentShader.lastIndexOf('}');
  if (end < 0) return fragmentShader;
  return `${fragmentShader.slice(0, end)}${GRADE}}`;
}
