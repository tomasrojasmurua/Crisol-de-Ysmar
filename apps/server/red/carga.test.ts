/**
 * Prueba de carga del servidor de salas: abre salas de a una, cada cierto rato, con celulares
 * livianos que se mueven y lanzan hechizos al azar, hasta que la máquina se atrasa. En cada
 * escalón anota lo que dice `/health` (CPU, atraso del reloj, memoria) y lo que ven los
 * celulares (ping y cuadros atrasados). No corre en CI: ver docs/carga.md.
 *
 *   SALA=http://127.0.0.1:8080 pnpm exec vitest run --config apps/server/red/vitest.config.ts carga
 *
 * Variables: SALAS (máximo, 40), JUGADORES por sala (4), MODO (rapida | libre4 | libre6 |
 * equipos3 | duelo), RITMO (segundos entre salas, 6), HASTA_FALLAR (1 = se detiene al atrasarse),
 * PING_EXTRA (ms sobre el ping de la primera sala que ya cuentan como atraso, 80).
 *
 * La Partida rápida se corta cuando el servidor dice que está lleno (`MAX_SALAS`); las salas
 * privadas (libre4…) no tienen ese tope y sirven para ver hasta dónde llega la máquina.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { ElementId, GameMode, Intent } from '@crisol/core';
import { DEFAULT_ROOM_SETTINGS, encode, PROTOCOL_VERSION } from '@crisol/protocol';
import { expect, test } from 'vitest';

const BASE = process.env.SALA ?? '';
const MAX_ROOMS = Number(process.env.SALAS ?? 40);
const PER_ROOM = Number(process.env.JUGADORES ?? 4);
const STEP_SECONDS = Number(process.env.RITMO ?? 6);
const STOP_ON_FAIL = process.env.HASTA_FALLAR !== '0';
const MODE_NAME = process.env.MODO ?? 'rapida';
/** Cuánto puede subir el ping sobre el de la primera sala antes de darlo por atrasado (ms). */
const PING_EXTRA = Number(process.env.PING_EXTRA ?? 80);
const MODES: Record<string, GameMode> = {
  duelo: { kind: 'duel' },
  equipos3: { kind: 'teams', size: 3 },
  libre4: { kind: 'ffa', players: 4 },
  libre6: { kind: 'ffa', players: 6 },
};
const ELEMENTS: readonly ElementId[] = ['brasa', 'tormenta', 'marea', 'raiz', 'umbra'];
/** Un cuadro que llega más tarde que esto jugando se nota en el celular (ms). */
const LATE_FRAME_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Un celular liviano: no dibuja ni decodifica el estado, solo mide cuándo llegan los cuadros y
 * el ping, y manda lo que mandaría un dedo (moverse y tejer). Así cientos caben en un proceso.
 */
