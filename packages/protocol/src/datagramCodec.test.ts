import { describe, expect, it } from 'vitest';
import {
  DATAGRAM_FRAME,
  DatagramStateDecoder,
  DatagramStateEncoder,
  decodeDatagramAck,
  encodeDatagramAck,
} from './datagramCodec';

/** Lo que el celular debería ver: los decimales a milésimas y sin campos indefinidos. */
function expected(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v,
    ),
  );
}

/** Un cuadro con textos nuevos de a ratos (hechizos que aparecen) y eventos cada tres pasos. */
function frame(tick: number) {
  return {
    ack: tick,
    stage: { kind: 'playing' },
    state: {
      tick,
      wizards: [
        { id: 1, pos: { x: 1.5 + tick * 0.1, z: -3.5 }, hp: 100, weave: ['brasa'] },
        { id: 2, pos: { x: -7, z: 2.25 + tick * 0.2 }, hp: 90 - tick, weave: [] },
      ],
      spells: [{ id: 100 + (tick % 7), kind: `hechizo-${tick % 5}`, pos: { x: tick, z: 0 } }],
      events: tick % 3 === 0 ? [{ type: `golpe-${tick % 4}`, targetId: 2, tick }] : [],
    },
  };
}

type Frame = ReturnType<typeof frame>;
const eventsOf = (f: unknown): readonly unknown[] => (f as Frame).state.events;

/** Una red simulada: pierde, desordena o atrasa las confirmaciones según `lose`. */
function play(steps: number, lose: (step: number) => boolean, ackLost = (_: number) => false) {
  const encoder = new DatagramStateEncoder(eventsOf);
  const decoder = new DatagramStateDecoder();
  const shown: Frame[] = [];
  const events: unknown[] = [];
  for (let tick = 0; tick < steps; tick++) {
    const data = encoder.encode(frame(tick));
    if (lose(tick)) continue;
    const got = decoder.decode(data);
    if (!got) continue;
    events.push(...got.missedEvents);
    if (!got.stale) {
      shown.push(got.frame as Frame);
      events.push(...(got.frame as Frame).state.events);
    }
    if (!ackLost(tick)) encoder.ack(got.seq);
  }
  return { shown, events, encoder };
}

describe('estado por el canal que no espera', () => {
  it('sin pérdidas, cada cuadro llega igual al de la Sala', () => {
    const { shown } = play(40, () => false);
    expect(shown).toHaveLength(40);
    for (const [tick, f] of shown.entries()) expect(f).toEqual(expected(frame(tick)));
  });

  it('si se pierden cuadros, los siguientes se arman igual y ningún evento se pierde', () => {
    // Uno de cada tres se pierde, y a ratos varios seguidos.
    const lose = (t: number) => t % 3 === 1 || (t >= 20 && t < 26);
    const { shown, events } = play(60, lose);
    for (const f of shown) expect(f).toEqual(expected(frame(f.state.tick)));
    const all = Array.from({ length: 60 }, (_, t) => frame(t).state.events).flat();
    // Los eventos de los cuadros perdidos llegan con el siguiente: todos, una sola vez.
    expect(events.map((e) => (e as { tick: number }).tick).sort((a, b) => a - b)).toEqual(
      all.map((e) => e.tick),
    );
  });

  it('si se pierden las confirmaciones, sigue armando cada cuadro', () => {
    const { shown } = play(
      80,
      () => false,
      (t) => t % 2 === 0 || (t > 30 && t < 50),
    );
    expect(shown).toHaveLength(80);
    for (const f of shown) expect(f).toEqual(expected(frame(f.state.tick)));
  });

  it('un cuadro que llega tarde no se muestra ni repite sus eventos', () => {
    const encoder = new DatagramStateEncoder(eventsOf);
    const decoder = new DatagramStateDecoder();
    const a = encoder.encode(frame(0)); // con evento
    const b = encoder.encode(frame(1));
    const second = decoder.decode(b);
    expect(second?.stale).toBe(false);
    // El 0 se repite en el 1 (no estaba confirmado): sus eventos ya llegaron.
    expect(second?.missedEvents).toHaveLength(1);
    expect(decoder.decode(a)).toBeNull();
    // Uno viejo sin eventos sí se lee (por si acaso), pero marcado como viejo.
    encoder.encode(frame(1));
    const newer = encoder.encode(frame(2));
    const older = encoder.encode(frame(1));
    expect(decoder.decode(older)?.stale).toBe(false);
    expect(decoder.decode(newer)?.stale).toBe(true);
  });

  it('con confirmaciones, la diferencia es chica', () => {
    const encoder = new DatagramStateEncoder(eventsOf);
    const decoder = new DatagramStateDecoder();
    let size = 0;
    for (let tick = 0; tick < 20; tick++) {
      const data = encoder.encode(frame(tick));
      const got = decoder.decode(data);
      if (got) encoder.ack(got.seq);
      size = data.length;
    }
    const full = new DatagramStateEncoder(eventsOf).encode(frame(19)).length;
    expect(size).toBeLessThan(full / 2);
  });

  it('después de olvidar todo, el próximo cuadro va completo y se arma', () => {
    const encoder = new DatagramStateEncoder(eventsOf);
    const decoder = new DatagramStateDecoder();
    for (let tick = 0; tick < 5; tick++) {
      const got = decoder.decode(encoder.encode(frame(tick)));
      if (got) encoder.ack(got.seq);
    }
    encoder.reset();
    const data = encoder.encode(frame(5));
    expect(data[0]).toBe(DATAGRAM_FRAME);
    expect(decoder.decode(data)?.frame).toEqual(expected(frame(5)));
  });

  it('los eventos perdidos llegan con el número de su cuadro', () => {
    const encoder = new DatagramStateEncoder(eventsOf, (f) => (f as Frame).state.tick + 1000);
    const decoder = new DatagramStateDecoder();
    encoder.encode(frame(3)); // con evento: se pierde
    encoder.encode(frame(4));
    const got = decoder.decode(encoder.encode(frame(5)));
    expect(got?.missed).toEqual([{ key: 1003, events: expected(frame(3).state.events) }]);
  });

  it('la confirmación es un mensaje de pocos bytes', () => {
    const ack = encodeDatagramAck(70_000);
    expect(ack.length).toBeLessThan(6);
    expect(decodeDatagramAck(ack)).toBe(70_000);
    expect(decodeDatagramAck(new Uint8Array([1, 2]))).toBeNull();
  });
});
