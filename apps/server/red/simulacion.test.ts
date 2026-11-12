/**
 * Simulación de una prueba en red con amigos, contra una Sala de verdad (`pnpm dev:server`).
 * Cada "celular" es un cliente sin pantalla que juega con la IA del núcleo, con lag, paquetes
 * perdidos, salidas a WhatsApp y cortes de señal. No corre en CI: se lanza con
 *
 *   SALA=http://127.0.0.1:8787 pnpm exec vitest run --config apps/server/red/vitest.config.ts
 *
 * Variables: JUGADORES (6), MODO (equipos3 | libre6 | libre4 | equipos2 | duelo), SEGUNDOS (150),
 * LAG (ms de ida y vuelta, 150), PERDIDA (% de mensajes que llegan tarde, 5), CAOS (1 = cortes).
 */
import { rulesForRoom } from '@crisol/content';
import { BotController, type GameMode, type Intent, type MatchState } from '@crisol/core';
import {
  DEFAULT_ROOM_SETTINGS,
  decodeServerMessage,
  encode,
  PROTOCOL_VERSION,
  type RoomSettings,
  StateDecoder,
  type StateFrame,
} from '@crisol/protocol';
import { expect, test } from 'vitest';

const BASE = process.env.SALA ?? '';
const PLAYERS = Number(process.env.JUGADORES ?? 6);
const SECONDS = Number(process.env.SEGUNDOS ?? 150);
const LAG = Number(process.env.LAG ?? 150);
const LOSS = Number(process.env.PERDIDA ?? 5) / 100;
const CHAOS = process.env.CAOS !== '0';
/** El último amigo llega tarde, con la partida en marcha (toma un mago de la IA). */
const LATE = process.env.TARDE === '1';
const MODES: Record<string, GameMode> = {
  duelo: { kind: 'duel' },
  equipos2: { kind: 'teams', size: 2 },
  equipos3: { kind: 'teams', size: 3 },
  libre4: { kind: 'ffa', players: 4 },
  libre6: { kind: 'ffa', players: 6 },
};
const MODE = MODES[process.env.MODO ?? 'equipos3'] ?? MODES.equipos3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Entrega en orden con retraso, como la red de un celular (un paquete perdido atrasa la fila). */
class Pipe {
  private last = 0;
  private readonly items: { at: number; run: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly oneWay: number,
    private readonly loss: number,
  ) {}
  push(run: () => void): void {
    const jitter = this.oneWay * 0.25 * (Math.random() * 2 - 1);
    let at = performance.now() + this.oneWay + jitter;
    if (Math.random() < this.loss) at += 220;
    at = Math.max(at, this.last);
    this.last = at;
    this.items.push({ at, run });
    if (!this.timer) this.arm();
  }
  /** Una sola fila con un solo temporizador: nunca sale un mensaje antes que el anterior. */
  private arm(): void {
    const head = this.items[0];
    if (!head) {
      this.timer = null;
      return;
    }
    this.timer = setTimeout(
      () => {
        const now = performance.now();
        while (this.items[0] && this.items[0].at <= now + 1) this.items.shift()?.run();
        this.arm();
      },
      Math.max(0, head.at - performance.now()),
    );
  }
}

interface Stats {
  frames: number;
  bytes: number;
  biggest: number;
  /** Cuadros que llegaron más de 250 ms después del anterior jugando. */
  stalls: number;
  worstGap: number;
  decodeErrors: number;
  tickJumps: number;
  errors: string[];
  reconnects: number;
  resumed: number;
  drops: number;
  aways: number;
  rtt: number[];
  wrongId: number;
  closes: string[];
}

