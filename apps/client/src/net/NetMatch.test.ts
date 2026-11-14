import { DEFAULT_LOOK, rulesForMode } from '@crisol/content';
import { createMatch, type Intent, modeSetup } from '@crisol/core';
import {
  DEFAULT_ROOM_SETTINGS,
  encode,
  type ServerMessage,
  StateEncoder,
  type StateFrame,
} from '@crisol/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type NetListener, NetMatch } from './NetMatch';

/** Un WebSocket de mentira: guarda lo enviado y deja simular lo que llega. */
class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  closedWith: number | null = null;
  binaryType = 'blob';
  /** Como la Sala: lo que cambió desde el último estado, en binario. */
  private readonly encoder = new StateEncoder();
  private readonly handlers = new Map<string, ((event: unknown) => void)[]>();
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  addEventListener(type: string, handler: (event: unknown) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  send(text: string): void {
    this.sent.push(text);
  }
  close(code = 1000): void {
    this.closedWith = code;
  }
  emit(type: string, event: unknown = {}): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
  receive(message: ServerMessage | StateFrame): void {
    if ('type' in message) {
      this.emit('message', { data: encode(message) });
      return;
    }
    const bytes = this.encoder.encode(message);
    this.emit('message', { data: bytes.buffer });
  }
  /** Bytes que no calzan con nada: un estado roto. */
  receiveGarbage(): void {
    this.emit('message', { data: new Uint8Array([2, 99, 99]).buffer });
  }
}

const RULES = rulesForMode({ kind: 'duel' });
const listener = (): NetListener => ({
  players: () => {},
  start: () => {},
  problem: () => {},
  notice: () => {},
  stats: () => {},
});

/** Lo mínimo del navegador que usa la red: visibilidad, eventos de señal y almacenamiento. */
class FakeDocument extends EventTarget {
  hidden = false;
}
const storage = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
};
let doc = new FakeDocument();
const human = { intentsFor: (): readonly Intent[] => [{ kind: 'move', x: 1, z: 0 }] };

function stateMessage(tick: number, ack = 0, hidden: number[] = []): StateFrame {
  const state = createMatch(modeSetup({ kind: 'duel' }, 1, 'out', RULES), RULES);
  state.tick = tick;
  return {
    hidden,
    ack,
    state,
    stage: { kind: 'playing' },
    wins: [0, 0],
    roundsPlayed: 0,
    seriesWinner: null,
    glyphs: {},
  };
}

