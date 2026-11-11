import { GLYPHS, type Glyph, OMENS, type Omen, omenById, rulesForRoom } from '@crisol/content';
import {
  type Controller,
  canAct,
  type ElementId,
  type GameEvent,
  type GameRules,
  type Intent,
  liveRules,
  type MatchState,
  type SeriesState,
  teamCount,
  type Vec2,
  vec2,
  type Wizard,
  walkTarget,
} from '@crisol/core';

const { distance, normalize } = vec2;

import {
  DEFAULT_ROOM_SETTINGS,
  decodeServerMessage,
  encode,
  type NetStage,
  type PlayerInfo,
  type PlayerLook,
  PROTOCOL_VERSION,
  type RoomSettings,
  type ServerMessage,
  StateDecoder,
  type StateFrame,
} from '@crisol/protocol';
import type { MatchOptions, MatchStage } from '../game/LocalMatch';
import type { MatchView } from '../game/MatchView';
import { LagSimulator } from './LagSimulator';
import { roomSocketUrl } from './serverUrl';

type StateMessage = StateFrame;

/** El aviso de que empieza la ronda llega en este paso de la pausa (igual que en el celular). */
const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
/**
 * El colchón: pasos guardados antes de mostrar, contra los saltos de la red. Empieza chico y crece
 * si la red se corta; vuelve a achicarse de a poco si pasa un rato sin cortes.
 */
const BUFFER_MIN = 2;
const BUFFER_LIMIT = 8;
/** Pasos sin cortes para achicar el colchón en uno (10 s). */
const SHRINK_AFTER = 300;
/** Si el colchón se pasa de su tamaño por más que esto, se muestran dos pasos por cuadro. */
const CATCH_UP_SLACK = 2;
/** Si se juntan muchísimos (la pestaña estuvo en segundo plano), se salta directo. */
const HARD_SKIP = 30;
/**
 * Cuánto se intenta volver si se corta la conexión (con la app a la vista; al volver a la app
 * se cuenta de nuevo). Mientras tanto, la IA juega por ti.
 */
const RECONNECT_MS = 5 * 60_000;
const RECONNECT_EVERY_MS = 1500;
const PING_EVERY_MS = 2000;
/** Si no llega nada en este tiempo con la app a la vista, la conexión está muerta aunque no avise. */
const SILENCE_MS = 6000;
/**
 * Al volver a la app tras este rato afuera, el socket se da por sospechoso: iOS suele matarlo en
 * segundo plano sin avisar. Si no llega nada en `RETURN_CHECK_MS`, se reconecta de inmediato en
 * vez de esperar los 6 s de silencio normales.
 */
const AWAY_SUSPECT_MS = 3000;
const RETURN_CHECK_MS = 1500;
/** Cuánto se recuerda el pase para volver a una sala (por si se cierra la pestaña). */
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000;
/** Si la predicción y el servidor difieren más que esto (un salto, un empujón), no se suaviza. */
const SNAP_DISTANCE = 3;
/** Toques guardados a la espera de que el servidor los confirme (unos 4 s). */
const MAX_PENDING = 120;
/** Se lee al cargar la página, antes de que el menú limpie la dirección. */
const SIMULATED_LAG = LagSimulator.fromUrl(globalThis.location?.search ?? '');

/** Lo que tocaste en un paso, guardado hasta que el servidor lo confirme. */
interface SentInput {
  readonly seq: number;
  readonly move: Vec2;
  readonly intents: readonly Intent[];
}

/** Lo que el juego escucha de la red. */
export interface NetListener {
  /** Quiénes están en la sala (entró, salió o volvió alguien). */
  players(players: readonly PlayerInfo[], me: number): void;
  /** Empezó una partida nueva (la primera o una revancha). */
  start(match: NetMatch): void;
  /** Un problema que el jugador debe ver; `fatal` si ya no se puede seguir. */
  problem(reason: string, fatal: boolean): void;
  /** Una buena noticia breve (por ejemplo, que volvió la conexión). */
  notice(text: string): void;
  /** Cómo va la red: latencia, colchón y cortes, para el indicador. */
  stats(stats: NetStats): void;
}

