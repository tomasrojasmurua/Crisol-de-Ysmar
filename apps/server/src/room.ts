import { DurableObject } from 'cloudflare:workers';
import { TICK_MS } from '@crisol/core';
import {
  type ClientMessage,
  decodeClientMessage,
  encode,
  PROTOCOL_VERSION,
  type ServerMessage,
  StateEncoder,
} from '@crisol/protocol';
import { DuelHost } from './duel';
import type { Env } from './env';
import { reportRoomError } from './errorLog';

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
 * manda a cada celular lo que cambió en cada paso, en binario (el primero va completo). Los celulares solo mandan lo que
 * tocan. Si alguien se desconecta, la IA juega por él hasta que vuelva con su token.
 */
export class Room extends DurableObject<Env> {
  private host: DuelHost | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private clock = 0;
  private sentTicks = 0;
  private lastStage = '';
  private lastAway = '';
  /** Lo último que se le mandó a cada conexión, para mandarle solo lo que cambió. */
  private readonly encoders = new Map<WebSocket, StateEncoder>();
  /** Errores ya anotados: uno que se repite cada paso se guarda una sola vez. */
  private readonly reported = new Set<string>();

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
    try {
      this.handle(socket, message);
    } catch (error) {
      // Un mensaje que falla no tumba la sala: se anota y se sigue.
      this.report(`mensaje ${message.type}`, error);
    }
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
          send(socket, { type: 'error', reason: this.duel.joinError || 'La sala está llena' });
          socket.close(4001, 'Sala llena');
          return;
        }
        // Si la sala creció para hacerle lugar, a quien cambió de puesto se le avisa su número.
        // Va antes de lo que sigue: si no, el socket de otro con el número viejo de este parece
        // un duplicado y se cierra (así se perdía un amigo al crecer la sala).
        this.notifyMoved(this.duel.takeMoved());
        // Si el mismo jugador tenía otro socket abierto, se cierra el viejo.
        for (const other of this.ctx.getWebSockets()) {
          const owner = (other.deserializeAttachment() as Attachment | null)?.playerId;
          if (other !== socket && owner === joined.playerId) other.close(4002, 'Reemplazado');
        }
        socket.serializeAttachment({ playerId: joined.playerId } satisfies Attachment);
        // Conexión nueva (o de vuelta): su primer estado va completo.
        this.encoders.set(socket, new StateEncoder());
        send(socket, {
          type: 'welcome',
          roomCode: this.ctx.id.name ?? '',
          playerId: joined.playerId,
          token: joined.token,
          lobby: this.duel.inLobby,
        });
        this.broadcastPlayers();
        // Si la partida ya iba (volvió alguien), se le presenta; si recién empieza, avisa el reloj.
        if (!this.duel.inLobby && !this.duel.startedNew) this.announceStart(socket, true);
        this.ensureClock();
        return;
      }
      case 'ping':
        send(socket, { type: 'pong', sentAt: message.sentAt });
        return;
      case 'intents':
        if (playerId !== undefined) this.duel.intents(playerId, message.intents, message.seq);
        return;
      case 'glyph':
        if (playerId !== undefined) this.duel.chooseGlyph(playerId, message.glyphId);
        return;
      case 'rematch':
        if (playerId !== undefined) this.duel.rematch(playerId);
        return;
      case 'settings': {
        if (playerId === undefined) return;
        const moved = this.duel.configure(playerId, message.settings);
        if (!moved) return;
        this.notifyMoved(moved);
        this.broadcastPlayers();
        return;
      }
      case 'begin':
        if (playerId !== undefined && this.duel.begin(playerId)) this.broadcastPlayers();
        return;
      case 'away':
        if (playerId === undefined) return;
        if (!message.away) {
          // Vuelve a la app: el próximo estado va completo, por si se perdió el hilo.
          this.encoders.set(socket, new StateEncoder());
        }
        if (this.duel.setAway(playerId, message.away === true)) this.broadcastPlayers();
        return;
    }
  }

  /** Si cambió el modo, a quien cambió de puesto se le avisa su número nuevo. */
  private notifyMoved(moved: ReadonlyMap<number, number>): void {
    if (moved.size === 0) return;
    // Se leen todos antes de cambiar ninguno: un puesto nuevo puede ser el viejo de otro.
    const sockets = this.ctx.getWebSockets().map((socket) => ({
      socket,
      owner: (socket.deserializeAttachment() as Attachment | null)?.playerId,
    }));
    for (const { socket, owner } of sockets) {
      const next = owner === undefined ? undefined : moved.get(owner);
      if (next === undefined) continue;
      socket.serializeAttachment({ playerId: next } satisfies Attachment);
      const token = this.duel.tokenOf(next);
      if (token) {
        send(socket, { type: 'welcome', roomCode: this.ctx.id.name ?? '', playerId: next, token });
      }
    }
  }

  private drop(socket: WebSocket): void {
    this.encoders.delete(socket);
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
    try {
      this.advanceClock();
    } catch (error) {
      this.report('paso', error);
      throw error;
    }
  }

  /** Anota un error de la Sala en el registro (una vez por mensaje distinto). */
  private report(where: string, error: unknown): void {
    const key = `${where}|${error instanceof Error ? error.message : String(error)}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.ctx.waitUntil(reportRoomError(this.env.ERRORS, this.ctx.id.name ?? '', where, error));
  }

  private advanceClock(): void {
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
    // Alguien se quedó callado (sin señal) o volvió a hablar: se avisa a todos.
    const away = duel.awayKey;
    if (away !== this.lastAway) {
      this.lastAway = away;
      this.broadcastPlayers();
    }
  }

  private announceStart(socket: WebSocket, resume = false): void {
    if (!this.host) return;
    send(socket, {
      type: 'start',
      omenId: this.host.omenId,
      players: this.host.players,
      settings: this.host.settings,
      ...(resume ? { resume: true } : {}),
    });
  }

  private broadcastPlayers(): void {
    if (!this.host) return;
    const message = encode({
      type: 'players',
      players: this.host.players,
      settings: this.host.settings,
      hostId: this.host.hostId,
    });
    for (const socket of this.ctx.getWebSockets()) trySend(socket, message);
  }

  /** El estado del paso: una copia por paso y, para cada jugador, solo lo que cambió. */
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
    // El núcleo modifica el estado en el lugar: los codificadores guardan esta copia.
    const snapshot = structuredClone(duel.state);
    for (const socket of this.ctx.getWebSockets()) {
      const playerId = (socket.deserializeAttachment() as Attachment | null)?.playerId;
      if (playerId === undefined || !duel.wantsState(playerId)) continue;
      let encoder = this.encoders.get(socket);
      if (!encoder) {
        // La Sala despertó sin recordar lo mandado: se parte de nuevo con un cuadro completo.
        encoder = new StateEncoder();
        this.encoders.set(socket, encoder);
      }
      trySend(socket, encoder.encode(duel.frameFor(playerId, snapshot)));
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  trySend(socket, encode(message));
}

function trySend(socket: WebSocket, data: string | Uint8Array): void {
  try {
    socket.send(data);
  } catch {
    // El socket se está cerrando: lo resuelve webSocketClose.
  }
}
