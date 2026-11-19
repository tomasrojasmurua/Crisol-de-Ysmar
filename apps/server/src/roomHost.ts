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
import { RoomPerf, type RoomPerfReport } from './roomPerf';

/**
 * Una conexión de un celular, sin importar dónde corra la Sala (Durable Object de Cloudflare o
 * el servidor de Santiago). `playerId` es lo que la Sala recuerda de ella.
 */
export interface Peer {
  send(data: string | Uint8Array): void;
  close(code: number, reason: string): void;
  playerId: number | undefined;
}

/** Lo que la Sala necesita de su casa. */
export interface RoomHome {
  /** El código de la sala ("K7QF"). */
  readonly code: string;
  /** Las conexiones abiertas ahora. */
  peers(): readonly Peer[];
  /** Anota un error de la Sala en el registro. */
  report(where: string, error: unknown): void;
  /** Anota cómo anduvo la Sala en una serie (ver `RoomPerf`). */
  perf?(report: RoomPerfReport): void;
  /** Cómo va la máquina ahora ("CPU 6% · atraso p99 2 ms"), si se sabe. */
  machine?(): string;
}

/** Mientras no se juega (sala de espera, final), el estado se manda cada tantos pasos. */
const IDLE_SEND_EVERY = 10;
/** Si el reloj se atrasa (la Sala estuvo ocupada), no se recuperan más de estos pasos de golpe. */
const MAX_CATCH_UP = 4;

/**
 * Una Sala es un pequeño servidor propio por partida: corre el núcleo a 30 pasos por segundo y
 * manda a cada celular lo que cambió en cada paso, en binario (el primero va completo). Los
 * celulares solo mandan lo que tocan. Si alguien se desconecta, la IA juega por él hasta que
 * vuelva con su token.
 */
export class RoomHost {
  private host: DuelHost | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private clock = 0;
  private sentTicks = 0;
  private lastStage = '';
  private lastAway = '';
  /** Lo último que se le mandó a cada conexión, para mandarle solo lo que cambió. */
  private readonly encoders = new Map<Peer, StateEncoder>();
  /** Cómo anda el reloj en la serie en curso: va al registro al terminar. */
  private readonly perf = new RoomPerf();
  /** Errores ya anotados: uno que se repite cada paso se guarda una sola vez. */
  private readonly reported = new Set<string>();

  constructor(private readonly home: RoomHome) {}

  /** Si la Sala corre su reloj (hay alguien conectado). */
  get running(): boolean {
    return this.timer !== null;
  }

  /** Llega un mensaje de un celular. */
  message(peer: Peer, raw: string | ArrayBuffer | Uint8Array): void {
    const message = typeof raw === 'string' ? decodeClientMessage(raw) : null;
    if (!message) {
      send(peer, { type: 'error', reason: 'Mensaje no reconocido' });
      return;
    }
    try {
      this.handle(peer, message);
    } catch (error) {
      // Un mensaje que falla no tumba la sala: se anota y se sigue.
      this.report(`mensaje ${message.type}`, error);
    }
  }

  /** Se cerró una conexión (o falló). */
  closed(peer: Peer): void {
    this.drop(peer);
  }

  /** La deja como Partida rápida antes de que llegue nadie (ver `DuelHost.makeQuick`). */
  makeQuick(): void {
    this.duel.makeQuick();
  }

  /** Si a esta Partida rápida le cabe alguien (`lobby` esperando, `late` tomando un bot). */
  get quickOpening(): 'lobby' | 'late' | null {
    return this.host?.quickOpening ?? null;
  }

  /** Se apaga la Sala (el servidor se reinicia). */
  stop(): void {
    this.stopClock();
  }

  private get duel(): DuelHost {
    if (!this.host) {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
      this.host = new DuelHost(seed, () => crypto.randomUUID());
    }
    return this.host;
  }

  private handle(peer: Peer, message: ClientMessage): void {
    const playerId = peer.playerId;
    if (playerId !== undefined) this.duel.heard(playerId);
    switch (message.type) {
      case 'hello': {
        if (message.protocol !== PROTOCOL_VERSION) {
          send(peer, {
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
          quick: message.quick === true,
        });
        if (!joined) {
          send(peer, { type: 'error', reason: this.duel.joinError || 'La sala está llena' });
          peer.close(4001, 'Sala llena');
          return;
        }
        // Si la sala creció para hacerle lugar, a quien cambió de puesto se le avisa su número.
        // Va antes de lo que sigue: si no, el socket de otro con el número viejo de este parece
        // un duplicado y se cierra (así se perdía un amigo al crecer la sala).
        this.notifyMoved(this.duel.takeMoved());
        // Si el mismo jugador tenía otro socket abierto, se cierra el viejo.
        for (const other of this.home.peers()) {
          if (other !== peer && other.playerId === joined.playerId)
            other.close(4002, 'Reemplazado');
        }
        peer.playerId = joined.playerId;
        // Conexión nueva (o de vuelta): su primer estado va completo.
        this.encoders.set(peer, new StateEncoder());
        send(peer, {
          type: 'welcome',
          roomCode: this.home.code,
          playerId: joined.playerId,
          token: joined.token,
          lobby: this.duel.inLobby,
        });
        this.broadcastPlayers();
        // Si la partida ya iba (volvió alguien), se le presenta; si recién empieza, avisa el reloj.
        if (!this.duel.inLobby && !this.duel.startedNew) this.announceStart(peer, true);
        this.ensureClock();
        return;
      }
      case 'ping':
        send(peer, { type: 'pong', sentAt: message.sentAt });
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
          this.encoders.set(peer, new StateEncoder());
        }
        if (this.duel.setAway(playerId, message.away === true)) this.broadcastPlayers();
        return;
    }
  }

