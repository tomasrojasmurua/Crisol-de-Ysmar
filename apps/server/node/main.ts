/**
 * El servidor de salas de Santiago: las mismas Salas que en Cloudflare (`RoomHost`), en un
 * servidor Node con centro de datos en Chile. Cloudflare no crea sus Salas en Sudamérica y las
 * manda al este de Norteamérica (150 a 250 ms de ida y vuelta desde Chile); aquí son ~10–40 ms.
 * Ver docs/servidor-santiago.md.
 *
 * Rutas: `GET /health`, `POST /api/quick` (Partida rápida) y el socket `/api/rooms/K7QF/socket`,
 * iguales que el Worker. Los errores se mandan al registro de Cloudflare (D1) por
 * `POST /api/errors`.
 */
import { randomFillSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { isValidRoomCode, PROTOCOL_VERSION, REPORT_LIMITS } from '@crisol/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import { generateRoomCode } from '../src/roomCode';
import { type Peer, RoomHost } from '../src/roomHost';

const PORT = Number(process.env.PORT ?? 8080);
/** Dónde se anotan los errores (el Worker de Cloudflare guarda en D1). */
const ERRORS_URL =
  process.env.ERRORS_URL ?? 'https://crisol-server.tomasrojasmurua.workers.dev/api/errors';
/** Una sala sin nadie se borra después de esto (igual se puede volver con el código antes). */
const EMPTY_ROOM_MS = 10 * 60_000;
/** Cada cuánto se mandan pings del protocolo WebSocket para notar sockets muertos. */
const HEARTBEAT_MS = 20_000;
const ROOM_SOCKET_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/socket$/;
/**
 * Cuántas salas jugando a la vez aguanta la máquina antes de mandar las salas nuevas a
 * Cloudflare. Depende de la máquina (lo fija instalar.sh): ver la tabla de docs/carga.md.
 */
const MAX_ACTIVE_ROOMS = Number(process.env.MAX_SALAS ?? 2);
/** Si el reloj de las Salas se atrasa más que esto (ms, p99) jugando, la máquina está llena. */
const LAG_FULL_MS = Number(process.env.ATRASO_LLENA ?? 30);

/** Un socket de `ws` visto como conexión de la Sala. */
class WsPeer implements Peer {
  playerId: number | undefined = undefined;
  alive = true;
  constructor(readonly socket: WebSocket) {}

  send(data: string | Uint8Array): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(data);
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }
}

interface Room {
  readonly host: RoomHost;
  readonly peers: Set<WsPeer>;
  emptySince: number;
}

const rooms = new Map<string, Room>();

/**
 * Cómo anda la máquina, medido cada 5 segundos: CPU del proceso, atraso del reloj (lo que tarda
 * en correr un paso que tocaba, en ms) y memoria. Va en `/health` para la vigilancia y la
 * prueba de carga, y decide si la máquina está llena.
 */
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();
let load = { cpu: 0, lagP99: 0, lagMax: 0, memoryMb: 0 };
let lastCpu = process.cpuUsage();
let lastCpuAt = performance.now();
/**
 * Lo peor de los últimos 10 minutos (una muestra cada 5 s). El informe de la Sala sale al final de
 * la serie: si solo dijera cómo va la máquina en ese momento, un atraso de un minuto a mitad de
 * partida no dejaría rastro (pasó el 18 de noviembre: 70 s de atraso y "CPU 4%" al final).
 */
const RECENT_SAMPLES = 120;
const recent: { lagMax: number; steal: number; cpu: number }[] = [];
let lastProcStat = readProcStat();
setInterval(() => {
  const now = performance.now();
  const cpu = process.cpuUsage(lastCpu);
  load = {
    cpu: Math.round(((cpu.user + cpu.system) / 1000 / (now - lastCpuAt)) * 100),
    lagP99: Math.round(loopDelay.percentile(99) / 1e5) / 10,
    lagMax: Math.round(loopDelay.max / 1e5) / 10,
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
  };
  const procStat = readProcStat();
  recent.push({ lagMax: load.lagMax, steal: stealPercent(lastProcStat, procStat), cpu: load.cpu });
  if (recent.length > RECENT_SAMPLES) recent.shift();
  lastProcStat = procStat;
  lastCpu = process.cpuUsage();
  lastCpuAt = now;
  loopDelay.reset();
}, 5000).unref();