describe('duelo en red: el celular', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeSocket);
    doc = new FakeDocument();
    storage.clear();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', fakeStorage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function joined(): { net: NetMatch; socket: FakeSocket } {
    const look = DEFAULT_LOOK;
    const net = new NetMatch('K7QF', { name: 'Tomás', look, affinity: null }, human, listener());
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't' });
    socket.receive({ type: 'start', omenId: 'x', players: [], settings: DEFAULT_ROOM_SETTINGS });
    socket.receive(stateMessage(0));
    return { net, socket };
  }

  it('se presenta, muestra el primer estado en el acto y manda lo que tocas', () => {
    const { net, socket } = joined();
    expect(JSON.parse(socket.sent[0] ?? '{}').type).toBe('hello');
    expect(net.playerId).toBe(2);
    expect(net.state.wizards).toHaveLength(2);
    net.step();
    expect(socket.sent.some((m) => JSON.parse(m).type === 'intents')).toBe(true);
  });

  it('si vuelve y la Sala amaneció en la sala de espera, avisa que la partida se perdió', () => {
    const problems: [string, boolean][] = [];
    const net = new NetMatch('K7QF', { name: 'Tomás', look: DEFAULT_LOOK, affinity: null }, human, {
      ...listener(),
      problem: (reason, fatal) => problems.push([reason, fatal]),
    });
    let socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't', lobby: true });
    // Antes de jugar, la sala de espera es lo normal.
    expect(problems).toHaveLength(0);
    socket.receive({ type: 'start', omenId: 'x', players: [], settings: DEFAULT_ROOM_SETTINGS });
    socket.receive(stateMessage(0));
    // Se corta y vuelve: la Sala se reinició.
    vi.useFakeTimers();
    socket.emit('close', { code: 1006 });
    vi.advanceTimersByTime(2000);
    socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 1, token: 'u', lobby: true });
    vi.useRealTimers();
    expect(problems.at(-1)?.[1]).toBe(true);
    expect(net.playerId).toBe(2);
  });

  it('guarda un colchón de dos pasos antes de mostrar y los muestra de a uno', () => {
    const { net, socket } = joined();
    socket.receive(stateMessage(1));
    net.step();
    expect(net.state.tick).toBe(0);
    socket.receive(stateMessage(2));
    net.step();
    expect(net.state.tick).toBe(1);
    net.step();
    expect(net.state.tick).toBe(2);
  });

  it('si el colchón se vacía, espera y lo agranda para la próxima', () => {
    const { net, socket } = joined();
    for (const tick of [1, 2]) socket.receive(stateMessage(tick));
    net.step();
    net.step();
    net.step(); // vacío: corte
    for (const tick of [3, 4]) socket.receive(stateMessage(tick));
    net.step();
    // Ahora el colchón busca 3: con 2 todavía espera.
    expect(net.state.tick).toBe(2);
    socket.receive(stateMessage(5));
    net.step();
    expect(net.state.tick).toBe(3);
  });

  it('si llegan muchos de golpe, muestra dos por paso hasta alcanzar', () => {
    const { net, socket } = joined();
    for (let tick = 1; tick <= 8; tick++) socket.receive(stateMessage(tick));
    net.step();
    expect(net.state.tick).toBe(2);
    net.step();
    expect(net.state.tick).toBe(4);
  });

  it('predice tu mago: camina en el acto, antes de que conteste el servidor', () => {
    const { net } = joined();
    const server = net.state.wizards.find((w) => w.id === 2)?.pos ?? { x: 0, z: 0 };
    for (let i = 0; i < 5; i++) net.step();
    const shown = net.interpolated(2, server, 1);
    expect(shown.x).toBeGreaterThan(server.x + 0.5);
    // El rival sigue donde dice el servidor.
    const rival = net.state.wizards.find((w) => w.id === 1)?.pos ?? { x: 0, z: 0 };
    expect(net.interpolated(1, rival, 1)).toEqual(rival);
  });

  it('cuando el servidor confirma, deja de repetir lo ya jugado', () => {
    const { net, socket } = joined();
    for (let i = 0; i < 5; i++) net.step();
    const server = net.state.wizards.find((w) => w.id === 2)?.pos ?? { x: 0, z: 0 };
    const ahead = net.interpolated(2, server, 1).x - server.x;
    // Llega un estado que ya jugó los 5 toques, con el mago en el mismo lugar.
    socket.receive(stateMessage(1, 5));
    net.step();
    const now = net.interpolated(2, server, 1).x - server.x;
    expect(now).toBeLessThan(ahead);
    expect(now).toBeGreaterThan(0);
  });

  it('muestra tu tejido en el acto', () => {
    const tapping = { intentsFor: (): readonly Intent[] => [{ kind: 'weave', element: 'brasa' }] };
    const look = DEFAULT_LOOK;
    const net = new NetMatch('K7QF', { name: 'T', look, affinity: null }, tapping, listener());
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't' });
    socket.receive({ type: 'start', omenId: 'x', players: [], settings: DEFAULT_ROOM_SETTINGS });
    socket.receive(stateMessage(0));
    net.step();
    net.step();
    const me = net.state.wizards.find((w) => w.id === 2);
    if (!me) throw new Error('sin mago');
    expect(me.weave).toEqual([]);
    expect(net.present(me).weave).toEqual(['brasa', 'brasa']);
  });

  it('los estados llegan en binario y con lo que cambió; el primero, completo', () => {
    const { net, socket } = joined();
    for (const tick of [1, 2, 3]) socket.receive(stateMessage(tick));
    net.step();
    net.step();
    expect(net.state.tick).toBe(2);
    expect(net.state.wizards).toHaveLength(2);
    expect(socket.binaryType).toBe('arraybuffer');
  });

  it('no dibuja a los rivales que la Sala dice que no ves', () => {
    const { net, socket } = joined();
    expect(net.isHidden(1)).toBe(false);
    for (const tick of [1, 2]) socket.receive(stateMessage(tick, 0, [1]));
    net.step();
    expect(net.isHidden(1)).toBe(true);
  });

  it('si un estado llega roto, cierra para reconectar y recibir uno completo', () => {
    const { socket } = joined();
    socket.receiveGarbage();
    expect(socket.closedWith).toBe(4003);
  });

  it('al salir de la app avisa a la Sala y al volver sigue desde el estado nuevo', () => {
    const { net, socket } = joined();
    for (const tick of [1, 2, 3]) socket.receive(stateMessage(tick));
    net.step();
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ type: 'away', away: true });
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ type: 'away', away: false });
    // Lo viejo se descarta: el próximo estado se muestra en el acto, sin esperar el colchón.
    socket.receive(stateMessage(40));
    expect(net.state.tick).toBe(40);
  });

  it('al volver tras un corte sigue la misma partida sin rearmarla', () => {
    let starts = 0;
    const counting = { ...listener(), start: () => starts++ };
    const net = new NetMatch(
      'K7QF',
      { name: 'T', look: DEFAULT_LOOK, affinity: null },
      human,
      counting,
    );
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't' });
    socket.receive({ type: 'start', omenId: 'x', players: [], settings: DEFAULT_ROOM_SETTINGS });
    socket.receive(stateMessage(0));
    expect(starts).toBe(1);
    socket.receive({
      type: 'start',
      omenId: 'x',
      players: [],
      settings: DEFAULT_ROOM_SETTINGS,
      resume: true,
    });
    socket.receive(stateMessage(90));
    expect(starts).toBe(1);
    expect(net.state.tick).toBe(90);
  });

  it('si un intento de conexión queda colgado sin señal, lo abandona y vuelve a intentar', () => {
    vi.useFakeTimers();
    const { socket } = joined();
    socket.emit('close', { code: 1006 });
    vi.advanceTimersByTime(2000);
    // El intento nuevo no contesta (túnel): ni abre ni se cierra.
    const hung = FakeSocket.last as FakeSocket;
    hung.readyState = 0;
    vi.advanceTimersByTime(8000);
    expect(hung.closedWith).toBe(4005);
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.last).not.toBe(hung);
    vi.useRealTimers();
  });

  it('si vuelve la señal con un intento colgado, intenta de nuevo en el acto', () => {
    vi.useFakeTimers();
    const { socket } = joined();
    socket.emit('close', { code: 1006 });
    vi.advanceTimersByTime(2000);
    const hung = FakeSocket.last as FakeSocket;
    hung.readyState = 0;
    window.dispatchEvent(new Event('online'));
    expect(FakeSocket.last).not.toBe(hung);
    vi.useRealTimers();
  });

  it('guarda el pase para volver aunque se cierre la pestaña', () => {
    joined();
    const saved = JSON.parse(storage.get('crisol.sala.K7QF') ?? '{}');
    expect(saved.token).toBe('t');
    new NetMatch('K7QF', { name: 'T', look: DEFAULT_LOOK, affinity: null }, human, listener());
    const again = FakeSocket.last as FakeSocket;
    again.emit('open');
    expect(JSON.parse(again.sent[0] ?? '{}').token).toBe('t');
  });

  it('toma los ajustes de la sala: modo, tiempo por ronda y rondas', () => {
    const net = new NetMatch(
      'K7QF',
      { name: 'T', look: DEFAULT_LOOK, affinity: null },
      human,
      listener(),
    );
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    const settings = {
      ...DEFAULT_ROOM_SETTINGS,
      mode: { kind: 'ffa', players: 4 } as const,
      minutes: 5,
      bestOf: 5,
    };
    socket.receive({ type: 'players', players: [], settings, hostId: 1 });
    expect(net.options.mode).toEqual({ kind: 'ffa', players: 4 });
    expect(net.rules.round.durationTicks).toBe(5 * 60 * 30);
    expect(net.rules.round.roundsToWin).toBe(3);
    net.configure({ ...settings, omen: false });
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'settings' });
  });
});