interface NetStats {
  /** Ida y vuelta al servidor, en milisegundos. */
  readonly ping: number;
  /** Pasos guardados ahora y el tamaño buscado. */
  readonly buffer: number;
  readonly target: number;
  /** Veces que el colchón se vació y hubo que esperar. */
  readonly stalls: number;
  /** Lo que llega del servidor, en kilobytes por segundo. */
  readonly kbps: number;
  /** El estado más grande que llegó en el último rato, en bytes. */
  readonly biggest: number;
  /** Si se está simulando una mala conexión (`?lag=`), cuánta. */
  readonly simulated: string | null;
}

/** Tu perfil, para presentarte en la sala. */
export interface NetProfile {
  readonly name: string;
  readonly look: PlayerLook;
  readonly affinity: ElementId | null;
}

/**
 * Un duelo en red: la Sala corre la partida y manda el estado en cada paso; este celular solo
 * manda lo que tocas y muestra lo que llega, con un colchón de dos pasos para que se vea parejo.
 * Se ve igual que una partida local para el resto del juego.
 */
export class NetMatch implements MatchView {
  /** El modo lo elige quien creó la sala; llega con la lista de jugadores. */
  options: MatchOptions = { mode: DEFAULT_ROOM_SETTINGS.mode, deathRule: 'out', affinity: null };
  /** Los ajustes de la sala (modo, tiempo por ronda, rondas, Glifos, Presagio). */
  settings: RoomSettings = DEFAULT_ROOM_SETTINGS;
  /** Quién manda en la sala de espera (cambia los ajustes y empieza). */
  hostId = 0;
  /** Las reglas de la partida: las del modo con el tiempo y las rondas de la sala. */
  rules: GameRules = rulesForRoom(DEFAULT_ROOM_SETTINGS);
  state: MatchState = emptyState();
  series: SeriesState = { wins: [0, 0], roundsPlayed: 0, winnerTeam: null };
  stage: MatchStage = { kind: 'playing' };
  omen: Omen = OMENS[0] as Omen;
  affinities = new Map<number, ElementId | null>();
  playerId = 0;
  roster: readonly PlayerInfo[] = [];
  /** Si ya empezó alguna partida (antes, la sala de espera). */
  started = false;
  /** Si pediste la revancha y esperas al otro. */
  rematchAsked = false;

  private socket: WebSocket | null = null;
  private readonly buffer: StateMessage[] = [];
  private primed = false;
  private target = BUFFER_MIN;
  private calmSteps = 0;
  private stalls = 0;
  private ping = 0;
  /** El estado más nuevo que llegó (el que se muestra va un poco atrás, por el colchón). */
  private latest: StateMessage | null = null;
  private readonly sent: SentInput[] = [];
  /** Dónde se predice tu mago ahora y dónde estaba en el paso anterior. */
  private predicted: Vec2 | null = null;
  private predictedBefore: Vec2 | null = null;
  private predictedWeave: Wizard['weave'] = [];
  private predictedFacing: Vec2 | null = null;
  /**
   * El último fijado que mandaste (un duelo o soltarlo), hasta que el estado que se muestra lo
   * refleje. Así la cámara entra en duelo al instante, sin esperar la vuelta del servidor.
   */
  private pendingLock: { readonly seq: number; readonly target: number | null } | null = null;
  private readonly previous = new Map<number, Vec2>();
  private glyphIds: Readonly<Record<number, readonly string[]>> = {};
  private netStage: NetStage = { kind: 'lobby' };
  private seq = 0;
  private awaitingFirst = false;
  private closed = false;
  private lostAt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Arma cada estado con lo que cambió; uno nuevo por conexión (el primero llega completo). */
  private decoder = new StateDecoder();
  /** Rivales que la Sala dice que no ves: no se dibujan aunque lleguen en el estado. */
  private hidden: ReadonlySet<number> = new Set();
  private readonly lag = SIMULATED_LAG;
  private lastError = '';
  /** Volviste a la misma partida (tras un corte o al volver a la app): sigue sin rearmar nada. */
  private resuming = false;
  private lastHeard = 0;
  private hiddenAt = 0;
  private returnCheck: ReturnType<typeof setTimeout> | null = null;
  private readonly onVisibility = (): void => this.visibilityChanged();
  private readonly onOnline = (): void => this.retryNow();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private bytesIn = 0;
  private biggest = 0;
  private measuredAt = 0;
  private kbps = 0;

