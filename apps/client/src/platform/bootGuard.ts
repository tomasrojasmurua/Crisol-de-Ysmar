/**
 * La otra mitad del guardia de arranque de `index.html`.
 *
 * Si el código del juego no llega (por ejemplo, el ícono de inicio del iPhone abrió una copia
 * vieja de la página que pide un archivo de una versión que ya no existe), la página se recarga
 * sola una vez y anota por qué. Al arrancar bien, el juego avisa al guardia, quita la marca de
 * la dirección y devuelve el motivo para que quede en el registro de errores.
 */

/** Lo que anota el guardia en `index.html` antes de recargar (misma clave allá). */
const RETRY_KEY = 'crisol.arranque';
/** Lo que agrega el guardia a la dirección para no recibir la copia vieja otra vez. */
const RETRY_PARAM = 'recarga';

/** El juego arrancó. Devuelve el motivo si antes hubo que recargar, o null. */
export function confirmBoot(): string | null {
  (window as Window & { crisolBooted?: boolean }).crisolBooted = true;
  let reason: string | null = null;
  try {
    reason = sessionStorage.getItem(RETRY_KEY);
    sessionStorage.removeItem(RETRY_KEY);
  } catch {
    // Sin almacenamiento el guardia tampoco pudo anotar nada.
  }
  const url = new URL(location.href);
  if (url.searchParams.has(RETRY_PARAM)) {
    url.searchParams.delete(RETRY_PARAM);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  return reason;
}
