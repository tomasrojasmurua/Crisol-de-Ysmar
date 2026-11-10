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

function stateMessage(tick: number): ServerMessage {
  const state = createMatch(modeSetup({ kind: 'duel' }, 1, 'out', RULES), RULES);
  state.tick = tick;
  return {
    type: 'state',
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
});
