import { describe, expect, it } from 'vitest';
import { FRAME_DELTA, FRAME_FULL, StateDecoder, StateEncoder } from './stateCodec';

/** Lo que el celular debería ver: los decimales a milésimas y sin campos indefinidos. */
function expected(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v,
    ),
  );
}

function frame(tick: number) {
  return {
    ack: tick,
    stage: { kind: 'playing' },
    hidden: [] as number[],
    state: {
      tick,
      rngState: 4_000_000_000 + tick,
      wizards: [
        {
          id: 1,
          pos: { x: 1.23456 + tick * 0.1, z: -3.5 },
          hp: 100,
          weave: ['brasa'],
          channel: null,
        },
        {
          id: 2,
          pos: { x: -7, z: 2.25 },
          hp: 87.3333,
          weave: [],
          channel: { weave: ['marea'], ticks: 3 },
        },
      ],
      spells: tick % 2 ? [{ id: 9, kind: 'projectile', pos: { x: tick, z: 0 } }] : [],
      events: tick % 3 === 0 ? [{ type: 'hit', targetId: 2, amount: 6.5 }] : [],
      statuses: tick > 2 ? { burn: { ticks: 30 - tick } } : {},
    },
  };
}

describe('estado por la red', () => {
  it('el primer cuadro va completo y los siguientes como diferencia', () => {
    const encoder = new StateEncoder();
    expect(encoder.encode(frame(0))[0]).toBe(FRAME_FULL);
    expect(encoder.encode(frame(1))[0]).toBe(FRAME_DELTA);
  });

  it('el celular reconstruye cada cuadro igual al de la Sala', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    for (let tick = 0; tick < 12; tick++) {
      const sent = frame(tick);
      expect(decoder.decode(encoder.encode(sent))).toEqual(expected(sent));
    }
  });

  it('una diferencia sin cambios ocupa casi nada', () => {
    const encoder = new StateEncoder();
    const same = frame(4);
    const full = encoder.encode(same).length;
    const delta = encoder.encode(frame(4)).length;
    expect(delta).toBeLessThan(full / 10);
    expect(delta).toBeLessThanOrEqual(2);
  });

  it('los enteros grandes y los negativos llegan exactos', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    const value = { a: 4294967295, b: -123456789, c: 2 ** 40, d: -0.0016, e: 1e300 };
    expect(decoder.decode(encoder.encode(value))).toEqual({ ...value, d: -0.002 });
  });

  it('los textos con tildes y eñes llegan intactos', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    const value = { name: 'Tomás Ñandú 🜂', again: 'Tomás Ñandú 🜂' };
    expect(decoder.decode(encoder.encode(value))).toEqual(value);
  });

  it('las entidades que nacen, mueren o cambian de orden se siguen por id', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    const a = {
      list: [
        { id: 1, v: 1 },
        { id: 2, v: 2 },
        { id: 3, v: 3 },
      ],
    };
    const b = {
      list: [
        { id: 3, v: 3 },
        { id: 4, v: 4 },
        { id: 1, v: 9 },
      ],
    };
    decoder.decode(encoder.encode(a));
    expect(decoder.decode(encoder.encode(b))).toEqual(b);
  });

  it('lo que no cambió se comparte con el cuadro anterior', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    const first = decoder.decode(encoder.encode(frame(1))) as ReturnType<typeof frame>;
    const second = decoder.decode(encoder.encode(frame(2))) as ReturnType<typeof frame>;
    expect(second.state.wizards[1]).toBe(first.state.wizards[1]);
    expect(second.state.wizards[0]).not.toBe(first.state.wizards[0]);
  });

  it('tras reiniciar el codificador, el decodificador acepta el cuadro completo nuevo', () => {
    const encoder = new StateEncoder();
    const decoder = new StateDecoder();
    decoder.decode(encoder.encode(frame(1)));
    encoder.reset();
    expect(decoder.decode(encoder.encode(frame(5)))).toEqual(expected(frame(5)));
  });

  it('una diferencia sin cuadro anterior es un error, no un estado inventado', () => {
    const encoder = new StateEncoder();
    encoder.encode(frame(1));
    const delta = encoder.encode(frame(2));
    expect(() => new StateDecoder().decode(delta)).toThrow();
  });
});
