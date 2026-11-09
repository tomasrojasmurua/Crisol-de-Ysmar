import { isValidRoomCode } from '@crisol/protocol';
import type { Env } from './env';
import { generateRoomCode } from './roomCode';

export { Room } from './room';

const ROOM_SOCKET_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/socket$/;

/** Worker de entrada: crea salas y conecta cada celular con su Sala. */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const roomCode = generateRoomCode((array) => crypto.getRandomValues(array));
      return Response.json({ roomCode }, { status: 201 });
    }

    const socketMatch = ROOM_SOCKET_PATH.exec(url.pathname);
    if (socketMatch?.[1] && isValidRoomCode(socketMatch[1])) {
      // Hito 2: ubicar la Sala en Sudamérica con locationHint.
      const room = env.ROOMS.getByName(socketMatch[1]);
      return room.fetch(request);
    }

    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
