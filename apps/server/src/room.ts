import { DurableObject } from 'cloudflare:workers';
import { PROTOCOL_VERSION } from '@crisol/protocol';
import type { Env } from './env';
import { reportRoomError, saveReports } from './errorLog';
import { type Peer, RoomHost } from './roomHost';

/** Lo que la Sala recuerda de cada socket (sobrevive a que la Sala se duerma). */
interface Attachment {
  playerId: number;
}

/** Un socket de Cloudflare visto como conexión de la Sala; el número va en el adjunto. */
class SocketPeer implements Peer {
  constructor(private readonly socket: WebSocket) {}

  send(data: string | Uint8Array): void {
    this.socket.send(data);
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  get playerId(): number | undefined {
    return (this.socket.deserializeAttachment() as Attachment | null)?.playerId;
  }

  set playerId(id: number | undefined) {
    if (id !== undefined) this.socket.serializeAttachment({ playerId: id } satisfies Attachment);
  }
}

/**
 * La Sala en Cloudflare (Durable Object). Toda la lógica está en `RoomHost`; aquí solo se
 * conectan los sockets de Cloudflare. Ojo: Cloudflare no crea estas Salas en Sudamérica (las
 * manda al este de Norteamérica), por eso existe también el servidor de Santiago (`node/`).
 */
export class Room extends DurableObject<Env> {
  private readonly peers = new WeakMap<WebSocket, SocketPeer>();
  private readonly room = new RoomHost({
    code: this.ctx.id.name ?? '',
    peers: () => this.ctx.getWebSockets().map((socket) => this.peerOf(socket)),
    report: (where, error) =>
      this.ctx.waitUntil(reportRoomError(this.env.ERRORS, this.ctx.id.name ?? '', where, error)),
    perf: ({ message, detail }) => {
      const db = this.env.ERRORS;
      if (!db) return;
      const report = {
        kind: 'servidor' as const,
        message,
        detail,
        version: `protocolo ${PROTOCOL_VERSION}`,
        device: 'servidor Cloudflare',
        screen: '',
        room: this.ctx.id.name ?? '',
        match: '',
        session: '',
        uptime: 0,
      };
      this.ctx.waitUntil(saveReports(db, [report], 'sala', new Date()).catch(() => undefined));
    },
  });

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se esperaba una conexión WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    this.room.message(this.peerOf(socket), raw);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    this.room.closed(this.peerOf(socket));
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    this.room.closed(this.peerOf(socket));
  }

  /** Siempre la misma conexión para el mismo socket (los codificadores se guardan por ella). */
  private peerOf(socket: WebSocket): SocketPeer {
    let peer = this.peers.get(socket);
    if (!peer) {
      peer = new SocketPeer(socket);
      this.peers.set(socket, peer);
    }
    return peer;
  }
}