class Phone {
  ws: WebSocket | null = null;
  token = '';
  playerId = 0;
  hostId = 0;
  seq = 0;
  frame: StateFrame | null = null;
  decoder = new StateDecoder();
  bot: BotController | null = null;
  settings: RoomSettings = DEFAULT_ROOM_SETTINGS;
  away = false;
  lastFrameAt = 0;
  lastTick = -1;
  playersSeen = 0;
  started = false;
  out: Pipe;
  inn: Pipe;
  stats: Stats = {
    frames: 0,
    bytes: 0,
    biggest: 0,
    stalls: 0,
    worstGap: 0,
    decodeErrors: 0,
    tickJumps: 0,
    errors: [],
    reconnects: 0,
    resumed: 0,
    drops: 0,
    aways: 0,
    rtt: [],
    wrongId: 0,
    closes: [],
  };
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly name: string,
    readonly code: string,
    lag: number,
    loss: number,
  ) {
    this.out = new Pipe(lag / 2, loss);
    this.inn = new Pipe(lag / 2, loss);
  }

  connect(): void {
    const url = `${BASE.replace(/^http/, 'ws')}/api/rooms/${this.code}/socket`;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.decoder = new StateDecoder();
    this.lastTick = -1;
    ws.onopen = () =>
      this.send({
        type: 'hello',
        protocol: PROTOCOL_VERSION,
        playerName: this.name,
        ...(this.token ? { token: this.token } : {}),
      });
    ws.onmessage = (event) => {
      if (ws !== this.ws) return;
      const data = event.data;
      this.inn.push(() => {
        if (ws !== this.ws) return;
        this.receive(data);
      });
    };
    ws.onclose = (event) => {
      if (ws === this.ws) this.stats.closes.push(`${event.code} ${event.reason}`);
    };
    if (!this.timer) this.timer = setInterval(() => this.step(), 1000 / 30);
  }

  send(message: Parameters<typeof encode>[0]): void {
    const ws = this.ws;
    if (!ws) return;
    const text = encode(message);
    this.out.push(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    });
  }

  private receive(data: unknown): void {
    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      this.stats.bytes += bytes.length;
      this.stats.biggest = Math.max(this.stats.biggest, bytes.length);
      let frame: StateFrame;
      try {
        frame = this.decoder.decode(bytes) as StateFrame;
      } catch {
        this.stats.decodeErrors++;
        return;
      }
      this.stats.frames++;
      const now = performance.now();
      if (frame.stage.kind === 'playing' && this.frame?.stage.kind === 'playing') {
        const gap = now - this.lastFrameAt;
        if (gap > 250) this.stats.stalls++;
        this.stats.worstGap = Math.max(this.stats.worstGap, gap);
        if (this.lastTick >= 0 && frame.state.tick > this.lastTick + 1) this.stats.tickJumps++;
      }
      this.lastFrameAt = now;
      this.lastTick = frame.state.tick;
      this.frame = frame;
      if (frame.stage.kind === 'choosing' && !frame.stage.chosen && frame.stage.options[0]) {
        if (Math.random() < 0.05) this.send({ type: 'glyph', glyphId: frame.stage.options[0] });
      }
      if (frame.stage.kind === 'finished' && !frame.stage.rematch.includes(this.playerId)) {
        if (Math.random() < 0.02) this.send({ type: 'rematch' });
      }
      return;
    }
    const message = decodeServerMessage(String(data));
    if (!message) return;
    switch (message.type) {
      case 'welcome':
        this.token = message.token;
        this.playerId = message.playerId;
        return;
      case 'players':
        this.hostId = message.hostId;
        this.settings = message.settings;
        this.playersSeen = message.players.filter((p) => !p.bot && p.connected).length;
        return;
      case 'start':
        this.started = true;
        if (message.resume) this.stats.resumed++;
        this.bot = new BotController(
          (Math.random() * 2 ** 31) >>> 0,
          rulesForRoom(message.settings),
        );
        return;
      case 'pong':
        this.stats.rtt.push(performance.now() - message.sentAt);
        return;
      case 'error':
        this.stats.errors.push(message.reason);
        return;
    }
  }

  private pingAt = 0;
  private step(): void {
    const now = performance.now();
    if (now - this.pingAt > 2000) {
      this.pingAt = now;
      this.send({ type: 'ping', sentAt: now });
    }
    const frame = this.frame;
    if (!frame || this.away || !this.bot || frame.stage.kind !== 'playing') return;
    const me = frame.state.wizards.find((w) => w.id === this.playerId);
    if (!me) {
      this.stats.wrongId++;
      return;
    }
    const intents: Intent[] = [...this.bot.intentsFor(frame.state as MatchState, me)];
    if (intents.length > 0) this.send({ type: 'intents', seq: ++this.seq, intents });
  }

  /** Se corta la señal sin aviso (el socket queda colgado del lado del servidor un rato). */
  async loseSignal(ms: number): Promise<void> {
    this.stats.drops++;
    const ws = this.ws;
    this.ws = null;
    // Sin cerrar: así se ve un celular que entra a un túnel. El servidor debe notarlo solo.
    if (ws) {
      ws.onmessage = null;
      ws.onclose = null;
    }
    await sleep(ms);
    try {
      ws?.close();
    } catch {}
    this.stats.reconnects++;
    this.connect();
  }

  /** Se va a WhatsApp y vuelve. */
  async goAway(ms: number): Promise<void> {
    this.stats.aways++;
    this.away = true;
    this.send({ type: 'away', away: true });
    await sleep(ms);
    this.away = false;
    this.send({ type: 'away', away: false });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.ws?.close();
  }
}