class LightPhone {
  ws: WebSocket | null = null;
  rtt: number[] = [];
  frames = 0;
  late = 0;
  bytes = 0;
  errors: string[] = [];
  private lastFrame = 0;
  /** Cuadros seguidos con poco intervalo: así se sabe que se está jugando (30 por segundo). */
  private fast = 0;
  private seq = 0;
  private dir = { x: 0, z: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;

  constructor(
    readonly name: string,
    readonly code: string,
    readonly quick: boolean,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/rooms/${this.code}/socket`);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => {
        ws.send(
          encode({
            type: 'hello',
            protocol: PROTOCOL_VERSION,
            playerName: this.name,
            ...(this.quick ? { quick: true } : {}),
          }),
        );
        resolve();
      };
      ws.onerror = () => resolve();
      ws.onmessage = (event) => this.receive(event.data);
      ws.onclose = (event) => {
        if (event.code !== 1000) this.errors.push(`cierre ${event.code}`);
      };
      this.timer = setInterval(() => this.step(), 1000 / 15);
    });
  }

  send(message: Parameters<typeof encode>[0]): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(message));
  }

  private receive(data: unknown): void {
    const now = performance.now();
    if (data instanceof ArrayBuffer) {
      this.frames++;
      this.bytes += data.byteLength;
      const gap = now - this.lastFrame;
      if (gap < 60) this.fast++;
      else {
        if (this.fast >= 10 && gap > LATE_FRAME_MS) this.late++;
        if (gap > 250) this.fast = 0;
      }
      this.lastFrame = now;
      return;
    }
    const text = String(data);
    if (text.includes('"pong"')) {
      const sentAt = Number(/"sentAt":([0-9.]+)/.exec(text)?.[1] ?? now);
      this.rtt.push(now - sentAt);
    } else if (text.includes('"error"')) this.errors.push(text.slice(0, 80));
  }

  private step(): void {
    this.tick++;
    if (this.tick % 30 === 0) this.send({ type: 'ping', sentAt: performance.now() });
    // Al terminar la serie se pide la revancha, para que la sala siga jugando toda la prueba (la
    // Sala no la toma si no ha terminado).
    if (this.tick % 75 === 0) this.send({ type: 'rematch' });
    if (this.tick % 20 === 0) {
      const angle = Math.random() * Math.PI * 2;
      this.dir = { x: Math.cos(angle), z: Math.sin(angle) };
    }
    const intents: Intent[] = [{ kind: 'move', ...this.dir }];
    if (Math.random() < 0.08) {
      const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] ?? 'brasa';
      intents.push({ kind: 'weave', element });
    }
    if (Math.random() < 0.04) intents.push({ kind: 'cast', dirX: 0, dirZ: 0 });
    this.send({ type: 'intents', seq: ++this.seq, intents });
  }

  /** Lo medido desde la última vez, y se reinicia. */
  take(): { rtt: number[]; frames: number; late: number; bytes: number } {
    const out = { rtt: this.rtt, frames: this.frames, late: this.late, bytes: this.bytes };
    this.rtt = [];
    this.frames = 0;
    this.late = 0;
    this.bytes = 0;
    return out;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.ws?.close(1000);
  }
}

interface Health {
  rooms: number;
  active: number;
  players: number;
  cpu: number;
  lagP99: number;
  lagMax: number;
  memoryMb: number;
  full: boolean;
}

async function health(): Promise<Health | null> {
  try {
    const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return (await response.json()) as Health;
  } catch {
    return null;
  }
}

/** Una sala nueva con sus celulares. */
async function openRoom(index: number): Promise<LightPhone[]> {
  const phones: LightPhone[] = [];
  if (MODE_NAME === 'rapida') {
    // Partida rápida: cada uno pide sala, como en el juego; el servidor los junta de a 4.
    for (let i = 0; i < PER_ROOM; i++) {
      const response = await fetch(`${BASE}/api/quick`, { method: 'POST' });
      const { roomCode } = (await response.json()) as { roomCode?: string };
      if (!roomCode) throw new Error('El servidor está lleno (no da Partida rápida)');
      const phone = new LightPhone(`C${index}-${i}`, roomCode, true);
      await phone.connect();
      phones.push(phone);
    }
    return phones;
  }
  const created = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
  const { roomCode } = (await created.json()) as { roomCode: string };
  for (let i = 0; i < PER_ROOM; i++) {
    const phone = new LightPhone(`C${index}-${i}`, roomCode, false);
    await phone.connect();
    phones.push(phone);
  }
  await sleep(500);
  const host = phones[0];
  const mode = MODES[MODE_NAME] ?? { kind: 'ffa', players: 4 };
  host?.send({ type: 'settings', settings: { ...DEFAULT_ROOM_SETTINGS, mode, minutes: 5 } });
  await sleep(300);
  host?.send({ type: 'begin' });
  return phones;
}

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor((sorted.length - 1) * p)] ?? 0);
};

test.skipIf(!BASE)(
  'cuántas salas aguanta el servidor',
  async () => {
    // Si el que mide se atrasa, la medición no vale: se anota también.
    const ownDelay = monitorEventLoopDelay({ resolution: 10 });
    ownDelay.enable();
    const rooms: LightPhone[][] = [];
    const rows: Record<string, number | string>[] = [];
    let failures = 0;
    let healthy = 0;
    let basePing = -1;
    let stopped = '';
    while (rooms.length < MAX_ROOMS) {
      try {
        rooms.push(await openRoom(rooms.length));
      } catch (error) {
        stopped = error instanceof Error ? error.message : String(error);
        break;
      }
      // Las salas rápidas empiezan solas a los 10 s: la primera medición espera a que jueguen.
      await sleep(STEP_SECONDS * 1000);
      const phones = rooms.flat();
      const taken = phones.map((p) => p.take());
      const rtt = taken.flatMap((t) => t.rtt);
      const frames = taken.reduce((sum, t) => sum + t.frames, 0);
      const late = taken.reduce((sum, t) => sum + t.late, 0);
      const bytes = taken.reduce((sum, t) => sum + t.bytes, 0);
      const server = await health();
      const row = {
        salas: rooms.length,
        celulares: phones.length,
        cpu: server?.cpu ?? -1,
        atrasoP99: server?.lagP99 ?? -1,
        atrasoMax: server?.lagMax ?? -1,
        memoriaMb: server?.memoryMb ?? -1,
        llena: server?.full ? 'sí' : 'no',
        pingP50: percentile(rtt, 0.5),
        pingP95: percentile(rtt, 0.95),
        tarde: frames > 0 ? `${((late / frames) * 100).toFixed(2)}%` : '-',
        kbps: Math.round(bytes / 1024 / STEP_SECONDS / Math.max(1, phones.length)),
        medidorMs: Math.round(ownDelay.percentile(99) / 1e6),
      };
      ownDelay.reset();
      rows.push(row);
      process.stderr.write(`${JSON.stringify(row)}\n`);
      // Se atrasa: ping alto, cuadros tarde o el reloj del servidor corrido.
      if (basePing < 0) basePing = row.pingP50;
      const bad =
        !server ||
        row.pingP95 > basePing + PING_EXTRA ||
        late / Math.max(1, frames) > 0.02 ||
        row.atrasoP99 > 40;
      if (bad) failures++;
      else {
        failures = 0;
        healthy = rooms.length;
      }
      if (STOP_ON_FAIL && failures >= 2) break;
    }
    console.table(rows);
    if (stopped) process.stderr.write(`\nSe dejó de abrir salas: ${stopped}\n`);
    process.stderr.write(
      `\nAguantó bien hasta ${healthy} salas (${healthy * PER_ROOM} celulares, modo ${MODE_NAME}).\n`,
    );
    if (process.env.REPORTE) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(process.env.REPORTE, JSON.stringify({ healthy, stopped, rows }, null, 1));
    }
    for (const phone of rooms.flat()) phone.stop();
    expect(rows.length).toBeGreaterThan(0);
  },
  3_600_000,
);