/**
 * Los contadores de CPU de la máquina entera (Linux). El octavo es la CPU "robada": el tiempo que
 * Google le dio a otra máquina del mismo equipo. Las e2-micro son compartidas: si se acaba su
 * ráfaga, el reloj de las Salas se atrasa aunque nuestro proceso casi no use CPU.
 */
function readProcStat(): number[] | null {
  try {
    const line = readFileSync('/proc/stat', 'utf8').split('\n')[0] ?? '';
    if (!line.startsWith('cpu ')) return null;
    return line.trim().split(/\s+/).slice(1).map(Number);
  } catch {
    return null;
  }
}

/** Qué parte del tiempo de CPU fue robada entre dos lecturas, en %. */
function stealPercent(before: number[] | null, after: number[] | null): number {
  if (!before || !after) return 0;
  const total = after.reduce((sum, value, i) => sum + value - (before[i] ?? 0), 0);
  const steal = (after[7] ?? 0) - (before[7] ?? 0);
  return total > 0 ? Math.round((steal / total) * 100) : 0;
}

/** Lo peor de los últimos 10 minutos, para el informe de la Sala. */
function recentWorst(): string {
  if (recent.length === 0) return '';
  const lag = Math.max(...recent.map((sample) => sample.lagMax));
  const steal = Math.max(...recent.map((sample) => sample.steal));
  const cpu = Math.max(...recent.map((sample) => sample.cpu));
  return ` · peor en 10 min: CPU ${cpu}% · atraso máx ${lag} ms · CPU robada ${steal}%`;
}

/** Salas con el reloj corriendo (alguien conectado). */
function activeRooms(): number {
  let active = 0;
  for (const room of rooms.values()) if (room.host.running) active++;
  return active;
}

/** Si ya no caben salas nuevas: las manda a Cloudflare (las que juegan siguen aquí). */
function isFull(): boolean {
  const active = activeRooms();
  return active >= MAX_ACTIVE_ROOMS || (active > 0 && load.lagP99 > LAG_FULL_MS);
}

function roomFor(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    const peers = new Set<WsPeer>();
    room = {
      peers,
      emptySince: 0,
      host: new RoomHost({
        code,
        peers: () => [...peers],
        report: (where, error) => reportError(code, where, error),
        perf: (summary) => sendReport({ kind: 'servidor', room: code, ...summary }),
        machine: () =>
          `Santiago · CPU ${load.cpu}% · atraso p99 ${load.lagP99} ms · máx ${load.lagMax} ms · ${activeRooms()} salas jugando · ${load.memoryMb} MB${recentWorst()}`,
      }),
    };
    rooms.set(code, room);
  }
  return room;
}

/** Igual que la Sala de Cloudflare: el error va al registro con la sala y dónde pasó. */
function reportError(room: string, where: string, error: unknown): void {
  console.error(`Error en la Sala ${room} (${where})`, error);
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const detail = error instanceof Error ? (error.stack ?? '') : '';
  sendReport({ kind: 'sala', room, message: `${where}: ${message}`, detail });
}