  constructor(
    readonly code: string,
    private readonly profile: NetProfile,
    private readonly human: Controller,
    private readonly listener: NetListener,
  ) {
    this.connect();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
  }

  get player(): Wizard {
    const found = this.state.wizards.find((w) => w.id === this.playerId);
    return found ?? (this.state.wizards[0] as Wizard);
  }

  get roundNumber(): number {
    return this.series.roundsPlayed + (this.stage.kind === 'playing' ? 1 : 0);
  }

  /** Cada paso: manda lo que tocaste, muestra el siguiente estado y predice tu mago. */
  step(): readonly GameEvent[] {
    const events = this.advance();
    this.predict();
    return events;
  }

  private advance(): readonly GameEvent[] {
    // La pausa entre rondas se cuenta aquí, como en el celular: el servidor la manda de a ratos.
    if (this.stage.kind === 'intermission' && this.stage.ticksLeft > 0) this.stage.ticksLeft--;
    if (this.started && this.netStage.kind === 'playing' && this.state.wizards.length > 0) {
      const intents = this.human.intentsFor(this.state, this.player);
      if (intents.length > 0) {
        const seq = ++this.seq;
        this.send({ type: 'intents', seq, intents: [...intents] });
        const move = intents.find((i) => i.kind === 'move');
        this.sent.push({
          seq,
          move: move?.kind === 'move' ? { x: move.x, z: move.z } : { x: 0, z: 0 },
          intents,
        });
        if (this.sent.length > MAX_PENDING) this.sent.shift();
        const lock = [...intents].reverse().find((i) => i.kind === 'lockTarget');
        if (lock?.kind === 'lockTarget') this.pendingLock = { seq, target: lock.targetId };
      }
    }
    if (!this.primed) {
      if (this.buffer.length < this.target) return [];
      this.primed = true;
    }
    const events: GameEvent[] = [];
    // La pestaña estuvo en segundo plano: se salta directo, sin perder lo que pasó.
    if (this.buffer.length > HARD_SKIP) {
      while (this.buffer.length > this.target) this.consume(events);
    }
    if (this.buffer.length === 0) {
      // Se vació: se espera a juntar de nuevo y el colchón crece para la próxima.
      if (this.netStage.kind === 'playing') {
        this.stalls++;
        this.target = Math.min(BUFFER_LIMIT, this.target + 1);
        this.calmSteps = 0;
      }
      this.primed = false;
      return events;
    }
    // Atrasado: se muestran dos pasos en este cuadro, un poco más rápido, hasta alcanzar.
    if (this.buffer.length > this.target + CATCH_UP_SLACK) this.consume(events);
    this.rememberPositions();
    this.consume(events);
    if (++this.calmSteps >= SHRINK_AFTER && this.target > BUFFER_MIN) {
      this.target--;
      this.calmSteps = 0;
    }
    return events;
  }

  /** Muestra el siguiente estado guardado y junta lo que pasó en él. */
  private consume(events: GameEvent[]): void {
    const next = this.buffer.shift();
    if (!next) return;
    this.apply(next);
    events.push(...next.state.events);
  }

