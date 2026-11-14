import {
  decodeServerMessage,
  encode,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@crisol/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { type Peer, RoomHost } from './roomHost';

/** Una conexión de mentira: guarda lo que la Sala le manda. */
class FakePeer implements Peer {
  playerId: number | undefined = undefined;
  readonly got: (string | Uint8Array)[] = [];
  closedWith: number | null = null;
  send(data: string | Uint8Array): void {
    this.got.push(data);
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
});
