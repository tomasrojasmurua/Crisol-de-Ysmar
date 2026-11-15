import { type RoomServer, randomRoomCode } from '@crisol/protocol';

/**
 * Código corto para el enlace de WhatsApp, por ejemplo "K7QF". La primera letra dice en qué
 * servidor vive la sala (ver `roomServerOf`): Santiago da códigos `main` y Cloudflare `fallback`.
 */
export function generateRoomCode(
  randomValues: (array: Uint8Array) => Uint8Array,
  server: RoomServer = 'main',
): string {
  const bytes = randomValues(new Uint8Array(8));
  let i = 0;
  return randomRoomCode(() => (bytes[i++ % bytes.length] ?? 0) / 256, server);
}