/** Manda un informe de la Sala al registro de Cloudflare (sin esperar respuesta). */
function sendReport(entry: { kind: string; room: string; message: string; detail: string }): void {
  const report = {
    kind: entry.kind,
    message: entry.message.slice(0, REPORT_LIMITS.message),
    detail: entry.detail.slice(0, REPORT_LIMITS.detail),
    version: `protocolo ${PROTOCOL_VERSION}`,
    device: 'servidor Santiago',
    screen: '',
    room: entry.room,
    match: '',
    session: '',
    uptime: Math.round(process.uptime()),
  };
  fetch(ERRORS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([report]),
  }).catch(() => {});
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://sala').pathname;
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS).end();
    return;
  }
  if (path === '/health') {
    response.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    // `players`: conexiones abiertas. El actualizador solo reinicia el servidor si es 0.
    let players = 0;
    for (const room of rooms.values()) players += room.peers.size;
    response.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        active: activeRooms(),
        players,
        protocol: PROTOCOL_VERSION,
        full: isFull(),
        ...load,
        uptime: Math.round(process.uptime()),
      }),
    );
    return;
  }
  if (path === '/api/quick' && request.method === 'POST') {
    const roomCode = quickRoom();
    // Llena: el celular pide su Partida rápida a Cloudflare.
    response.writeHead(roomCode ? 200 : 503, { ...CORS, 'Content-Type': 'application/json' });
    response.end(JSON.stringify(roomCode ? { roomCode } : { full: true }));
    return;
  }
  if (path === '/api/rooms' && request.method === 'POST') {
    const roomCode = generateRoomCode((array) => randomFillSync(array));
    response.writeHead(201, { ...CORS, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ roomCode }));
    return;
  }
  response.writeHead(404, CORS).end('No encontrado');
});

/**
 * Partida rápida: la sala pública a la que va quien la pide. Primero una que esté esperando
 * gente; si no, una que vaya en la primera ronda con un mago de la IA que tomar; si no, una nueva
 * (que se marca pública antes de que llegue nadie, para que dos que piden a la vez caigan juntos).
 * `null` si hace falta una nueva y la máquina está llena.
 */
function quickRoom(): string | null {
  let late: string | null = null;
  for (const [code, room] of rooms) {
    const opening = room.host.quickOpening;
    if (opening === 'lobby') return code;
    if (opening === 'late') late ??= code;
  }
  if (late) return late;
  if (isFull()) return null;
  let code = generateRoomCode((array) => randomFillSync(array));
  while (rooms.has(code)) code = generateRoomCode((array) => randomFillSync(array));
  const room = roomFor(code);
  room.host.makeQuick();
  // Si nadie llega a conectarse, se borra como cualquier sala vacía.
  room.emptySince = Date.now();
  return code;
}

const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on('upgrade', (request: IncomingMessage, socket, head) => {
  const path = new URL(request.url ?? '/', 'http://sala').pathname;
  const code = ROOM_SOCKET_PATH.exec(path)?.[1];
  if (!code || !isValidRoomCode(code)) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => connect(code, ws));
});

function connect(code: string, ws: WebSocket): void {
  // Los estados salen apenas se arman: sin esperar a juntar más (algoritmo de Nagle).
  (ws as unknown as { _socket?: { setNoDelay?: (on: boolean) => void } })._socket?.setNoDelay?.(
    true,
  );
  const room = roomFor(code);
  const peer = new WsPeer(ws);
  room.peers.add(peer);
  room.emptySince = 0;
  ws.on('pong', () => {
    peer.alive = true;
  });
  ws.on('message', (data, isBinary) => {
    peer.alive = true;
    const raw = isBinary ? new Uint8Array(data as Buffer) : data.toString();
    room.host.message(peer, raw);
  });
  ws.on('close', () => {
    room.peers.delete(peer);
    if (room.peers.size === 0) room.emptySince = Date.now();
    room.host.closed(peer);
  });
  ws.on('error', () => ws.terminate());
}

// Sockets muertos sin aviso (el celular perdió la señal): se cierran para que la IA tome su mago.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    for (const peer of room.peers) {
      if (!peer.alive) {
        peer.socket.terminate();
        continue;
      }
      peer.alive = false;
      peer.socket.ping();
    }
    if (room.peers.size === 0 && room.emptySince > 0 && now - room.emptySince > EMPTY_ROOM_MS) {
      room.host.stop();
      rooms.delete(code);
    }
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`Salas de Santiago escuchando en el puerto ${PORT} (protocolo ${PROTOCOL_VERSION})`);
});

// Al apagar (publicación nueva), se avisa a los celulares con un cierre normal: reconectan solos.
process.on('SIGTERM', () => {
  for (const room of rooms.values()) {
    room.host.stop();
    for (const peer of room.peers) peer.socket.close(1012, 'Servidor reiniciando');
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
