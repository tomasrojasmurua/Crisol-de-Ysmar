import {
  DatagramStateDecoder,
  decodeServerMessage,
  encode,
  encodeDatagramAck,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@crisol/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FastLink, type Peer, RoomHost } from './roomHost';

/** Una conexión de mentira: guarda lo que la Sala le manda. */
class FakePeer implements Peer {
  playerId: number | undefined = undefined;
  fast: FastLink | undefined = undefined;
  readonly got: (string | Uint8Array)[] = [];
  /** Cuándo llegó cada estado (los binarios). */
  readonly statesAt: number[] = [];
  closedWith: number | null = null;
  send(data: string | Uint8Array): void {
    this.got.push(data);
    if (typeof data !== 'string') this.statesAt.push(Date.now());
  }
  close(code: number): void {
    this.closedWith = code;
  }
  messages(): ServerMessage[] {
    return this.got
      .filter((d): d is string => typeof d === 'string')
      .map((d) => decodeServerMessage(d))
      .filter((m): m is ServerMessage => m !== null);
  }
}

/** Un canal que no espera de mentira: guarda los estados y se puede "cortar". */
class FakeFast implements FastLink {
  open = true;
  readonly got: Uint8Array[] = [];
  send(data: Uint8Array): void {
    this.got.push(data);
  }
}

const hello = (name: string) =>
  encode({ type: 'hello', protocol: PROTOCOL_VERSION, playerName: name } as never);

describe('RoomHost: la Sala sin saber dónde corre', () => {
  const rooms: RoomHost[] = [];
  afterEach(() => {
    for (const room of rooms) room.stop();
  });

  function room(peers: FakePeer[]): RoomHost {
    const host = new RoomHost({ code: 'K7QF', peers: () => peers, report: () => {} });
    rooms.push(host);
    return host;
  }

  it('recibe a dos amigos, les da número y arranca el reloj', () => {
    const a = new FakePeer();
    const b = new FakePeer();
    const peers = [a, b];
    const host = room(peers);
    host.message(a, hello('Ana'));
    host.message(b, hello('Beto'));
    expect(a.playerId).toBeDefined();
    expect(b.playerId).toBeDefined();
    expect(a.playerId).not.toBe(b.playerId);
    expect(a.messages().some((m) => m.type === 'welcome' && m.roomCode === 'K7QF')).toBe(true);
    expect(host.running).toBe(true);
  });

  it('con otra versión del juego pide recargar', () => {
    const a = new FakePeer();
    room([a]).message(a, encode({ type: 'hello', protocol: -1, playerName: 'Ana' } as never));
    expect(a.messages()[0]).toMatchObject({ type: 'error' });
    expect(a.playerId).toBeUndefined();
  });

  it('cuando se van todos, para el reloj', () => {
    const a = new FakePeer();
    const peers = [a];
    const host = room(peers);
    host.message(a, hello('Ana'));
    peers.length = 0;
    host.closed(a);
    expect(host.running).toBe(false);
  });

  it('manda los estados parejos: sin huecos de 66 ms ni dos de golpe', () => {
    vi.useFakeTimers();
    try {
      const a = new FakePeer();
      const host = room([a]);
      host.message(a, hello('Ana'));
      host.message(a, encode({ type: 'begin' } as never));
      vi.advanceTimersByTime(20_000);
      // Antes, con un reloj fijo de 33 ms, cada 3 s salía un hueco de 66 ms (y el celular se
      // quedaba sin estado que mostrar). Jugando sale uno cada 33 o 34 ms; entre rondas, de a ratos.
      const gaps = a.statesAt.slice(1).map((at, i) => at - (a.statesAt[i] ?? at));
      expect(gaps.filter((gap) => gap >= 33 && gap <= 34).length).toBeGreaterThan(300);
      expect(gaps.filter((gap) => gap < 33 || (gap > 34 && gap < 300))).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('con canal que no espera, los estados van por él y vuelven al WebSocket si deja de andar', () => {
    vi.useFakeTimers();
    try {
      const a = new FakePeer();
      const offered: Peer[] = [];
      const host = new RoomHost({
        code: 'K7QF',
        peers: () => [a],
        report: () => {},
        offerFast: (peer) => offered.push(peer),
      });
      rooms.push(host);
      host.message(
        a,
        encode({ type: 'hello', protocol: PROTOCOL_VERSION, playerName: 'Ana', fast: true }),
      );
      expect(offered).toEqual([a]);
      const link = new FakeFast();
      a.fast = link;
      host.fastOpened(a);
      host.message(a, encode({ type: 'begin' }));
      const decoder = new DatagramStateDecoder();
      // El celular confirma cada estado que le llega por el canal.
      const confirmAll = () => {
        for (const data of link.got.splice(0)) {
          const got = decoder.decode(data);
          if (got) host.fastMessage(a, encodeDatagramAck(got.seq));
        }
      };
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(33);
        confirmAll();
      }
      const socketBefore = a.statesAt.length;
      vi.advanceTimersByTime(33);
      confirmAll();
      // Andando, por el WebSocket ya no va ningún estado.
      expect(a.statesAt.length).toBe(socketBefore);
      // Se corta (no llega nada, no confirma): en menos de medio segundo vuelven por el WebSocket.
      vi.advanceTimersByTime(500);
      expect(a.statesAt.length).toBeGreaterThan(socketBefore + 3);
      // Vuelve a confirmar: el WebSocket deja de llevarlos.
      vi.advanceTimersByTime(33);
      confirmAll();
      const socketAfter = a.statesAt.length;
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(33);
        confirmAll();
      }
      expect(a.statesAt.length).toBeLessThanOrEqual(socketAfter + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('el mismo toque por los dos canales cuenta una vez', () => {
    const a = new FakePeer();
    const host = room([a]);
    host.message(a, hello('Ana'));
    host.message(a, encode({ type: 'begin' }));
    const intents = [{ kind: 'move', x: 1, z: 0 }] as never;
    host.fastMessage(
      a,
      encode({
        type: 'intentsBatch',
        batches: [
          { seq: 2, intents },
          { seq: 1, intents },
        ],
      }),
    );
    host.message(a, encode({ type: 'intents', seq: 1, intents }));
    host.message(a, encode({ type: 'intents', seq: 2, intents }));
    host.message(a, encode({ type: 'intents', seq: 3, intents }));
    const pending = (
      host as unknown as { host: { slots: Map<number, { pending: unknown[] }> } }
    ).host.slots.get(a.playerId ?? -1)?.pending;
    expect(pending).toHaveLength(3);
  });
});
