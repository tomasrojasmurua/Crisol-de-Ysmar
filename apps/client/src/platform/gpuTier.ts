/**
 * Qué tarjeta gráfica tiene el celular, para elegir de entrada un perfil que ande parejo.
 *
 * Los Android de gama media (Galaxy A34 y A35, con Mali) iban lentos o con tirones aun en
 * Liviana: la calidad y la resolución se iban ajustando en plena pelea, y cada ajuste también
 * traba un cuadro. Con estas tarjetas se parte ya en lo liviano: Liviana, nitidez 1 y la mitad de
 * chispas. Tomás prefiere siempre fluidez antes que detalle (21 de noviembre).
 */
export interface GpuInfo {
  /** Como la nombra el navegador ("ANGLE (ARM, Mali-G68 MC4, OpenGL ES 3.2)"), o vacío. */
  readonly name: string;
  /** Si conviene el perfil fluido (ver `isModestGpu`). */
  readonly modest: boolean;
}

let cached: GpuInfo | null = null;

/** Lee la tarjeta gráfica una sola vez, con un lienzo aparte que se suelta enseguida. */
export function gpuInfo(): GpuInfo {
  if (cached) return cached;
  let name = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Sin WebGL el juego no arranca igual; aquí basta no romper.
  }
  cached = { name, modest: isModestGpu(name) };
  return cached;
}

/**
 * Tarjeta Mali, PowerVR o Adreno de las series 500 y 600 (la gama media y baja de los Android).
 * Los Adreno 700 y 800 (Galaxy S) y los iPhone siguen con el perfil completo. No se mira si el
 * navegador dice "Android": Samsung Internet se presenta como Linux de escritorio, y así el
 * Galaxy con Mali-G68 de la prueba del 21 de noviembre (sala XGRH) quedó con el perfil completo.
 */
export function isModestGpu(name: string): boolean {
  if (/Mali|PowerVR|IMG/i.test(name)) return true;
  const adreno = /Adreno[^\d]*(\d{3})/i.exec(name);
  return adreno?.[1] !== undefined && Number(adreno[1]) < 700;
}