  /** Si cambió el modo, a quien cambió de puesto se le avisa su número nuevo. */
  private notifyMoved(moved: ReadonlyMap<number, number>): void {
    if (moved.size === 0) return;
    // Se leen todos antes de cambiar ninguno: un puesto nuevo puede ser el viejo de otro.
    const peers = this.home.peers().map((peer) => ({ peer, owner: peer.playerId }));
    for (const { peer, owner } of peers) {
      const next = owner === undefined ? undefined : moved.get(owner);
      if (next === undefined) continue;
      peer.playerId = next;
      const token = this.duel.tokenOf(next);
      if (token) send(peer, { type: 'welcome', roomCode: this.home.code, playerId: next, token });
    }
  }

  private drop(peer: Peer): void {
    this.encoders.delete(peer);
    const playerId = peer.playerId;
    if (playerId === undefined || !this.host) return;
    // Si ese jugador ya volvió por otro socket, no se lo marca como ido.
    const stillHere = this.home
      .peers()
      .some((other) => other !== peer && other.playerId === playerId);
    if (stillHere) return;
    this.host.leave(playerId);
    this.broadcastPlayers();
    if (this.host.connectedCount === 0) this.stopClock();
  }

  private ensureClock(): void {
    if (this.timer) return;
    this.clock = Date.now();
    this.scheduleClock();
  }

  private stopClock(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Cada vuelta se agenda para cuando toca el próximo paso, no cada 33 ms fijos. Antes era un
   * `setInterval` de 33,3 ms que el servidor redondea a 33: el reloj se iba corriendo y cada 3 o 4
   * segundos salía un hueco de 66 ms sin estado (o dos estados juntos). Ese hueco vaciaba el
   * colchón de los celulares una y otra vez: los rivales se quedaban quietos un instante.
   */
  private scheduleClock(): void {
    const wait = Math.max(0, Math.ceil(this.clock + TICK_MS - Date.now()));
    this.timer = setTimeout(() => this.onClock(), wait);
  }

  private onClock(): void {
    try {
      this.advanceClock();
    } catch (error) {
      this.report('paso', error);
      throw error;
    } finally {
      // Si en la vuelta se fueron todos, `stopClock` ya dejó el reloj en null: no se reagenda.
      if (this.timer) this.scheduleClock();
    }
  }

  /** Anota un error de la Sala en el registro (una vez por mensaje distinto). */
  private report(where: string, error: unknown): void {
    const key = `${where}|${error instanceof Error ? error.message : String(error)}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.home.report(where, error);
  }

  private advanceClock(): void {
    const duel = this.host;
    if (!duel) return;
    const now = Date.now();
    let due = Math.floor((now - this.clock) / TICK_MS);
    // Cuánto después de lo debido sale el primer paso que tocaba (0 si va al día).
    const late = now - this.clock - TICK_MS;
    let dropped = 0;
    if (due > MAX_CATCH_UP) {
      dropped = due - MAX_CATCH_UP;
      this.clock = now - MAX_CATCH_UP * TICK_MS;
      due = MAX_CATCH_UP;
    }
    for (let i = 0; i < due; i++) {
      this.clock += TICK_MS;
      duel.tick();
      if (duel.startedNew) {
        duel.startedNew = false;
        for (const peer of this.home.peers()) this.announceStart(peer);
        const humans = duel.players.filter((p) => !p.bot).length;
        this.perf.start(now, { humans, bots: duel.players.length - humans });
      }
      this.broadcastState();
    }
    if (due > 0) this.perf.clock(now, late, Date.now() - now, dropped);
    if (this.perf.running && duel.stageFor(1).kind === 'finished') {
      const report = this.perf.finish(Date.now(), this.home.machine?.() ?? '');
      if (report) this.home.perf?.(report);
    }
    // Alguien se quedó callado (sin señal) o volvió a hablar, o cambió quien manda: se avisa.
    const away = `${duel.awayKey}|${duel.hostId}`;
    if (away !== this.lastAway) {
      this.lastAway = away;
      this.broadcastPlayers();
    }
  }

  private announceStart(peer: Peer, resume = false): void {
    if (!this.host) return;
    send(peer, {
      type: 'start',
      omenId: this.host.omenId,
      players: this.host.players,
      settings: this.host.settings,
      ...(resume ? { resume: true } : {}),
    });
  }

  private broadcastPlayers(): void {
    if (!this.host) return;
    const startsIn = this.host.quickStartsIn;
    const message = encode({
      type: 'players',
      players: this.host.players,
      settings: this.host.settings,
      hostId: this.host.hostId,
      ...(this.host.quick ? { quick: true } : {}),
      ...(startsIn !== null ? { startsIn } : {}),
    });
    for (const peer of this.home.peers()) trySend(peer, message);
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
    for (const peer of this.home.peers()) {
      const playerId = peer.playerId;
      if (playerId === undefined || !duel.wantsState(playerId)) continue;
      let encoder = this.encoders.get(peer);
      if (!encoder) {
        // La Sala despertó sin recordar lo mandado: se parte de nuevo con un cuadro completo.
        encoder = new StateEncoder();
        this.encoders.set(peer, encoder);
      }
      trySend(peer, encoder.encode(duel.frameFor(playerId, snapshot)));
    }
  }
}

function send(peer: Peer, message: ServerMessage): void {
  trySend(peer, encode(message));
}

function trySend(peer: Peer, data: string | Uint8Array): void {
  try {
    peer.send(data);
  } catch {
    // El socket se está cerrando: lo resuelve el aviso de cierre.
  }
}
