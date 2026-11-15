import { type RoomServer, roomServerOf } from '@crisol/protocol';

/**
 * Dónde están los servidores. Hay dos:
 *
 * - El Worker de Cloudflare: recibe el registro de errores y también tiene Salas, pero Cloudflare
 *   las crea en el este de Norteamérica (150 a 250 ms de ida y vuelta desde Chile).
 * - El servidor de salas de Santiago (docs/servidor-santiago.md): las mismas Salas, cerca de los
 *   amigos. Si está configurado, las salas van ahí.
 *
 * Si Santiago no contesta o está lleno, las salas nuevas se crean solas en Cloudflare, con un
 * código que empieza con número (`roomServerOf`): quien entre con ese código o enlace va directo
 * a Cloudflare. Las de código con letra van a Santiago, salvo que no conteste (docs/carga.md).
 *
 * `VITE_SERVER_URL` cambia el Worker al armar el juego (en desarrollo apunta al `wrangler dev`
 * local). `?sala=cloudflare` en la dirección fuerza las Salas de Cloudflare.
 */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

const SERVER_URL: string =
  (env.VITE_SERVER_URL as string | undefined) ??
  (env.DEV ? 'http://localhost:8787' : 'https://crisol-server.tomasrojasmurua.workers.dev');

/** El servidor de salas de Santiago (vacío: todas las salas van a Cloudflare). */
const SANTIAGO_URL = 'https://34-176-182-249.sslip.io';

/** Se lee al cargar la página, antes de que el menú limpie la dirección. */
const FORCE_CLOUDFLARE = /[?&]sala=cloudflare\b/.test(globalThis.location?.search ?? '');

/** Si hay que preguntarle a Santiago (no en desarrollo ni con el Worker cambiado a mano). */
const SANTIAGO_ENABLED = Boolean(SANTIAGO_URL) && !env.VITE_SERVER_URL && !env.DEV;

/** Cuánto se espera la respuesta de Santiago antes de darlo por caído. */
const HEALTH_TIMEOUT_MS = 2500;
/** Cuánto vale lo que se supo de Santiago. */
const HEALTH_FRESH_MS = 15_000;

interface SantiagoStatus {
  /** Contesta. */
  readonly up: boolean;
  /** Contesta, pero no le caben salas nuevas. */
  readonly full: boolean;
}

let lastCheck: { at: number; status: Promise<SantiagoStatus> } | null = null;

/** Pregunta a Santiago cómo está (una vez cada `HEALTH_FRESH_MS`). */
function santiagoStatus(): Promise<SantiagoStatus> {
  const now = Date.now();
  if (lastCheck && now - lastCheck.at < HEALTH_FRESH_MS) return lastCheck.status;
  const status = fetch(`${SANTIAGO_URL}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    .then(async (response) => {
      if (!response.ok) return { up: false, full: false };
      const body = (await response.json()) as { full?: unknown };
      return { up: true, full: body.full === true };
    })
    .catch(() => ({ up: false, full: false }));
  lastCheck = { at: now, status };
  return status;
}

/**
 * Pregunta a Santiago apenas abre el juego, para que al crear o entrar a una sala ya se sepa (y
 * de paso la conexión segura queda abierta).
 */
export function warmUpRooms(): void {
  if (SANTIAGO_ENABLED && !FORCE_CLOUDFLARE) void santiagoStatus();
}

/** El servidor elegido para cada sala: las reconexiones vuelven al mismo. */
const chosen = new Map<string, string>();

/** Dónde se juega una sala si no se eligió antes (Santiago si está configurado). */
function defaultUrl(code: string): string {
  if (!SANTIAGO_ENABLED || FORCE_CLOUDFLARE || roomServerOf(code) === 'fallback') {
    return SERVER_URL;
  }
  return SANTIAGO_URL;
}

/**
 * Elige el servidor de una sala antes de conectarse: la de código con número va a Cloudflare; la
 * de letra, a Santiago si contesta (si no, a Cloudflare, adonde llegarán también sus amigos
 * mientras Santiago siga caído).
 */
export async function chooseRoomServer(code: string): Promise<void> {
  let url = defaultUrl(code);
  if (url === SANTIAGO_URL && !(await santiagoStatus()).up) url = SERVER_URL;
  chosen.set(code, url);
}

/** Dónde crear una sala nueva: en Santiago si contesta y le caben salas; si no, en Cloudflare. */
export async function newRoomServer(): Promise<RoomServer> {
  if (!SANTIAGO_ENABLED) return 'main';
  if (FORCE_CLOUDFLARE) return 'fallback';
  const status = await santiagoStatus();
  return status.up && !status.full ? 'main' : 'fallback';
}

/** La dirección del socket de una sala. */
export function roomSocketUrl(code: string): string {
  const url = chosen.get(code) ?? defaultUrl(code);
  return `${url.replace(/^http/, 'ws')}/api/rooms/${code}/socket`;
}

/**
 * Dónde pedir una Partida rápida, en orden: Santiago si contesta (aunque esté lleno puede tener
 * una sala esperando gente; si haría falta una nueva, contesta 503) y Cloudflare de respaldo.
 */
export async function quickMatchUrls(): Promise<string[]> {
  const cloudflare = `${SERVER_URL}/api/quick`;
  if (!SANTIAGO_ENABLED || FORCE_CLOUDFLARE || !(await santiagoStatus()).up) return [cloudflare];
  return [`${SANTIAGO_URL}/api/quick`, cloudflare];
}

/** Qué servidor de salas usa esa sala, para el registro de errores. */
export function roomsServerName(code: string): string {
  return (chosen.get(code) ?? defaultUrl(code)) === SANTIAGO_URL ? 'Santiago' : 'Cloudflare';
}

/** Dónde se respalda el perfil (ver platform/backup.ts). */
export function profileBackupUrl(): string {
  return `${SERVER_URL}/api/perfil`;
}

/** Dónde se mandan los informes de errores (ver platform/ErrorReporter.ts). */
export function errorReportUrl(): string {
  return `${SERVER_URL}/api/errors`;
}
