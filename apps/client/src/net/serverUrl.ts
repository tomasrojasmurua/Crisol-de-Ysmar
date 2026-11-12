/**
 * Dónde está el servidor de las salas. Se puede cambiar con `VITE_SERVER_URL` al armar el juego;
 * en desarrollo apunta al `wrangler dev` local.
 */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

const SERVER_URL: string =
  (env.VITE_SERVER_URL as string | undefined) ??
  (env.DEV ? 'http://localhost:8787' : 'https://crisol-server.tomasrojasmurua.workers.dev');

/** La dirección del socket de una sala. */
export function roomSocketUrl(code: string): string {
  return `${SERVER_URL.replace(/^http/, 'ws')}/api/rooms/${code}/socket`;
}

/** Dónde se mandan los informes de errores (ver platform/ErrorReporter.ts). */
export function errorReportUrl(): string {
  return `${SERVER_URL}/api/errors`;
}
