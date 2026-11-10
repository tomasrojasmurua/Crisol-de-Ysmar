import { DurableObject } from 'cloudflare:workers';
import { TICK_MS } from '@crisol/core';
import {
  type ClientMessage,
  decodeClientMessage,
  encode,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@crisol/protocol';
import { DuelHost } from './duel';
import type { Env } from './env';

/** Lo que la Sala recuerda de cada socket (sobrevive a que la Sala se duerma). */
interface Attachment {
  playerId: number;
}

/** Mientras no se juega (sala de espera, final), el estado se manda cada tantos pasos. */
const IDLE_SEND_EVERY = 10;
/** Si el reloj se atrasa (la Sala estuvo ocupada), no se recuperan más de estos pasos de golpe. */
const MAX_CATCH_UP = 4;

/**
 * Una Sala es un pequeño servidor propio por partida: corre el núcleo a 30 pasos por segundo y
 * manda el estado completo a los dos celulares en cada paso. Los celulares solo mandan lo que
 * tocan. Si alguien se desconecta, la IA juega por él hasta que vuelva con su token.
 */
export class Room extends DurableObject<Env> {
  private host: DuelHost | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private clock = 0;
  private sentTicks = 0;
  private lastStage = '';

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

  override async webSocketClose(socket: WebSocket): Promise<void> {
    this.drop(socket);
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    this.drop(socket);
  }

  private get duel(): DuelHost {
    if (!this.host) {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
      this.host = new DuelHost(seed, () => crypto.randomUUID());
    }
    return this.host;
  }

  private handle(socket: WebSocket, message: ClientMessage): void {
    const playerId = (socket.deserializeAttachment() as Attachment | null)?.playerId;
    switch (message.type) {
      case 'hello': {
        if (message.protocol !== PROTOCOL_VERSION) {
          send(socket, {
            type: 'error',
            reason: 'Versión del juego desactualizada: recarga la página',
          });
          return;
        }
        const joined = this.duel.join({
          name: message.playerName,
          look: message.look,
          affinity: message.affinity,
          token: message.token,
        });
        if (!joined) {
          send(socket, { type: 'error', reason: 'La sala ya tiene dos jugadores' });
          socket.close(4001, 'Sala llena');
          return;
        }
        // Si el mismo jugador tenía otro socket abierto, se cierra el viejo.
        for (const other of this.ctx.getWebSockets()) {
          const owner = (other.deserializeAttachment() as Attachment | null)?.playerId;
          if (other !== socket && owner === joined.playerId) other.close(4002, 'Reemplazado');
        }
        socket.serializeAttachment({ playerId: joined.playerId } satisfies Attachment);
        send(socket, {
          type: 'welcome',
          roomCode: this.ctx.id.name ?? '',
          playerId: joined.playerId,
          token: joined.token,
        });
        this.broadcastPlayers();
        // Si la partida ya iba (volvió alguien), se le presenta; si recién empieza, avisa el reloj.
        if (!this.duel.inLobby && !this.duel.startedNew) this.announceStart(socket);
        this.ensureClock();
        return;
      }
      case 'ping':
        send(socket, { type: 'pong', sentAt: message.sentAt });
        return;
      case 'intents':
        if (playerId !== undefined) this.duel.intents(playerId, message.intents);
        return;
      case 'glyph':
        if (playerId !== undefined) this.duel.chooseGlyph(playerId, message.glyphId);
        return;
      case 'rematch':
        if (playerId !== undefined) this.duel.rematch(playerId);
        return;
    }
  }

  private drop(socket: WebSocket): void {
    const playerId = (socket.deserializeAttachment() as Attachment | null)?.playerId;
    if (playerId === undefined || !this.host) return;
    // Si ese jugador ya volvió por otro socket, no se lo marca como ido.
    const stillHere = this.ctx
      .getWebSockets()
      .some(
        (other) =>
          other !== socket &&
          (other.deserializeAttachment() as Attachment | null)?.playerId === playerId,
      );
    if (stillHere) return;
    this.host.leave(playerId);
    this.broadcastPlayers();
    if (this.host.connectedCount === 0) this.stopClock();
  }

  private ensureClock(): void {
    if (this.timer) return;
    this.clock = Date.now();
    this.timer = setInterval(() => this.onClock(), TICK_MS);
  }

  private stopClock(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private onClock(): void {
    const duel = this.host;
    if (!duel) return;
    const now = Date.now();
    let due = Math.floor((now - this.clock) / TICK_MS);
    if (due > MAX_CATCH_UP) {
      this.clock = now - MAX_CATCH_UP * TICK_MS;
      due = MAX_CATCH_UP;
    }
    for (let i = 0; i < due; i++) {
      this.clock += TICK_MS;
      duel.tick();
      if (duel.startedNew) {
        duel.startedNew = false;
        for (const socket of this.ctx.getWebSockets()) this.announceStart(socket);
      }
      this.broadcastState();
    }
  }

  private announceStart(socket: WebSocket): void {
    if (!this.host) return;
    send(socket, { type: 'start', omenId: this.host.omenId, players: this.host.players });
  }

  private broadcastPlayers(): void {
    if (!this.host) return;
    const message = encode({ type: 'players', players: this.host.players });
    for (const socket of this.ctx.getWebSockets()) trySend(socket, message);
  }

  /** El estado del paso, una sola vez a texto; solo cambia la etapa de cada jugador. */
  private broadcastState(): void {
    const duel = this.host;
    if (!duel?.state) return;
    this.sentTicks++;
    // Jugando va cada paso; en las pausas, de a ratos, salvo cuando cambia la etapa.
    const stage = `${duel.stageFor(1).kind}|${duel.stageFor(2).kind}`;
    const changed = stage !== this.lastStage;
    this.lastStage = stage;
    const playing = duel.stageFor(1).kind === 'playing';
    if (!playing && !changed && this.sentTicks % IDLE_SEND_EVERY !== 0) return;
    const state = JSON.stringify(duel.state);
    const series = JSON.stringify(duel.seriesInfo());
    for (const socket of this.ctx.getWebSockets()) {
      const playerId = (socket.deserializeAttachment() as Attachment | null)?.playerId;
      if (playerId === undefined) continue;
      const stage = JSON.stringify(duel.stageFor(playerId));
      // Se arma a mano para no convertir el estado a texto una vez por jugador.
      trySend(socket, `{"type":"state","stage":${stage},"state":${state},${series.slice(1)}`);
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  trySend(socket, encode(message));
}

function trySend(socket: WebSocket, text: string): void {
  try {
    socket.send(text);
  } catch {
    // El socket se está cerrando: lo resuelve webSocketClose.
  }
}
