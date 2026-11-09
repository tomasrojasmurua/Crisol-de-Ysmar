import { GLYPHS, type Glyph, OMENS, type Omen } from '@crisol/content';
import type {
  Controller,
  ElementId,
  GameEvent,
  MatchState,
  SeriesState,
  Vec2,
  Wizard,
} from '@crisol/core';
import {
  decodeServerMessage,
  encode,
  type NetStage,
  type PlayerInfo,
  type PlayerLook,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@crisol/protocol';
import type { MatchOptions, MatchStage } from '../game/LocalMatch';
import type { MatchView } from '../game/MatchView';
import { roomSocketUrl } from './serverUrl';

type StateMessage = Extract<ServerMessage, { type: 'state' }>;

/** El aviso de que empieza la ronda llega en este paso de la pausa (igual que en el celular). */
const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
/** Pasos que se guardan antes de empezar a mostrar: un colchón contra los saltos de la red. */
const BUFFER_TARGET = 2;
/** Si se juntan más pasos que estos, se adelanta para no quedar atrasado. */
const BUFFER_MAX = 4;
/** Cuánto se intenta volver si se corta la conexión. */
const RECONNECT_MS = 60_000;
const RECONNECT_EVERY_MS = 1500;
const PING_EVERY_MS = 2000;

/** Lo que el juego escucha de la red. */
export interface NetListener {
  /** Quiénes están en la sala (entró, salió o volvió alguien). */
  players(players: readonly PlayerInfo[], me: number): void;
  /** Empezó una partida nueva (la primera o una revancha). */
  start(match: NetMatch): void;
  /** Un problema que el jugador debe ver; `fatal` si ya no se puede seguir. */
  problem(reason: string, fatal: boolean): void;
  /** Cambió la latencia medida, en milisegundos. */
  latency(ms: number): void;
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
  readonly options: MatchOptions = { mode: { kind: 'duel' }, deathRule: 'spectre', affinity: null };
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
  private readonly previous = new Map<number, Vec2>();
  private glyphIds: Readonly<Record<number, readonly string[]>> = {};
  private netStage: NetStage = { kind: 'lobby' };
  private seq = 0;
  private awaitingFirst = false;
  private closed = false;
  private lostAt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly code: string,
    private readonly profile: NetProfile,
    private readonly human: Controller,
    private readonly listener: NetListener,
  ) {
    this.connect();
  }

  get player(): Wizard {
    const found = this.state.wizards.find((w) => w.id === this.playerId);
    return found ?? (this.state.wizards[0] as Wizard);
  }

  get roundNumber(): number {
    return this.series.roundsPlayed + (this.stage.kind === 'playing' ? 1 : 0);
  }

  /** Cada paso: manda lo que tocaste y muestra el siguiente estado que llegó. */
  step(): readonly GameEvent[] {
    // La pausa entre rondas se cuenta aquí, como en el celular: el servidor la manda de a ratos.
    if (this.stage.kind === 'intermission' && this.stage.ticksLeft > 0) this.stage.ticksLeft--;
    if (this.started && this.netStage.kind === 'playing' && this.state.wizards.length > 0) {
      const intents = this.human.intentsFor(this.state, this.player);
      if (intents.length > 0) {
        this.send({ type: 'intents', seq: ++this.seq, intents: [...intents] });
      }
    }
    if (!this.primed) {
      if (this.buffer.length < BUFFER_TARGET) return [];
      this.primed = true;
    }
    const events: GameEvent[] = [];
    // Si la red trajo muchos de golpe, se adelanta (sin perder lo que pasó en ellos).
    while (this.buffer.length > BUFFER_MAX) {
      const skipped = this.buffer.shift();
      if (skipped) {
        events.push(...skipped.state.events);
        this.apply(skipped);
      }
    }
    const next = this.buffer.shift();
    if (!next) return events;
    this.rememberPositions();
    this.apply(next);
    events.push(...next.state.events);
    return events;
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

  /** Posición entre el paso anterior y el actual, según `alpha` (0 a 1). */
  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    const before = this.previous.get(id);
    if (!before || this.stage.kind !== 'playing') return current;
    return {
      x: before.x + (current.x - before.x) * alpha,
      z: before.z + (current.z - before.z) * alpha,
    };
  }

  /** Te vas de la sala: la IA juega por ti. */
  close(): void {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close(1000, 'Salió');
    this.socket = null;
  }

  private connect(): void {
    const socket = new WebSocket(roomSocketUrl(this.code));
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.lostAt = 0;
      this.send({
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        playerName: this.profile.name,
        look: this.profile.look,
        affinity: this.profile.affinity,
        ...(this.token ? { token: this.token } : {}),
      });
      if (!this.pingTimer) {
        this.pingTimer = setInterval(
          () => this.send({ type: 'ping', sentAt: performance.now() }),
          PING_EVERY_MS,
        );
      }
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = decodeServerMessage(event.data);
      if (message) this.receive(message);
    });
    socket.addEventListener('close', (event) => this.onClose(socket, event.code));
  }

  private onClose(socket: WebSocket, code: number): void {
    if (this.closed || socket !== this.socket) return;
    if (code === 4001) {
      this.listener.problem('La sala ya tiene dos jugadores', true);
      this.close();
      return;
    }
    if (code === 4002) return;
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
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, RECONNECT_EVERY_MS);
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.playerId = message.playerId;
        this.token = message.token;
        return;
      case 'players':
        this.roster = message.players;
        this.listener.players(message.players, this.playerId);
        return;
      case 'start':
        this.roster = message.players;
        this.omen = OMENS.find((o) => o.id === message.omenId) ?? (OMENS[0] as Omen);
        this.affinities = new Map(message.players.map((p) => [p.id, p.affinity]));
        this.buffer.length = 0;
        this.primed = false;
        this.previous.clear();
        this.rematchAsked = false;
        this.started = true;
        this.netStage = { kind: 'lobby' };
        this.stage = { kind: 'playing' };
        this.series = { wins: [0, 0], roundsPlayed: 0, winnerTeam: null };
        this.state = emptyState();
        this.awaitingFirst = true;
        return;
      case 'state':
        if (!this.started) return;
        // El primer estado de una partida se muestra en el acto: trae los magos que hay que dibujar.
        if (this.awaitingFirst) {
          this.awaitingFirst = false;
          this.apply(message);
          this.listener.start(this);
          return;
        }
        this.buffer.push(message);
        return;
      case 'pong':
        this.listener.latency(Math.round(performance.now() - message.sentAt));
        return;
      case 'error':
        this.listener.problem(message.reason, false);
        return;
    }
  }

  private apply(message: StateMessage): void {
    const previous = this.stage;
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
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encode(message));
  }

  /** Para volver a tu mago si se corta; vive mientras la pestaña siga abierta. */
  private get token(): string | null {
    try {
      return sessionStorage.getItem(`crisol.sala.${this.code}`);
    } catch {
      return null;
    }
  }

  private set token(value: string | null) {
    try {
      if (value) sessionStorage.setItem(`crisol.sala.${this.code}`, value);
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
    deathRule: 'spectre',
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
