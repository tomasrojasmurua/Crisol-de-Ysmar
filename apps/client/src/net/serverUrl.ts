/**
 * Dónde está el servidor de las salas. Se puede cambiar con `VITE_SERVER_URL` al armar el juego;
 * en desarrollo apunta al `wrangler dev` local.
 */
export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://crisol-server.tomasrojasmurua.workers.dev');

/** La dirección del socket de una sala. */
export function roomSocketUrl(code: string): string {
  return `${SERVER_URL.replace(/^http/, 'ws')}/api/rooms/${code}/socket`;
}