test.skipIf(!BASE)(
  'una sala con amigos aguanta lag, salidas y cortes',
  async () => {
    const created = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
    const { roomCode } = (await created.json()) as { roomCode: string };
    // El anfitrión es el de mala señal, como en el grupo de Tomás.
    const phones = Array.from(
      { length: PLAYERS },
      (_, i) =>
        new Phone(
          `Amigo${i + 1}`,
          roomCode,
          i === 0 ? LAG * 2.5 : LAG,
          i === 0 ? Math.min(0.2, LOSS * 3) : LOSS,
        ),
    );
    const host = phones[0] as Phone;
    host.connect();
    await sleep(1500);
    host.send({ type: 'settings', settings: { ...DEFAULT_ROOM_SETTINGS, mode: MODE, minutes: 2 } });
    const late = LATE ? phones.at(-1) : undefined;
    for (const phone of phones.slice(1)) {
      if (phone === late) continue;
      phone.connect();
      await sleep(400);
    }
    // Uno se va a WhatsApp a mandar el enlace mientras esperan.
    if (CHAOS && phones[2]) void phones[2].loseSignal(4000);
    await sleep(6000);
    const lobbyCounts = phones.map((p) => p.playersSeen);
    // Manda quien manda (puede haber cambiado si el anfitrión se cortó).
    const boss = phones.find((p) => p.playerId === host.hostId) ?? host;
    boss.send({ type: 'begin' });

    if (late) setTimeout(() => late.connect(), 20_000);
    const end = performance.now() + SECONDS * 1000;
    const chaos: Promise<void>[] = [];
    while (performance.now() < end) {
      await sleep(1000);
      if (!CHAOS) continue;
      for (const phone of phones) {
        const r = Math.random();
        if (r < 0.006) chaos.push(phone.loseSignal(2000 + Math.random() * 12000));
        else if (r < 0.014) chaos.push(phone.goAway(3000 + Math.random() * 15000));
      }
    }
    await Promise.all(chaos);
    await sleep(3000);

    const report = phones.map((p) => {
      const rtt = [...p.stats.rtt].sort((a, b) => a - b);
      const median = rtt[Math.floor(rtt.length / 2)] ?? 0;
      const kbps = p.stats.bytes / 1024 / (SECONDS + 8);
      return {
        name: p.name,
        id: p.playerId,
        lobby: lobbyCounts[phones.indexOf(p)],
        frames: p.stats.frames,
        kbps: Math.round(kbps * 10) / 10,
        biggest: p.stats.biggest,
        stalls: p.stats.stalls,
        worstGap: Math.round(p.stats.worstGap),
        jumps: p.stats.tickJumps,
        decodeErr: p.stats.decodeErrors,
        rtt: Math.round(median),
        drops: p.stats.drops,
        resumed: p.stats.resumed,
        aways: p.stats.aways,
        wrongId: p.stats.wrongId,
        stage: p.frame?.stage.kind,
        started: p.started,
        errors: [...new Set(p.stats.errors)].join(' | '),
        closes: [...new Set(p.stats.closes)].join(' | '),
      };
    });
    console.table(report);
    if (process.env.REPORTE) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(process.env.REPORTE, JSON.stringify(report, null, 1));
    }
    for (const p of phones) p.stop();
    expect(report.every((r) => r.decodeErr === 0)).toBe(true);
    expect(report.every((r) => r.errors === '')).toBe(true);
  },
  600_000,
);
