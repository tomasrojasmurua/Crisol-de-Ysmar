/**
 * Sobre esto (ms entre llamadas de la pantalla) el celular está entregando ~30 cuadros por
 * segundo o menos aunque el juego no le pida nada: el Modo de bajo consumo del iPhone (y el
 * ahorro de batería de algunos Android) frena el navegador a 30.
 */
const CAPPED_MS = 27;
/** Bajo esto vuelve a ser una pantalla normal (60 Hz o más). El margen evita que parpadee. */
const FREE_MS = 22;
/** Llamadas de la pantalla seguidas que hacen falta para decidir: alrededor de un segundo. */
const SAMPLES_TO_DECIDE = 30;

/**
 * Se da cuenta de cuándo el celular limita la pantalla a 30 cuadros por segundo. Se mide solo en
 * menús: ahí el juego dibuja uno de cada dos cuadros y casi no trabaja, así que si la pantalla
 * igual llama cada 33 ms, el freno es del celular y no del juego. En partida no se puede medir
 * así, porque un celular que no alcanza a dibujar también llama más lento.
 *
 * Con el freno puesto, 30 cuadros por segundo es lo más que se puede: bajar la resolución o pasar
 * a Gráficos livianos no lo mejora, solo empeora la imagen y da tirones al cambiar.
 */
export class ScreenCap {
  private isCapped = false;
  private streak = 0;

  /** Si la pantalla está limitada a 30 cuadros por segundo. */
  get capped(): boolean {
    return this.isCapped;
  }

  /** `screenMs`: cada cuánto llama la pantalla, medido en un menú. */
  sample(screenMs: number): void {
    if (screenMs <= 0) return;
    const looksCapped = this.isCapped ? screenMs > FREE_MS : screenMs > CAPPED_MS;
    if (looksCapped === this.isCapped) {
      this.streak = 0;
      return;
    }
    if (++this.streak < SAMPLES_TO_DECIDE) return;
    this.isCapped = looksCapped;
    this.streak = 0;
  }

  /**
   * Un cuadro de partida visto como si la pantalla no tuviera freno: con tope de 30, 33 ms es ir
   * a tope (vale lo que 16,7 ms en una pantalla de 60 Hz). Así la resolución y la calidad
   * automáticas solo reaccionan cuando el juego de verdad va más lento que lo que permite el
   * celular.
   */
  judged(frameMs: number): number {
    return this.isCapped ? frameMs / 2 : frameMs;
  }
}
