import type { MatchLog } from '@crisol/protocol';
import { matchLogUrl } from '../net/serverUrl';

/**
 * Manda el registro de una partida contra la IA al servidor, una sola vez por partida (ver
 * docs/partidas.md). Sin nombres ni nada del celular. Si no hay red se pierde y da igual: es
 * para aprender combinaciones, no progreso del jugador.
 */

/** Las partidas ya mandadas en esta visita (volver al resultado no la manda otra vez). */
const sent = new Set<string>();
/** Hasta este tamaño se manda con `keepalive` (llega aunque se cierre la app); el navegador no deja más. */
const KEEPALIVE_BYTES = 60_000;

export function sendMatchLog(id: string, log: MatchLog): void {
  // Las pruebas automáticas (Playwright) no ensucian los datos.
  if (sent.has(id) || typeof fetch !== 'function' || globalThis.navigator?.webdriver) return;
  sent.add(id);
  const body = JSON.stringify(log);
  // Texto plano: el navegador no pregunta antes ("preflight").
  void fetch(matchLogUrl(), {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'text/plain' },
    keepalive: body.length <= KEEPALIVE_BYTES,
  }).catch(() => {});
}
