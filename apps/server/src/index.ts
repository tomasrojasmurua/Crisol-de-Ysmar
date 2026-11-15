import { isValidRoomCode } from '@crisol/protocol';
import type { Env } from './env';
import { receiveReports } from './errorLog';
import { handleProfile } from './profiles';
import { generateRoomCode } from './roomCode';

export { Room } from './room';

const ROOM_SOCKET_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/socket$/;

/** Worker de entrada: crea salas y conecta cada celular con su Sala. */
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (
      url.pathname === '/api/errors' &&
      (request.method === 'POST' || request.method === 'OPTIONS')
    ) {
      return receiveReports(request, env.ERRORS, (task) => ctx.waitUntil(task));
    }

    if (url.pathname === '/api/perfil' || url.pathname === '/api/perfil/leer') {
      return handleProfile(request, env.PROFILES, url.pathname.endsWith('/leer'));
    }

    if (
      url.pathname === '/api/quick' &&
      (request.method === 'POST' || request.method === 'OPTIONS')
    ) {
      // Respaldo de Cloudflare: sin un lugar común donde ver las salas abiertas, cada Partida
      // rápida es una sala nueva (la vuelve pública el primero que entra, ver DuelHost.makeQuick).
      // La de verdad, que junta desconocidos, es la del servidor de Santiago. El código empieza
      // con número: dice que la sala vive aquí (ver `roomServerOf`).
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      };
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      const roomCode = generateRoomCode((array) => crypto.getRandomValues(array), 'fallback');
      return Response.json({ roomCode }, { headers });
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const roomCode = generateRoomCode((array) => crypto.getRandomValues(array), 'fallback');
      return Response.json({ roomCode }, { status: 201 });
    }

    const socketMatch = ROOM_SOCKET_PATH.exec(url.pathname);
    if (socketMatch?.[1] && isValidRoomCode(socketMatch[1])) {
      // Las salas son entre amigos en Chile: se crean en Sudamérica.
      const room = env.ROOMS.get(env.ROOMS.idFromName(socketMatch[1]), { locationHint: 'sam' });
      return room.fetch(request);
    }

    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
