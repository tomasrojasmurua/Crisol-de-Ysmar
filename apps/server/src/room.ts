import { DurableObject } from 'cloudflare:workers';
import {
  type ClientMessage,
  decodeClientMessage,
  encode,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@crisol/protocol';
import type { Env } from './env';

/**
 * Una Sala es un pequeño servidor propio por partida.
 * Hito 0: acepta conexiones y responde saludos y pings.
 * Hito 2: corre el núcleo y reparte el estado a todos los celulares.
 */
export class Room extends DurableObject<Env> {
  private nextPlayerId = 1;

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const message = typeof raw === 'string' ? decodeClientMessage(raw) : null;
    if (!message) {
      send(socket, { type: 'error', reason: 'Mensaje no reconocido' });
      return;
    }
    this.handle(socket, message);
  }

  private handle(socket: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'hello':
        if (message.protocol !== PROTOCOL_VERSION) {
          send(socket, { type: 'error', reason: 'Versión del juego desactualizada' });
          return;
        }
        send(socket, {
          type: 'welcome',
          roomCode: this.ctx.id.name ?? '',
          playerId: this.nextPlayerId++,
        });
        return;
      case 'ping':
        send(socket, { type: 'pong', sentAt: message.sentAt });
        return;
      case 'intents':
        // Hito 2: las intenciones alimentan la simulación.
        return;
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(encode(message));
}
