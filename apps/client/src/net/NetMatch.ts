import { GLYPHS, type Glyph, OMENS, type Omen, omenById, rulesForRoom } from '@crisol/content';
import {
  type Controller,
  canAct,
  canWeave,
  type ElementId,
  type GameEvent,
  type GameRules,
  type Intent,
  liveRules,
  type MatchState,
  type SeriesState,
  type SpellEntity,
  TICK_RATE,
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
  frameKey,
  type MissedEvents,
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
import type { MatchSummary, MatchView, RematchStatus } from '../game/MatchView';
import { type ReplayClip, ReplayRecorder } from '../game/ReplayRecorder';
import { reportProblem } from '../platform/ErrorReporter';
import { FastLink, fastLinkSupported } from './FastLink';
import { framesBetween } from './fillGap';
import { LagSimulator } from './LagSimulator';
import { roomSocketUrl, roomsServerName } from './serverUrl';

type StateMessage = StateFrame;

/** El aviso de que empieza la ronda llega en este paso de la pausa (igual que en el celular). */
const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;
/**
 * El colchón: pasos guardados antes de mostrar, contra los saltos de la red. Empieza chico y crece
 * si la red se corta; se achica apenas se ve que sobra (cada paso del colchón es atraso).
 */
const BUFFER_MIN = 2;
const BUFFER_LIMIT = 8;
/**
 * Cada cuánto se revisa si el colchón sobra (3 s). Si en todo ese rato nunca bajó de un paso
 * guardado de más, se achica en uno. Antes se esperaban 10 s fijos: tras un tirón el atraso
 * extra duraba casi un minuto.
 */
const SHRINK_AFTER = 90;
/**
 * Si el colchón se vacía al poco de achicarse, la red tiene saltos que se repiten: la próxima
 * revisión espera el doble, hasta este tope (12 s). Antes se achicaba a los 3 s, se vaciaba al
 * siguiente salto, crecía, y así toda la partida (60 a 110 vaciados por partida).
 */
const MAX_SHRINK_AFTER = 4 * SHRINK_AFTER;
/**
 * Un silencio más largo que esto no lo tapa ni el colchón más grande (8 pasos, 267 ms): es un
 * corte del wifi, no el vaivén de la red. Agrandar el colchón por él no evita el próximo y deja a
 * los rivales atrasados un buen rato (el 18 de noviembre, dos celulares en el mismo wifi
 * terminaron con el colchón lleno por tres cortes de medio segundo).
 */
const LONG_HOLE_MS = 300;
/** Si el colchón se pasa de su tamaño por más que esto, se alcanza más rápido (ver abajo). */
const CATCH_UP_SLACK = 2;
/**
 * Si hay uno o dos pasos de más por este rato (8 pasos), se adelanta uno. Sin esto el sobrante se
 * quedaba para siempre como atraso, aunque el colchón buscado fuera menor.
 */
const DRIFT_EVERY = 8;
/**
 * Cómo se adelanta: el paso de más no se muestra de golpe, se reparte reproduciendo un poco más
 * rápido (un 12% para uno suelto, un 25% o un 50% si llegó mucho junto) hasta que el dibujo
 * vuelve a calzar con un estado. Antes se mostraban dos estados en un cuadro: rivales, bestias y
 * hechizos daban un saltito varias veces por minuto en una red con vaivén.
 */
const DRIFT_RATE = 1 + 1 / DRIFT_EVERY;
const CATCH_UP_RATE = 1.25;
const FAST_CATCH_UP_RATE = 1.5;
/**
 * Si el colchón se vacía, los rivales, bestias y proyectiles siguen en la dirección que llevaban,
 * en vez de quedarse congelados: así se juega en una red móvil con hipos, como en los juegos en
 * línea grandes. Los primeros `COAST_FULL` pasos (133 ms) van a la misma velocidad; después
 * frenan de a poco hasta detenerse a los `COAST_STEPS` (333 ms). Antes paraban en seco a los
 * 200 ms, y en la prueba del 21 de noviembre los silencios del iPhone con Entel llegaban a 275 ms.
 */
const COAST_FULL = 4;
const COAST_STEPS = 10;
/** Más rápido que esto por paso (18 m/s) no es caminar: fue un salto o un teletransporte. */
const COAST_MAX_STEP = 0.6;
/**
 * Al volver los estados, lo que se dibujó de más se corrige de a poco: en el doble de los pasos
 * que se siguió de largo (y al menos estos), así el rival solo camina más lento un instante y
 * nunca hacia atrás. Una diferencia mayor que `SNAP_DISTANCE` se corrige de golpe.
 */
const CORRECT_STEPS = 4;
/** Si se juntan muchísimos (la pestaña estuvo en segundo plano), se salta directo. */
const HARD_SKIP = 30;
/**
 * Cuánto se intenta volver si se corta la conexión (con la app a la vista; al volver a la app
 * se cuenta de nuevo). Mientras tanto, la IA juega por ti.
 */
const RECONNECT_MS = 5 * 60_000;
const RECONNECT_EVERY_MS = 1500;
/**
 * Si un intento de conexión no contesta en este tiempo, se abandona y se intenta otro. Sin señal
 * (un túnel, un cambio de antena), el celular puede dejar el intento colgado un minuto o más: así
 * quedaba un amigo mirando una partida congelada aunque la señal ya hubiera vuelto. Alcanza para
 * conectar con 750 ms de ida y vuelta y algún paquete perdido.
 */
const CONNECT_TIMEOUT_MS = 8000;
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
/**
 * Cuando la Sala corrige a tu mago (te empujaron, chocaste, o un toque tuyo le llegó tarde), la
 * diferencia no se ve de golpe: se absorbe en unos pasos (queda un 72% en cada uno, la mitad en
 * ~70 ms). Antes tu mago daba un saltito adelante y atrás cada vez que la red se trababa un poco.
 */
const SELF_SMOOTH = 0.72;
/** Pasos cuyos eventos se recuerdan (unos 15 s) para no repetirlos si llegan por los dos canales. */
const EVENTS_REMEMBERED = 450;
/** Como mucho se arman estos estados seguidos que faltan (unos 260 ms); más es un corte. */
const MAX_FILLED = 8;
/**
 * Por el canal que no espera, cada mensaje de toques lleva también los anteriores sin confirmar
 * (hasta este total): si uno se pierde, el siguiente lo trae.
 */
const FAST_INTENT_REPEATS = 3;
/** Toques guardados a la espera de que el servidor los confirme (unos 4 s). */
const MAX_PENDING = 120;
/** Se lee al cargar la página, antes de que el menú limpie la dirección. */
const SIMULATED_LAG = LagSimulator.fromUrl(globalThis.location?.search ?? '');

/** Lo que tocaste en un paso, guardado hasta que el servidor lo confirme. */
interface SentInput {
  readonly seq: number;
  readonly move: Vec2;
  readonly intents: readonly Intent[];
  /** Cuándo salió, para medir cuánto tarda la Sala en confirmarlo. */
  readonly sentAt: number;
}

/** Cómo anduvo la red en una partida, para el resumen que va al registro remoto. */
export class NetSummary {
  /** Ida y vuelta de cada ping, en ms (como mucho unos 20 minutos de partida). */
  readonly pings: number[] = [];
  /** De tocar a ver tu toque en un estado de la Sala, en ms. */
  readonly acks: number[] = [];
  stalls = 0;
  maxTarget = 0;
  maxKbps = 0;
  biggest = 0;
  cuts = 0;
  /** Silencios de la Sala jugando: veces que pasó más de `HOLE_MS` sin estado, y el más largo. */
  holes = 0;
  longestHole = 0;
  /** El canal que no espera: cuánto tardó en abrir (ms, -1 si no abrió) y qué estados llegaron por él. */
  fastOpenMs = -1;
  fastFrames = 0;
  socketFrames = 0;
  /**
   * Cada 10 s desde que empezó la partida: el peor ping, cuántas veces se vació el colchón y
   * cuántos silencios hubo. Junto a la de los otros celulares y la de la Sala dice si se
   * trabaron todos a la vez (la Sala o una red compartida) o cada uno por su lado.
   */
  readonly timeline: { ping: number; stalls: number; holes: number }[] = [];
  private readonly startedAt: number;

  constructor(now = performance.now()) {
    this.startedAt = now;
  }

  /** Anota algo en su tramo de 10 s. */
  note(what: 'ping' | 'stall' | 'hole', value = 0, now = performance.now()): void {
    if (what === 'ping') sample(this.pings, value);
    else if (what === 'stall') this.stalls++;
    else this.holes++;
    const index = Math.floor((now - this.startedAt) / TIMELINE_STEP_MS);
    if (index < 0 || index >= TIMELINE_STEPS) return;
    while (this.timeline.length <= index) this.timeline.push({ ping: 0, stalls: 0, holes: 0 });
    const step = this.timeline[index];
    if (!step) return;
    if (what === 'ping') step.ping = Math.max(step.ping, Math.round(value));
    else if (what === 'stall') step.stalls++;
    else step.holes++;
  }

  /** Por dónde llegaron los estados: el canal que no espera (WebRTC) o el WebSocket. */
  fastLine(): string {
    const total = this.fastFrames + this.socketFrames;
    const share = total > 0 ? Math.round((this.fastFrames / total) * 100) : 0;
    if (this.fastOpenMs < 0) return `Canal rápido: no abrió · todo por WebSocket`;
    return `Canal rápido: abrió en ${this.fastOpenMs} ms · ${share}% de los estados por él`;
  }

  lines(buffer: number): string[] {
    if (this.pings.length === 0) return [];
    const ping = percentiles(this.pings);
    const ack = percentiles(this.acks);
    return [
      `Ping típico ${ping.p50} ms · peor 5% ${ping.p95} ms · máx ${ping.max} ms`,
      `Toque confirmado típico ${ack.p50} ms · peor 5% ${ack.p95} ms`,
      `Colchón final ${buffer} pasos · máx ${this.maxTarget} · vaciado ${this.stalls} veces · cortes ${this.cuts}`,
      `Llega hasta ${this.maxKbps} KB/s · estado más grande ${this.biggest} B`,
      `Silencios de más de ${HOLE_MS} ms: ${this.holes} · el más largo ${Math.round(this.longestHole)} ms`,
      this.fastLine(),
      `Red cada 10 s (ping máx/vacíos/silencios): ${this.timeline
        .map((step) => `${step.ping}/${step.stalls}/${step.holes}`)
        .join(' ')}`,
    ];
  }
}

const MAX_SAMPLES = 1200;
const TIMELINE_STEP_MS = 10_000;
/** Unos 20 minutos de partida. */
const TIMELINE_STEPS = 120;
/**
 * Jugando, la Sala manda un estado cada 33 ms: más de esto sin nada vacía el colchón chico. Si
 * los silencios son muchos y largos en todos los celulares de una sala a la vez, el atraso es de
 * la Sala o de la red que comparten; si es uno solo, de su conexión.
 */
const HOLE_MS = 100;

function sameWeave(a: readonly ElementId[], b: readonly ElementId[]): boolean {
  return a.length === b.length && a.every((element, i) => element === b[i]);
}

/** Lo que tarda en salir un tejido, como lo calcula el núcleo (sin estados que lo apuren). */
function castTicks(length: number, wizard: Wizard, rules: GameRules): number {
  const floor = rules.weave.castTicksByLength[0] ?? 1;
  const base = rules.weave.castTicksByLength[length - 1] ?? floor;
  return Math.max(floor, Math.round(base * wizard.mods.castTime));
}

function sample(list: number[], value: number): void {
  if (list.length < MAX_SAMPLES) list.push(value);
}

function percentiles(values: readonly number[]): { p50: number; p95: number; max: number } {
  if (values.length === 0) return { p50: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
  return { p50: at(0.5), p95: at(0.95), max: Math.round(sorted[sorted.length - 1] ?? 0) };
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
  /** Entra por Partida rápida (sala pública que empieza sola). */
  readonly quick?: boolean;
}

/**
 * Un duelo en red: la Sala corre la partida y manda el estado en cada paso; este celular solo
 * manda lo que tocas y muestra lo que llega, con un colchón de dos pasos para que se vea parejo.
 * Se ve igual que una partida local para el resto del juego.
 */
export class NetMatch implements MatchView {
  /** El modo lo elige quien creó la sala; llega con la lista de jugadores. */
  options: MatchOptions = {
    mode: DEFAULT_ROOM_SETTINGS.mode,
    deathRule: 'out',
    affinity: null,
    botLevel: DEFAULT_ROOM_SETTINGS.botLevel,
  };
  /** Los ajustes de la sala (modo, tiempo por ronda, rondas, Glifos, Presagio). */
  settings: RoomSettings = DEFAULT_ROOM_SETTINGS;
  /** Quién manda en la sala de espera (cambia los ajustes y empieza). */
  hostId = 0;
  /** Es una Partida rápida y, si corre la cuenta, cuándo empieza sola (`performance.now()`). */
  quick = false;
  quickStartsAt: number | null = null;
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
  /**
   * El paso cuyos eventos ya se mostraron. Entre rondas y en el resultado la Sala reenvía el
   * último estado de a ratos, con los eventos de su último paso: sin esto, el golpe final, las
   * explosiones y sus sonidos se repetían tres veces por segundo detrás del menú.
   */
  private eventsTick = -1;
  private target = BUFFER_MIN;
  private calmSteps = 0;
  /** Cuántos pasos tranquilos hacen falta para achicar el colchón (crece si achicar sale mal). */
  private shrinkAfter = SHRINK_AFTER;
  /** Pasos desde la última vez que se achicó el colchón. */
  private sinceShrink = Number.POSITIVE_INFINITY;
  /** Lo que había antes del último vaciado, por si resulta ser un corte largo (se deshace). */
  private beforeStall: { target: number; shrinkAfter: number; sinceShrink: number } | null = null;
  /** Lo menos que tuvo el colchón (además del paso que se muestra) desde la última revisión. */
  private calmLow = Number.POSITIVE_INFINITY;
  /** Pasos seguidos con algo de sobra en el colchón. */
  /**
   * Cuánto va el dibujo pasado el estado mostrado, hacia el siguiente guardado (0 a 1). Es lo que
   * permite reproducir más rápido o más lento sin saltos (ver `DRIFT_RATE`).
   */
  private lead = 0;
  /** El ritmo del adelanto en curso (0: ninguno). */
  private catchUp = 0;
  private driftSteps = 0;
  /** Dónde queda cada cosa al terminar este paso (con `lead`); al empezar, en `previous`. */
  private readonly ahead = new Map<number, Vec2>();
  /** El reloj de las animaciones (en pasos), al empezar y al terminar el paso que se dibuja. */
  private clockFrom = 0;
  private clockTo = 0;
  private stalls = 0;
  /**
   * Mientras el colchón está vacío jugando: cuántos pasos lleva esperando y hacia dónde iba cada
   * cosa (metros por paso). Ver `COAST_STEPS`.
   */
  private coast: { steps: number; velocity: Map<number, Vec2> } | null = null;
  /** Dónde estaba cada cosa al empezar a seguir de largo. */
  private coastFrom = new Map<number, Vec2>();
  /** Lo que se dibujó de más al seguir de largo, que se va corrigiendo (ver `CORRECT_STEPS`). */
  private correction: { left: number; total: number; offsets: Map<number, Vec2> } | null = null;
  private summary = new NetSummary();
  /** El último toque cuya confirmación ya se midió. */
  private ackMeasured = 0;
  private ping = 0;
  /** El estado más nuevo que llegó (el que se muestra va un poco atrás, por el colchón). */
  private latest: StateMessage | null = null;
  private readonly sent: SentInput[] = [];
  /** Dónde se predice tu mago ahora y dónde estaba en el paso anterior. */
  private predicted: Vec2 | null = null;
  /** Tu mago como se dibuja (predicho más la corrección que se está absorbiendo). */
  private shownSelf: Vec2 | null = null;
  private shownSelfBefore: Vec2 | null = null;
  private selfOffset: Vec2 = { x: 0, z: 0 };
  /** El último toque que entró en la predicción anterior. */
  private predictedSeq = 0;
  private predictedWeave: Wizard['weave'] = [];
  private predictedFacing: Vec2 | null = null;
  /** Tu conjuro en curso como se ve aquí: empieza al tocar ✦, sin esperar a la Sala. */
  private predictedChannel: Wizard['channel'] = null;
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
  /** El canal que no espera (WebRTC) de la conexión actual, si la Sala lo ofreció. */
  private fast: FastLink | null = null;
  /**
   * El último estado jugando que se aceptó (ronda y paso) y por dónde llegó: con dos canales, uno
   * repetido o más viejo se descarta.
   */
  private lastFrameKey = -1;
  private lastFrameFast = false;
  /** El último estado jugando que entró al colchón: si falta alguno entre él y el próximo, se arma. */
  private lastPlaying: StateFrame | null = null;
  /** Eventos de estados perdidos que llegaron en uno viejo: van con el próximo. */
  private pendingEvents: GameEvent[] = [];
  /** Los pasos (`frameKey`) cuyos eventos ya se vieron, por si llegan de nuevo por el otro canal. */
  private readonly eventsSeen = new Set<number>();
  /** Los últimos segundos recibidos y la mejor jugada, para repetirla al final. */
  private readonly recorder = new ReplayRecorder();
  /** Rivales que la Sala dice que no ves: no se dibujan aunque lleguen en el estado. */
  private hidden: ReadonlySet<number> = new Set();
  private readonly lag = SIMULATED_LAG;
  private lastError = '';
  /** Volviste a la misma partida (tras un corte o al volver a la app): sigue sin rearmar nada. */
  private resuming = false;
  private lastHeard = 0;
  /** Cuándo se abrió la conexión actual (para el registro de errores). */
  private openedAt = 0;
  private hiddenAt = 0;
  private returnCheck: ReturnType<typeof setTimeout> | null = null;
  private readonly onVisibility = (): void => this.visibilityChanged();
  private readonly onOnline = (): void => this.retryNow();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private bytesIn = 0;
  /** Cuándo llegó el último estado jugando (0: no se mide, tras un corte o entre rondas). */
  private lastFrameAt = 0;
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
        this.sendFastIntents(seq, intents);
        const move = intents.find((i) => i.kind === 'move');
        this.sent.push({
          seq,
          move: move?.kind === 'move' ? { x: move.x, z: move.z } : { x: 0, z: 0 },
          intents,
          sentAt: performance.now(),
        });
        if (this.sent.length > MAX_PENDING) this.sent.shift();
        const lock = [...intents].reverse().find((i) => i.kind === 'lockTarget');
        if (lock?.kind === 'lockTarget') this.pendingLock = { seq, target: lock.targetId };
      }
    }
    let resumed = false;
    if (!this.primed) {
      if (this.buffer.length < this.target) {
        this.hold();
        return [];
      }
      this.primed = true;
      resumed = this.coast !== null;
    }
    const events: GameEvent[] = [];
    // Vuelven los estados tras seguir de largo: lo atrasado se salta hasta el colchón buscado
    // (sus efectos y sonidos sí se juntan). Los rivales ya se dibujaron más o menos ahí; antes se
    // volvía a recorrer todo al doble de rápido, y se notaba como un rival que se aceleraba.
    // La pestaña estuvo en segundo plano: también se salta directo, sin perder lo que pasó.
    if (resumed || this.buffer.length > HARD_SKIP) {
      while (this.buffer.length > this.target) this.consume(events);
      this.lead = 0;
      this.catchUp = 0;
    }
    if (this.buffer.length === 0) {
      // Se vació: se espera a juntar de nuevo y el colchón crece para la próxima.
      if (this.netStage.kind === 'playing') {
        this.stalls++;
        this.summary.note('stall');
        this.beforeStall = {
          target: this.target,
          shrinkAfter: this.shrinkAfter,
          sinceShrink: this.sinceShrink,
        };
        this.target = Math.min(BUFFER_LIMIT, this.target + 1);
        this.summary.maxTarget = Math.max(this.summary.maxTarget, this.target);
        if (this.sinceShrink < 2 * this.shrinkAfter) {
          this.shrinkAfter = Math.min(MAX_SHRINK_AFTER, this.shrinkAfter * 2);
        }
        this.sinceShrink = Number.POSITIVE_INFINITY;
        this.calmSteps = 0;
        this.calmLow = Number.POSITIVE_INFINITY;
      }
      this.primed = false;
      this.hold();
      return events;
    }
    const coasted = this.coast;
    this.coast = null;
    // El dibujo de este paso parte donde terminó el anterior, aunque se muestren dos estados:
    // antes se guardaba después del primero y el rival saltaba un paso entero.
    this.rememberPositions();
    const clockFrom = this.clockTo;
    // Un estado por paso, más lo que se vaya adelantando de a poco (ver `DRIFT_RATE`).
    this.lead += this.playbackRate() - 1;
    this.consume(events);
    while (this.lead >= 1 && this.buffer.length > 0) {
      this.consume(events);
      this.lead -= 1;
    }
    // No hay a qué acercarse: el dibujo llega al último estado y espera ahí.
    if (this.buffer.length === 0) this.lead = 0;
    this.aimAhead();
    this.moveClock(clockFrom, this.state.tick + this.lead);
    if (coasted) this.startCorrection(coasted);
    else if (this.correction && --this.correction.left <= 0) this.correction = null;
    this.calmLow = Math.min(this.calmLow, this.buffer.length);
    this.sinceShrink++;
    if (++this.calmSteps >= this.shrinkAfter) {
      // Se achica solo si siempre sobraron dos: con uno, el mismo salto de red que se vio en
      // estos segundos lo dejaría vacío apenas achicado.
      if (this.target > BUFFER_MIN && this.calmLow >= 2) {
        this.target--;
        this.sinceShrink = 0;
      }
      this.calmSteps = 0;
      this.calmLow = Number.POSITIVE_INFINITY;
    }
    return events;
  }

  /**
   * A qué ritmo se reproduce este paso (1: normal). Un adelanto empezado se termina hasta calzar
   * con un estado, así el ritmo cambia pocas veces y nunca a medias.
   */
  private playbackRate(): number {
    const over = this.buffer.length - this.target;
    if (over > CATCH_UP_SLACK) {
      this.catchUp = over > CATCH_UP_SLACK + 1 ? FAST_CATCH_UP_RATE : CATCH_UP_RATE;
      this.driftSteps = 0;
    } else if (over > 0) {
      if (this.catchUp === 0 && ++this.driftSteps >= DRIFT_EVERY) {
        this.catchUp = DRIFT_RATE;
        this.driftSteps = 0;
      }
    } else {
      this.driftSteps = 0;
      if (this.lead === 0) this.catchUp = 0;
    }
    if (this.catchUp === 0 && this.lead > 0) this.catchUp = DRIFT_RATE;
    return this.catchUp || 1;
  }

  /**
   * Dónde termina cada cosa en este paso: entre el estado mostrado y el siguiente guardado, según
   * `lead`. Lo que no está en los dos (recién aparecido o por desaparecer) se queda donde está.
   */
  private aimAhead(): void {
    this.ahead.clear();
    const next = this.buffer[0]?.state;
    if (!next || this.lead <= 0) return;
    const t = this.lead;
    const target = new Map<number, Vec2>();
    for (const wizard of next.wizards) target.set(wizard.id, wizard.pos);
    for (const beast of next.beasts) target.set(beast.id, beast.pos);
    for (const spell of next.spells) if (movesSmoothly(spell)) target.set(spell.id, spell.pos);
    const add = (id: number, from: Vec2): void => {
      const to = target.get(id);
      // Un salto (teletransporte, Sombra) no se reparte: se ve al mostrarse su estado.
      if (!to || distance(from, to) > SNAP_DISTANCE) return;
      this.ahead.set(id, { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
    };
    for (const wizard of this.state.wizards) add(wizard.id, wizard.pos);
    for (const beast of this.state.beasts) add(beast.id, beast.pos);
    for (const spell of this.state.spells) if (movesSmoothly(spell)) add(spell.id, spell.pos);
  }

  /**
   * El reloj de las animaciones avanza parejo, nunca hacia atrás: antes era el paso del estado
   * mostrado, que con el colchón vacío se repetía (las animaciones retrocedían un paso en cada
   * cuadro de espera) y al mostrar dos estados saltaba.
   */
  private moveClock(from: number, to: number): void {
    // Otra ronda (el reloj vuelve a cero) o un salto grande: se toma el nuevo de una vez.
    const fresh = to < from - 30 || to > from + HARD_SKIP;
    this.clockFrom = fresh ? to : from;
    this.clockTo = fresh ? to : Math.max(from, to);
  }

  /** El paso (con decimales) que muestran las animaciones a esa altura del cuadro. */
  displayTick(alpha: number): number {
    if (this.stage.kind !== 'playing') return this.state.tick + alpha;
    return this.clockFrom + (this.clockTo - this.clockFrom) * alpha;
  }

  /** Muestra el siguiente estado guardado y junta lo que pasó en él. */
  private consume(events: GameEvent[]): void {
    const next = this.buffer.shift();
    if (!next) return;
    this.apply(next);
    // Para la repetición basta guardar la referencia: cada estado llega nuevo y nadie lo toca.
    this.recorder.push({ state: next.state, hidden: next.hidden });
    this.recorder.offer(next.best ?? null);
    if (next.state.tick === this.eventsTick) return;
    this.eventsTick = next.state.tick;
    events.push(...next.state.events);
  }

  /** Quien manda cambia los ajustes de la sala (los demás los ven al instante). */
  configure(settings: RoomSettings): void {
    this.send({ type: 'settings', settings });
  }

  private useSettings(settings: RoomSettings): void {
    this.settings = settings;
    this.options = { ...this.options, mode: settings.mode, botLevel: settings.botLevel };
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

  /** Al terminar la serie: lo que hizo cada mago, según la Sala. */
  /** Al terminar: la mejor jugada (o el desenlace) con lo que este celular recibió. */
  replayClip(): ReplayClip | null {
    return this.netStage.kind === 'finished' ? this.recorder.clip() : null;
  }

  matchSummary(): MatchSummary | null {
    if (this.netStage.kind !== 'finished') return null;
    return {
      id: `red-${this.code}-${this.netStage.seriesId}`,
      stats: this.netStage.stats,
      highlight: this.netStage.highlight ?? null,
    };
  }

  /** Al terminar la serie: cuántos piden revancha, cuántos hacen falta y si ya la pediste. */
  rematchStatus(): RematchStatus | null {
    if (this.netStage.kind !== 'finished') return null;
    const asked = new Set(this.netStage.rematch);
    // Quien está fuera de la app no frena la revancha (la Sala tampoco lo espera).
    const humans = this.roster.filter((p) => !p.bot && p.connected && !p.away);
    return {
      asked: humans.filter((p) => asked.has(p.id)).length,
      needed: humans.length,
      mine: this.rematchAsked || asked.has(this.playerId),
    };
  }

  glyphsOf(id: number): readonly Glyph[] {
    return (this.glyphIds[id] ?? []).map(glyphById).filter((g): g is Glyph => g !== undefined);
  }

  /** Posición entre el paso anterior y el actual, según `alpha` (0 a 1). Tu mago va predicho. */
  interpolated(id: number, current: Vec2, alpha: number): Vec2 {
    if (id === this.playerId && this.shownSelf) {
      const from = this.shownSelfBefore;
      const to = this.shownSelf;
      if (!from || distance(from, to) > SNAP_DISTANCE) return to;
      return { x: from.x + (to.x - from.x) * alpha, z: from.z + (to.z - from.z) * alpha };
    }
    if (this.stage.kind !== 'playing') return current;
    const coast = this.coast;
    if (coast) {
      // Sin estado nuevo: sigue de largo en la dirección que llevaba (ver `COAST_STEPS`).
      const velocity = coast.velocity.get(id);
      if (!velocity) return current;
      const t = coastDistance(coast.steps - 1 + alpha);
      return { x: current.x + velocity.x * t, z: current.z + velocity.z * t };
    }
    const before = this.previous.get(id);
    if (!before) return current;
    const end = this.ahead.get(id) ?? current;
    const x = before.x + (end.x - before.x) * alpha;
    const z = before.z + (end.z - before.z) * alpha;
    const offset = this.correction?.offsets.get(id);
    if (!offset || !this.correction) return { x, z };
    // Lo dibujado de más al seguir de largo se absorbe en unos pasos, sin tirón hacia atrás.
    const keep = Math.max(0, (this.correction.left - alpha) / this.correction.total);
    return { x: x + offset.x * keep, z: z + offset.z * keep };
  }

  /**
   * Al volver los estados tras seguir de largo: cuánto se adelantó (o desvió) lo dibujado
   * respecto de donde parte este paso, para corregirlo de a poco en vez de saltar.
   */
  private startCorrection(coasted: { steps: number; velocity: Map<number, Vec2> }): void {
    const t = coastDistance(coasted.steps);
    const offsets = new Map<number, Vec2>();
    for (const [id, velocity] of coasted.velocity) {
      const from = this.coastFrom.get(id);
      const start = this.previous.get(id);
      if (!from || !start) continue;
      const offset = {
        x: from.x + velocity.x * t - start.x,
        z: from.z + velocity.z * t - start.z,
      };
      if (Math.hypot(offset.x, offset.z) <= SNAP_DISTANCE) offsets.set(id, offset);
    }
    const total = Math.max(CORRECT_STEPS, Math.round(2 * t));
    this.correction = offsets.size > 0 ? { left: total, total, offsets } : null;
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
      channel: this.predictedChannel,
      facing: !this.predictedChannel && this.predictedFacing ? this.predictedFacing : wizard.facing,
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
    const believed = this.predicted;
    const believedSeq = this.predictedSeq;
    this.shownSelfBefore = this.shownSelf;
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
      this.predictedChannel = null;
      this.shownSelf = null;
      this.shownSelfBefore = null;
      this.selfOffset = { x: 0, z: 0 };
      this.sent.length = 0;
      return;
    }
    while (this.sent.length > 0 && (this.sent[0]?.seq ?? 0) <= latest.ack) this.sent.shift();
    const rules = liveRules(latest.state, this.rules);
    let pos = me.pos;
    // Dónde te pone ahora la Sala en el mismo momento que la predicción anterior (con los mismos
    // toques jugados): la diferencia con lo que se creía es lo que corrigió.
    let posThen = me.pos;
    let weave = [...me.weave];
    let facing: Vec2 | null = null;
    let channel: Wizard['channel'] = me.channel;
    // Cuántos pasos lleva el conjuro que tocaste y la Sala todavía no jugó.
    let channelSteps = 0;
    for (const input of this.sent) {
      pos = walkTarget(latest.state, { ...me, pos }, input.move, rules);
      if (input.seq <= believedSeq) posThen = pos;
      if (input.move.x !== 0 || input.move.z !== 0) facing = normalize(input.move, me.facing);
      if (channel && channel !== me.channel) channelSteps++;
      for (const intent of input.intents) {
        if (intent.kind === 'weave' && weave.length < 3) weave.push(intent.element);
        else if (intent.kind === 'cancelWeave' && !channel) weave = [];
        else if (intent.kind === 'cast') {
          if (weave.length > 0 && !channel && canWeave(me)) {
            channel = {
              ticksLeft: castTicks(weave.length, me, rules),
              weave,
              aim: { x: intent.dirX, z: intent.dirZ },
            };
            channelSteps = 0;
          }
          weave = [];
        }
      }
    }
    if (channel && channel !== me.channel) {
      // Solo para verlo: la Sala decide cuándo sale. Se queda en el último paso hasta que llegue.
      channel = { ...channel, ticksLeft: Math.max(1, channel.ticksLeft - channelSteps) };
    }
    this.predicted = pos;
    this.predictedSeq = this.sent.at(-1)?.seq ?? latest.ack;
    this.smoothSelf(believed, posThen, pos);
    this.predictedWeave = weave;
    this.predictedFacing = facing;
    // Cuando la Sala confirma el conjuro va algo más atrás que lo que ya se vio: no retrocede.
    const before = this.predictedChannel;
    if (channel && before && sameWeave(before.weave, channel.weave)) {
      channel = { ...channel, ticksLeft: Math.min(channel.ticksLeft, before.ticksLeft) };
    }
    this.predictedChannel = channel;
  }

  /**
   * Tu mago dibujado: lo predicho más lo que queda de la última corrección. `believed` es dónde
   * se creía que estabas y `posThen` dónde dice ahora la Sala para ese mismo momento.
   */
  private smoothSelf(believed: Vec2 | null, posThen: Vec2, pos: Vec2): void {
    let { x, z } = this.selfOffset;
    if (believed && this.shownSelf) {
      const dx = believed.x - posThen.x;
      const dz = believed.z - posThen.z;
      // Un salto de verdad (teletransporte, Sombra) se ve de golpe.
      if (Math.hypot(x + dx, z + dz) <= SNAP_DISTANCE) {
        x += dx;
        z += dz;
      } else {
        x = 0;
        z = 0;
      }
    } else {
      x = 0;
      z = 0;
    }
    x *= SELF_SMOOTH;
    z *= SELF_SMOOTH;
    if (Math.abs(x) < 0.002 && Math.abs(z) < 0.002) {
      x = 0;
      z = 0;
    }
    this.selfOffset = { x, z };
    this.shownSelf = x === 0 && z === 0 ? pos : { x: pos.x + x, z: pos.z + z };
  }

  /** Te vas de la sala: la IA juega por ti. */
  close(): void {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.returnCheck) clearTimeout(this.returnCheck);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.closeFast();
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
    this.closeFast();
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (socket !== this.socket || socket.readyState !== WebSocket.CONNECTING) return;
      this.abandon(socket, 4005);
    }, CONNECT_TIMEOUT_MS);
    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;
      if (this.lostAt !== 0) {
        this.listener.notice('Conexión recuperada');
        const seconds = Math.round((Date.now() - this.lostAt) / 1000);
        reportProblem('red', 'Conexión recuperada', `tras ${seconds} s`);
      }
      this.lostAt = 0;
      this.lastHeard = performance.now();
      this.openedAt = this.lastHeard;
      this.lastFrameAt = 0;
      this.send({
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        playerName: this.profile.name,
        look: this.profile.look,
        affinity: this.profile.affinity,
        ...(this.token ? { token: this.token } : {}),
        ...(this.profile.quick ? { quick: true } : {}),
        // Con la red simulada (?lag=) todo va por el WebSocket, para que la prueba valga.
        ...(fastLinkSupported() && !this.lag ? { fast: true } : {}),
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
    this.closeFast();
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
      this.summary.cuts++;
      this.listener.problem('Se cortó la conexión: reconectando…', false);
      const connected =
        this.openedAt > 0 ? Math.round((performance.now() - this.openedAt) / 1000) : 0;
      reportProblem(
        'red',
        'Se cortó la conexión',
        `código ${code} · ${connected} s conectado · ${this.started ? 'jugando' : 'sala de espera'}${document.hidden ? ' · app en segundo plano' : ''}`,
      );
    }
    if (now - this.lostAt > RECONNECT_MS) {
      this.listener.problem('No se pudo volver a la sala', true);
      reportProblem('red', 'No se pudo volver a la sala', `código ${code}`);
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
      this.abandon(socket, 4004);
      return;
    }
    this.send({ type: 'ping', sentAt: performance.now() });
  }

  /** Da por muerto un socket que no contesta y sigue como si se hubiera cortado. */
  private abandon(socket: WebSocket, code: number): void {
    try {
      socket.close(code);
    } catch {
      // Ya estaba cerrándose.
    }
    this.onClose(socket, code);
  }

  /**
   * Volvió la señal: no se espera al próximo intento. Si había uno colgado (empezó sin señal),
   * se abandona y se intenta de nuevo ya.
   */
  private retryNow(): void {
    if (this.closed || this.lostAt === 0) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.connect();
      return;
    }
    const socket = this.socket;
    if (socket?.readyState === WebSocket.CONNECTING) {
      this.socket = null;
      try {
        socket.close();
      } catch {
        // Ya estaba cerrándose.
      }
      this.connect();
    }
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
          this.abandon(socket, 4004);
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
    this.ahead.clear();
    this.lead = 0;
    this.catchUp = 0;
    this.coast = null;
    this.correction = null;
    this.sent.length = 0;
    this.pendingLock = null;
    this.resuming = true;
    this.awaitingFirst = true;
    this.lastFrameKey = -1;
    this.lastPlaying = null;
    this.pendingEvents = [];
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        if (this.started && message.lobby) {
          // Volviste tras un corte, pero la Sala amaneció vacía: se reinició y la partida se perdió.
          // Antes quedabas mirando una partida congelada sin saber por qué.
          this.listener.problem(
            'La sala se reinició y la partida se perdió. Vuelve al menú desde Pausa y creen otra sala.',
            true,
          );
          reportProblem('red', 'La sala se reinició y la partida se perdió');
          this.close();
          return;
        }
        this.playerId = message.playerId;
        this.token = message.token;
        return;
      case 'players':
        this.roster = message.players;
        this.hostId = message.hostId;
        this.quick = message.quick === true;
        this.quickStartsAt =
          message.startsIn === undefined ? null : performance.now() + message.startsIn;
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
        this.ahead.clear();
        this.lead = 0;
        this.catchUp = 0;
        this.coast = null;
        this.correction = null;
        this.rematchAsked = false;
        this.recorder.reset();
        this.summary = new NetSummary();
        this.summary.maxTarget = this.target;
        // El canal suele abrir en la sala de espera: se cuenta en el resumen de la partida.
        if (this.fast?.open) {
          this.summary.fastOpenMs = Math.round(this.fast.openedAt - this.fast.startedAt);
        }
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
        this.lastFrameKey = -1;
        this.lastPlaying = null;
        this.pendingEvents = [];
        this.eventsSeen.clear();
        return;
      case 'rtcOffer':
        this.openFast(message.sdp);
        return;
      case 'pong':
        this.ping = Math.round(performance.now() - message.sentAt);
        if (this.netStage.kind === 'playing') {
          this.summary.note('ping', this.ping);
          this.summary.maxKbps = Math.max(this.summary.maxKbps, this.kbps);
          this.summary.biggest = Math.max(this.summary.biggest, this.biggest);
        }
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
        reportProblem('red', `La Sala respondió: ${message.reason}`);
        return;
    }
  }

  /** Un estado en binario: se arma sobre el anterior. Si algo no calza, se reconecta. */
  private receiveFrame(socket: WebSocket, data: Uint8Array): void {
    let frame: StateFrame;
    try {
      frame = this.decoder.decode(data) as StateFrame;
    } catch (error) {
      // Se perdió el hilo: al reconectar, la Sala manda un estado completo.
      reportProblem(
        'red',
        'Estado ilegible',
        error instanceof Error ? (error.stack ?? error.message) : '',
      );
      socket.close(4003, 'Estado ilegible');
      return;
    }
    this.accept(frame, false);
  }

  /**
   * Un estado armado, venga por el WebSocket o por el canal que no espera (con los eventos de los
   * que se perdieron por él). Cada paso se muestra una vez y cada evento suena una vez, aunque
   * llegue por los dos lados o desordenado.
   */
  private accept(frame: StateFrame, fast: boolean, missed: readonly MissedEvents[] = []): void {
    if (!this.started) return;
    const key = frameKey(frame);
    const fresh: GameEvent[] = [];
    for (const group of missed) {
      if (this.firstSeen(group.key)) fresh.push(...(group.events as GameEvent[]));
    }
    if (this.firstSeen(key)) fresh.push(...frame.state.events);
    if (frame.stage.kind === 'playing') {
      // Repetido (por el otro canal) o más viejo que el último: no se muestra, pero sus eventos sí.
      if (key < this.lastFrameKey || (key === this.lastFrameKey && fast !== this.lastFrameFast)) {
        this.pendingEvents.push(...fresh);
        return;
      }
      this.lastFrameKey = key;
      this.lastFrameFast = fast;
    }
    if (fast) this.summary.fastFrames++;
    else this.summary.socketFrames++;
    const events = this.pendingEvents.length > 0 ? [...this.pendingEvents, ...fresh] : fresh;
    this.pendingEvents = [];
    if (
      events.length !== frame.state.events.length ||
      events.some((e, i) => e !== frame.state.events[i])
    ) {
      frame = { ...frame, state: { ...frame.state, events } };
    }
    this.measureHole(frame);
    // El primer estado de una partida se muestra en el acto: trae los magos que hay que dibujar.
    this.latest = frame;
    this.measureAck(frame.ack);
    if (this.awaitingFirst) {
      this.awaitingFirst = false;
      this.apply(frame);
      this.lastPlaying = frame.stage.kind === 'playing' ? frame : null;
      if (this.resuming) this.resuming = false;
      else this.listener.start(this);
      return;
    }
    // Faltan estados entre el anterior y este (se perdieron por el canal que no espera, o la Sala
    // se atrasó y saltó pasos): se arman los del medio para que el colchón no se vacíe.
    if (this.lastPlaying) this.buffer.push(...framesBetween(this.lastPlaying, frame, MAX_FILLED));
    this.lastPlaying = frame.stage.kind === 'playing' ? frame : null;
    this.buffer.push(frame);
  }

  /** Si los eventos de ese paso (`frameKey`) no se habían visto todavía; desde ahora, sí. */
  private firstSeen(key: number): boolean {
    if (this.eventsSeen.has(key)) return false;
    this.eventsSeen.add(key);
    // Basta recordar los últimos segundos: los más viejos ya no vuelven.
    if (this.eventsSeen.size > EVENTS_REMEMBERED) {
      const oldest = this.eventsSeen.values().next().value;
      if (oldest !== undefined) this.eventsSeen.delete(oldest);
    }
    return true;
  }

  /** La Sala ofreció el canal que no espera: se contesta y, si abre, los estados llegan por él. */
  private openFast(offer: string): void {
    this.closeFast();
    const socket = this.socket;
    if (!fastLinkSupported() || this.lag || !socket) return;
    const link = new FastLink({
      opened: () => {
        if (this.fast !== link) return;
        if (this.summary.fastOpenMs < 0) {
          this.summary.fastOpenMs = Math.round(link.openedAt - link.startedAt);
        }
      },
      frame: (raw, missed, bytes) => {
        if (this.fast !== link || socket !== this.socket) return;
        this.lastHeard = performance.now();
        this.countBytes(bytes);
        this.accept(raw as StateFrame, true, missed);
      },
    });
    this.fast = link;
    link
      .answer(offer)
      .then((sdp) => {
        if (sdp && this.fast === link) this.send({ type: 'rtcAnswer', sdp });
      })
      .catch((error: unknown) => {
        if (this.fast === link) this.closeFast();
        reportProblem('red', 'Canal rápido no abrió', error instanceof Error ? error.message : '');
      });
  }

  /** Los últimos toques sin confirmar, también por el canal que no espera (llegan sin esperas). */
  private sendFastIntents(seq: number, intents: readonly Intent[]): void {
    const fast = this.fast;
    if (!fast?.open) return;
    const batches = this.sent
      .slice(-(FAST_INTENT_REPEATS - 1))
      .map((s) => ({ seq: s.seq, intents: [...s.intents] }));
    batches.push({ seq, intents: [...intents] });
    fast.send(encode({ type: 'intentsBatch', batches }));
  }

  private closeFast(): void {
    this.fast?.close();
    this.fast = null;
  }

  /** Cuánto pasó desde el estado anterior, si se está jugando (entre rondas llegan de a ratos). */
  private measureHole(frame: StateFrame): void {
    const now = performance.now();
    // Con la app en segundo plano el celular retiene los mensajes: eso no es un silencio de la red.
    const playing = frame.stage.kind === 'playing' && !document.hidden;
    if (playing && this.lastFrameAt > 0) {
      const gap = now - this.lastFrameAt;
      if (gap > HOLE_MS) this.summary.note('hole', gap, now);
      this.summary.longestHole = Math.max(this.summary.longestHole, gap);
      // El colchón se vació en este silencio y fue un corte largo: crecer no habría servido.
      if (gap > LONG_HOLE_MS && this.beforeStall && !this.primed) {
        this.target = this.beforeStall.target;
        this.shrinkAfter = this.beforeStall.shrinkAfter;
        this.sinceShrink = this.beforeStall.sinceShrink;
      }
    }
    // Llegó algo: el último vaciado ya quedó juzgado.
    if (playing) this.beforeStall = null;
    this.lastFrameAt = playing ? now : 0;
  }

  /** Cuánto tardó en volver confirmado el toque más nuevo que la Sala ya jugó. */
  private measureAck(ack: number): void {
    if (ack <= this.ackMeasured) return;
    this.ackMeasured = ack;
    const input = this.sent.find((s) => s.seq === ack);
    if (input) sample(this.summary.acks, performance.now() - input.sentAt);
  }

  /** Cómo anduvo la conexión en esta partida (para el registro remoto). */
  networkSummary(): string[] {
    const lines = this.summary.lines(this.target);
    return lines.length > 0
      ? [...lines, `Servidor de salas: ${roomsServerName(this.code)}`]
      : lines;
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

  /**
   * Sin estado nuevo que mostrar (el colchón se vació): todo se queda donde está. Antes el dibujo
   * volvía a recorrer el último paso en cada cuadro de espera, y los rivales y sus hechizos
   * saltaban hacia atrás y adelante: caminaban "de a jalones".
   */
  private hold(): void {
    if (this.netStage.kind === 'playing' && this.state.wizards.length > 0) {
      if (!this.coast) this.coast = { steps: 0, velocity: this.velocities() };
      this.coast.steps++;
    } else {
      this.coast = null;
    }
    this.correction = null;
    this.rememberPositions();
    this.lead = 0;
    this.catchUp = 0;
    this.ahead.clear();
    // Las animaciones siguen corriendo mientras se espera (ver `moveClock`).
    this.moveClock(this.clockTo, this.clockTo + (this.coast ? 1 : 0));
    if (this.coast?.steps === 1) this.coastFrom = new Map(this.previous);
  }

  /** Hacia dónde iba cada cosa en el último paso mostrado (metros por paso). */
  private velocities(): Map<number, Vec2> {
    const velocity = new Map<number, Vec2>();
    const add = (id: number, pos: Vec2): void => {
      const before = this.previous.get(id);
      if (!before) return;
      const step = { x: pos.x - before.x, z: pos.z - before.z };
      const length = Math.hypot(step.x, step.z);
      if (length > 0 && length <= COAST_MAX_STEP) velocity.set(id, step);
    };
    for (const wizard of this.state.wizards) {
      // Tu mago va predicho; quien está fuera de combate no camina.
      if (wizard.id !== this.playerId && wizard.hp > 0) add(wizard.id, wizard.pos);
    }
    for (const beast of this.state.beasts) add(beast.id, beast.pos);
    for (const spell of this.state.spells) if (movesSmoothly(spell)) add(spell.id, spell.pos);
    return velocity;
  }

  /** Dónde empieza el dibujo del paso: donde terminó el anterior (con `lead`, si iba adelantado). */
  private rememberPositions(): void {
    this.previous.clear();
    const remember = (id: number, pos: Vec2): void => {
      this.previous.set(id, this.ahead.get(id) ?? pos);
    };
    for (const wizard of this.state.wizards) remember(wizard.id, wizard.pos);
    // Las bestias también: dibujadas paso a paso, a 60 cuadros avanzaban a saltos de 30.
    for (const beast of this.state.beasts) remember(beast.id, beast.pos);
    for (const spell of this.state.spells) if (movesSmoothly(spell)) remember(spell.id, spell.pos);
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

/** Los hechizos que se mueven solos y se dibujan entre pasos (los demás quedan fijos). */
type MovingSpell = Extract<
  SpellEntity,
  { kind: 'projectile' | 'summon' | 'sweeper' | 'guidedBolt' }
>;
function movesSmoothly(spell: SpellEntity): spell is MovingSpell {
  return (
    spell.kind === 'projectile' ||
    spell.kind === 'summon' ||
    spell.kind === 'sweeper' ||
    spell.kind === 'guidedBolt'
  );
}

/**
 * Cuánto avanza (en pasos de su velocidad) lo que sigue de largo tras `t` pasos sin estados:
 * igual que antes hasta `COAST_FULL`, luego frena parejo hasta quedarse quieto en `COAST_STEPS`.
 */
export function coastDistance(t: number): number {
  if (t <= COAST_FULL) return Math.max(0, t);
  const braking = COAST_STEPS - COAST_FULL;
  const u = Math.min(t, COAST_STEPS) - COAST_FULL;
  return COAST_FULL + u - (u * u) / (2 * braking);
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
        highlight: stage.highlight ?? null,
      };
    case 'choosing':
      if (stage.chosen) return { kind: 'waiting' };
      return {
        kind: 'choosing',
        options: stage.options.map(glyphById).filter((g): g is Glyph => g !== undefined),
        secondsLeft: stage.ticksLeft / TICK_RATE,
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