  /** Quien manda cambia los ajustes de la sala (los demás los ven al instante). */
  configure(settings: RoomSettings): void {
    this.send({ type: 'settings', settings });
  }

  private useSettings(settings: RoomSettings): void {
    this.settings = settings;
    this.options = { ...this.options, mode: settings.mode };
    this.rules = rulesForRoom(settings);
  }

  /** Quien manda empieza: la IA ocupa los puestos libres. */
  begin(): void {
    this.send({ type: 'begin' });
  }

  chooseGlyph(glyph: Glyph): void {
    this.send({ type: 'glyph', glyphId: glyph.id });
  }

  requestRematch(): void {
    this.rematchAsked = true;
    this.send({ type: 'rematch' });
  }

  glyphsOf(id: number): readonly Glyph[] {
    return (this.glyphIds[id] ?? []).map(glyphById).filter((g): g is Glyph => g !== undefined);
  }

  /** Posición entre el paso anterior y el actual, según `alpha` (0 a 1). Tu mago va predicho. */
  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    if (id === this.playerId && this.predicted) {
      const from = this.predictedBefore;
      if (!from || distance(from, this.predicted) > SNAP_DISTANCE) return this.predicted;
      return {
        x: from.x + (this.predicted.x - from.x) * alpha,
        z: from.z + (this.predicted.z - from.z) * alpha,
      };
    }
    const before = this.previous.get(id);
    if (!before || this.stage.kind !== 'playing') return current;
    return {
      x: before.x + (current.x - before.x) * alpha,
      z: before.z + (current.z - before.z) * alpha,
    };
  }

  /** Tu mago como se ve en este celular: con el tejido que acabas de tocar, sin esperar. */
  present(wizard: Wizard): Wizard {
    if (wizard.id !== this.playerId) return wizard;
    const lockTarget = this.lockShown(wizard);
    if (!this.predicted)
      return lockTarget === wizard.lockTarget ? wizard : { ...wizard, lockTarget };
    return {
      ...wizard,
      weave: this.predictedWeave,
      facing: !wizard.channel && this.predictedFacing ? this.predictedFacing : wizard.facing,
      lockTarget,
    };
  }

  /**
   * A quién tienes fijado según este celular: lo último que mandaste, hasta que el estado que se
   * muestra lo refleje o el servidor lo haya rechazado (por ejemplo, el rival se escondió).
   */
  private lockShown(wizard: Wizard): number | null {
    const pending = this.pendingLock;
    if (!pending) return wizard.lockTarget;
    const latest = this.latest;
    const confirmed = latest?.state.wizards.find((w) => w.id === this.playerId);
    const rejected =
      latest !== null && latest.ack >= pending.seq && confirmed?.lockTarget !== pending.target;
    if (wizard.lockTarget === pending.target || rejected) {
      this.pendingLock = null;
      return wizard.lockTarget;
    }
    return pending.target;
  }

  /**
   * Predicción: parte de tu mago en el estado más nuevo del servidor y repite encima lo que
   * tocaste y él todavía no jugó, caminando igual que el núcleo. Si no puedes moverte (aturdido,
   * por los aires, saltando) o no se está jugando, se usa lo que dice el servidor.
   */
  private predict(): void {
    this.predictedBefore = this.predicted;
    const latest = this.latest;
    const me = latest?.state.wizards.find((w) => w.id === this.playerId);
    if (
      !latest ||
      !me ||
      latest.stage.kind !== 'playing' ||
      me.hp <= 0 ||
      me.fallen ||
      me.leap ||
      !canAct(me)
    ) {
      this.predicted = null;
      this.sent.length = 0;
      return;
    }
    while (this.sent.length > 0 && (this.sent[0]?.seq ?? 0) <= latest.ack) this.sent.shift();
    const rules = liveRules(latest.state, this.rules);
    let pos = me.pos;
    let weave = [...me.weave];
    let facing: Vec2 | null = null;
    for (const input of this.sent) {
      pos = walkTarget(latest.state, { ...me, pos }, input.move, rules);
      if (input.move.x !== 0 || input.move.z !== 0) facing = normalize(input.move, me.facing);
      for (const intent of input.intents) {
        if (intent.kind === 'weave' && weave.length < 3) weave.push(intent.element);
        else if (intent.kind === 'cancelWeave' || intent.kind === 'cast') weave = [];
      }
    }
    this.predicted = pos;
    this.predictedWeave = weave;
    this.predictedFacing = facing;
  }

  /** Te vas de la sala: la IA juega por ti. */
  close(): void {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.returnCheck) clearTimeout(this.returnCheck);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close(1000, 'Salió');
    this.socket = null;
  }

  /** Si la Sala dice que no ves a ese rival (escondido o por tu Ceguera). */
  isHidden(id: number): boolean {
    return this.hidden.has(id);
  }

  private connect(): void {
    const socket = new WebSocket(roomSocketUrl(this.code));
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    this.decoder = new StateDecoder();
    socket.addEventListener('open', () => {
      if (this.lostAt !== 0) this.listener.notice('Conexión recuperada');
      this.lostAt = 0;
      this.lastHeard = performance.now();
      this.send({
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        playerName: this.profile.name,
        look: this.profile.look,
        affinity: this.profile.affinity,
        ...(this.token ? { token: this.token } : {}),
      });
      if (document.hidden) this.send({ type: 'away', away: true });
      if (!this.pingTimer) this.pingTimer = setInterval(() => this.heartbeat(), PING_EVERY_MS);
    });
    socket.addEventListener('message', (event) => {
      const data: unknown = event.data;
      const handle = (): void => {
        if (socket !== this.socket) return;
        this.lastHeard = performance.now();
        if (data instanceof ArrayBuffer) {
          this.countBytes(data.byteLength);
          this.receiveFrame(socket, new Uint8Array(data));
          return;
        }
        if (typeof data !== 'string') return;
        const message = decodeServerMessage(data);
        if (message) this.receive(message);
      };
      if (this.lag) this.lag.incoming(handle);
      else handle();
    });
    socket.addEventListener('close', (event) => this.onClose(socket, event.code));
  }

  private onClose(socket: WebSocket, code: number): void {
    if (this.closed || socket !== this.socket) return;
    if (code === 4001) {
      this.listener.problem(this.lastError || 'La sala está llena', true);
      this.close();
      return;
    }
    if (code === 4002) return;
    // Ya hay un intento en camino (el corte se detectó dos veces): no se duplica.
    if (this.retryTimer) return;
    const now = Date.now();
    if (this.lostAt === 0) {
      this.lostAt = now;
      this.listener.problem('Se cortó la conexión: reconectando…', false);
    }
    if (now - this.lostAt > RECONNECT_MS) {
      this.listener.problem('No se pudo volver a la sala', true);
      this.close();
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.closed) this.connect();
    }, RECONNECT_EVERY_MS);
  }

  /** Cada 2 s: mide el ping y revisa que la conexión siga viva aunque no lo haya avisado. */
  private heartbeat(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || document.hidden) return;
    if (performance.now() - this.lastHeard > SILENCE_MS) {
      // Cambio de wifi a 4G, túnel…: el socket queda colgado sin cerrarse. Se fuerza el corte.
      socket.close(4004, 'Sin respuesta');
      this.onClose(socket, 4004);
      return;
    }
    this.send({ type: 'ping', sentAt: performance.now() });
  }

  /** Volvió la señal: no se espera al próximo intento. */
  private retryNow(): void {
    if (this.closed || this.lostAt === 0 || !this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.connect();
  }

  /**
   * Saliste de la app o volviste. Afuera, la IA juega por ti y la Sala deja de mandarte el estado
   * (ahorra batería y datos). Al volver se descarta lo viejo y se sigue desde el estado nuevo.
   */
  private visibilityChanged(): void {
    if (this.closed) return;
    const away = document.hidden;
    if (away) this.hiddenAt = performance.now();
    if (!away) {
      const wasAway = this.hiddenAt > 0 ? performance.now() - this.hiddenAt : 0;
      this.hiddenAt = 0;
      const returnedAt = performance.now();
      this.lastHeard = returnedAt;
      this.resync();
      if (wasAway > AWAY_SUSPECT_MS && this.lostAt === 0) {
        // Se pide una respuesta ya: un ping vuelve aunque la Sala no mande estados.
        this.send({ type: 'ping', sentAt: returnedAt });
        if (this.returnCheck) clearTimeout(this.returnCheck);
        this.returnCheck = setTimeout(() => {
          this.returnCheck = null;
          const socket = this.socket;
          if (this.closed || !socket || this.lastHeard > returnedAt) return;
          socket.close(4004, 'Sin respuesta al volver');
          this.onClose(socket, 4004);
        }, RETURN_CHECK_MS);
      }
      if (this.lostAt !== 0) {
        // Afuera los intentos se frenan: al volver se da otra ventana completa y se intenta ya.
        this.lostAt = Date.now();
        this.retryNow();
      }
    }
    this.send({ type: 'away', away });
  }

  /** Descarta lo guardado y muestra en el acto el próximo estado que llegue. */
  private resync(): void {
    if (!this.started) return;
    this.buffer.length = 0;
    this.primed = false;
    this.previous.clear();
    this.sent.length = 0;
    this.pendingLock = null;
    this.resuming = true;
    this.awaitingFirst = true;
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.playerId = message.playerId;
        this.token = message.token;
        return;
      case 'players':
        this.roster = message.players;
        this.hostId = message.hostId;
        if (!this.started) this.useSettings(message.settings);
        this.listener.players(message.players, this.playerId);
        return;
      case 'start':
        this.roster = message.players;
        if (message.resume && this.started) {
          // Misma partida tras un corte: se sigue desde el próximo estado, sin rearmar nada.
          this.resync();
          return;
        }
        this.useSettings(message.settings);
        this.omen = omenById(message.omenId);
        this.affinities = new Map(message.players.map((p) => [p.id, p.affinity]));
        this.buffer.length = 0;
        this.primed = false;
        this.previous.clear();
        this.rematchAsked = false;
        this.started = true;
        this.netStage = { kind: 'lobby' };
        this.stage = { kind: 'playing' };
        this.series = {
          wins: Array.from({ length: teamCount(this.options.mode) }, () => 0),
          roundsPlayed: 0,
          winnerTeam: null,
        };
        this.state = emptyState();
        this.awaitingFirst = true;
        return;
      case 'pong':
        this.ping = Math.round(performance.now() - message.sentAt);
        this.listener.stats({
          ping: this.ping,
          buffer: this.buffer.length,
          target: this.target,
          stalls: this.stalls,
          kbps: this.kbps,
          biggest: this.biggest,
          simulated: this.lag?.label ?? null,
        });
        this.biggest = 0;
        return;
      case 'error':
        this.lastError = message.reason;
        this.listener.problem(message.reason, false);
        return;
    }
  }

  /** Un estado en binario: se arma sobre el anterior. Si algo no calza, se reconecta. */
  private receiveFrame(socket: WebSocket, data: Uint8Array): void {
    let frame: StateFrame;
    try {
      frame = this.decoder.decode(data) as StateFrame;
    } catch {
      // Se perdió el hilo: al reconectar, la Sala manda un estado completo.
      socket.close(4003, 'Estado ilegible');
      return;
    }
    if (!this.started) return;
    // El primer estado de una partida se muestra en el acto: trae los magos que hay que dibujar.
    this.latest = frame;
    if (this.awaitingFirst) {
      this.awaitingFirst = false;
      this.apply(frame);
      if (this.resuming) this.resuming = false;
      else this.listener.start(this);
      return;
    }
    this.buffer.push(frame);
  }

  private countBytes(bytes: number): void {
    this.bytesIn += bytes;
    this.biggest = Math.max(this.biggest, bytes);
    const now = performance.now();
    if (now - this.measuredAt >= 1000) {
      this.kbps = Math.round((this.bytesIn / (now - this.measuredAt)) * 10) / 10;
      this.bytesIn = 0;
      this.measuredAt = now;
    }
  }

  private apply(message: StateMessage): void {
    const previous = this.stage;
    this.hidden = new Set(message.hidden);
    this.state = message.state;
    this.netStage = message.stage;
    this.glyphIds = message.glyphs;
    this.series = {
      wins: [...message.wins],
      roundsPlayed: message.roundsPlayed,
      winnerTeam: message.seriesWinner,
    };
    this.stage = toStage(message.stage, previous);
  }

  private rememberPositions(): void {
    this.previous.clear();
    for (const wizard of this.state.wizards) this.previous.set(wizard.id, wizard.pos);
    for (const spell of this.state.spells) {
      if (
        spell.kind === 'projectile' ||
        spell.kind === 'summon' ||
        spell.kind === 'sweeper' ||
        spell.kind === 'guidedBolt'
      ) {
        this.previous.set(spell.id, spell.pos);
      }
    }
  }

  private send(message: Parameters<typeof encode>[0]): void {
    const socket = this.socket;
    if (socket?.readyState !== WebSocket.OPEN) return;
    const text = encode(message);
    if (this.lag) {
      this.lag.outgoing(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(text);
      });
    } else socket.send(text);
  }

  /**
   * Para volver a tu mago si se corta. Dura unas horas en el celular, así funciona aunque el
   * sistema cierre la pestaña de fondo o vuelvas a entrar por el enlace de WhatsApp.
   */
  private get token(): string | null {
    try {
      const saved = JSON.parse(localStorage.getItem(`crisol.sala.${this.code}`) ?? 'null') as {
        token?: unknown;
        at?: unknown;
      } | null;
      if (!saved || typeof saved.token !== 'string' || typeof saved.at !== 'number') return null;
      return Date.now() - saved.at < TOKEN_TTL_MS ? saved.token : null;
    } catch {
      return null;
    }
  }

  private set token(value: string | null) {
    try {
      if (value) {
        localStorage.setItem(
          `crisol.sala.${this.code}`,
          JSON.stringify({ token: value, at: Date.now() }),
        );
      }
    } catch {
      // Sin almacenamiento: si se corta, entras como jugador nuevo.
    }
  }
}

