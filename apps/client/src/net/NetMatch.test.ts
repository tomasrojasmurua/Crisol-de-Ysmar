import { rulesForMode } from '@crisol/content';
import { createMatch, type Intent, modeSetup } from '@crisol/core';
import { encode, type ServerMessage } from '@crisol/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type NetListener, NetMatch } from './NetMatch';

/** Un WebSocket de mentira: guarda lo enviado y deja simular lo que llega. */
class FakeSocket {
  static last: FakeSocket | null = null;
  static readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
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
  close(): void {}
  emit(type: string, event: unknown = {}): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
  receive(message: ServerMessage): void {
    this.emit('message', { data: encode(message) });
  }
}

const RULES = rulesForMode({ kind: 'duel' });
const listener = (): NetListener => ({
  players: () => {},
  start: () => {},
  problem: () => {},
  stats: () => {},
});
const human = { intentsFor: (): readonly Intent[] => [{ kind: 'move', x: 1, z: 0 }] };

function stateMessage(tick: number, ack = 0): ServerMessage {
  const state = createMatch(modeSetup({ kind: 'duel' }, 1, 'out', RULES), RULES);
  state.tick = tick;
  return {
    type: 'state',
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
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function joined(): { net: NetMatch; socket: FakeSocket } {
    const look = {
      robe: 'ceniza',
      trim: 'oro',
      skin: 'arena',
      headwear: 'capucha',
      focus: 'baculo',
    };
    const net = new NetMatch('K7QF', { name: 'Tomás', look, affinity: null }, human, listener());
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't' });
    socket.receive({ type: 'start', omenId: 'x', players: [] });
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
    const look = {
      robe: 'ceniza',
      trim: 'oro',
      skin: 'arena',
      headwear: 'capucha',
      focus: 'baculo',
    };
    const net = new NetMatch('K7QF', { name: 'T', look, affinity: null }, tapping, listener());
    const socket = FakeSocket.last as FakeSocket;
    socket.emit('open');
    socket.receive({ type: 'welcome', roomCode: 'K7QF', playerId: 2, token: 't' });
    socket.receive({ type: 'start', omenId: 'x', players: [] });
    socket.receive(stateMessage(0));
    net.step();
    net.step();
    const me = net.state.wizards.find((w) => w.id === 2);
    if (!me) throw new Error('sin mago');
    expect(me.weave).toEqual([]);
    expect(net.present(me).weave).toEqual(['brasa', 'brasa']);
  });
});
