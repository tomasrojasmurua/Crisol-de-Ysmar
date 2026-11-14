/**
 * Dónde están los servidores. Hay dos:
 *
 * - El Worker de Cloudflare: recibe el registro de errores y también tiene Salas, pero Cloudflare
 *   las crea en el este de Norteamérica (150 a 250 ms de ida y vuelta desde Chile).
 * - El servidor de salas de Santiago (docs/servidor-santiago.md): las mismas Salas, cerca de los
 *   amigos. Si está configurado, las salas van ahí.
 *
 * `VITE_SERVER_URL` cambia el Worker al armar el juego (en desarrollo apunta al `wrangler dev`
 * local). `?sala=cloudflare` en la dirección fuerza las Salas de Cloudflare, por si el servidor
 * de Santiago no responde.
 */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

const SERVER_URL: string =
  (env.VITE_SERVER_URL as string | undefined) ??
  (env.DEV ? 'http://localhost:8787' : 'https://crisol-server.tomasrojasmurua.workers.dev');

/** El servidor de salas de Santiago (vacío: todas las salas van a Cloudflare). */
const SANTIAGO_URL = 'https://34-176-182-249.sslip.io';

/** Se lee al cargar la página, antes de que el menú limpie la dirección. */
const FORCE_CLOUDFLARE = /[?&]sala=cloudflare\b/.test(globalThis.location?.search ?? '');

/** Dónde se juegan las salas. */
function roomsUrl(): string {
  if (env.VITE_SERVER_URL || env.DEV || FORCE_CLOUDFLARE || !SANTIAGO_URL) return SERVER_URL;
  return SANTIAGO_URL;
}

/** La dirección del socket de una sala. */
export function roomSocketUrl(code: string): string {
  return `${roomsUrl().replace(/^http/, 'ws')}/api/rooms/${code}/socket`;
}

/** Qué servidor de salas se usa, para el registro de errores. */
export function roomsServerName(): string {
  return roomsUrl() === SANTIAGO_URL ? 'Santiago' : 'Cloudflare';
}

/** Dónde se mandan los informes de errores (ver platform/ErrorReporter.ts). */
export function errorReportUrl(): string {
  return `${SERVER_URL}/api/errors`;
}