function glyphById(id: string): Glyph | undefined {
  return GLYPHS.find((g) => g.id === id);
}

/** La etapa de la red, traducida a la que entiende la pantalla. */
function toStage(stage: NetStage, previous: MatchStage): MatchStage {
  switch (stage.kind) {
    case 'lobby':
    case 'playing':
      return { kind: 'playing' };
    case 'intermission':
      // La cuenta sigue la del celular; el aviso de la ronda sale una vez, al empezar la pausa.
      if (previous.kind === 'intermission') return previous;
      return {
        kind: 'intermission',
        roundWinner: stage.roundWinner,
        ticksLeft: INTERMISSION_ANNOUNCE_TICK + 1,
      };
    case 'choosing':
      if (stage.chosen) return { kind: 'waiting' };
      return {
        kind: 'choosing',
        options: stage.options.map(glyphById).filter((g): g is Glyph => g !== undefined),
      };
    case 'finished':
      return { kind: 'finished' };
  }
}

function emptyState(): MatchState {
  return {
    deathRule: 'out',
    tick: 0,
    zoneRadius: 0,
    rngState: 0,
    nextEntityId: 0,
    wizards: [],
    spells: [],
    beasts: [],
    campRespawn: [],
    guardianAwake: false,
    burnedTrees: [],
    shrines: [],
    events: [],
    winnerTeam: null,
  } as unknown as MatchState;
}
