/**
 * El estado de la partida por el canal que no espera (WebRTC, sin reenvíos ni orden).
 *
 * Por el WebSocket todo llega en orden y nada se pierde, así que cada cuadro va como diferencia con
 * el anterior. Pero si se pierde un paquete, el WebSocket detiene todo lo que viene detrás hasta
 * reenviarlo: en una red móvil eso son silencios de 200 ms a más de un segundo, varias veces por
 * minuto (prueba del 21 de noviembre). Por este canal, un paquete perdido se olvida y se usa el
 * siguiente, como en los juegos en línea grandes:
 *
 * - Cada cuadro va como diferencia con el último que el celular **confirmó** haber recibido (no con
 *   el anterior, que pudo perderse). Sin confirmaciones todavía, va completo.
 * - Los textos llevan su número la primera vez y hasta que un cuadro que los traía se confirma;
 *   recién ahí se mandan solo por número.
 * - Los eventos (golpes, sonidos) de los cuadros aún no confirmados viajan de nuevo en cada cuadro:
 *   si uno se perdió, sus eventos llegan con el siguiente. El celular no repite los que ya vio.
 */
import {
  MAX_STRINGS,
  Reader,
  readDiff,
  readValue,
  type Strings,
  T_STR_DEF,
  T_STR_NEW,
  T_STR_REF,
  utf8Decode,
  utf8Encode,
  Writer,
  writeDiff,
  writeValue,
} from './stateCodec';

/** Primer byte de un cuadro por el canal que no espera. */
export const DATAGRAM_FRAME = 3;
/** Primer byte de una confirmación del celular ("recibí el cuadro tal"). */
export const DATAGRAM_ACK = 5;
/** Cuadros sin confirmar que se recuerdan (unos 2 s): más atrás, se vuelve a mandar completo. */
const MAX_UNACKED = 64;

interface SentFrame {
  readonly seq: number;
  readonly frame: unknown;
  /** Los textos que este cuadro definió: al confirmarlo, el celular los conoce. */
  readonly defs: readonly number[];
}

/** Textos para el canal que no espera: con número hasta que el celular confirma conocerlos. */
class AckedStrings implements Strings {
  private readonly ids = new Map<string, number>();
  private readonly list: string[] = [];
  private readonly known = new Set<number>();
  private frameDefs: number[] = [];
  private readonly inFrame = new Set<number>();

  write(w: Writer, text: string): void {
    let id = this.ids.get(text);
    if (id === undefined) {
      if (this.list.length >= MAX_STRINGS) {
        const bytes = utf8Encode(text);
        w.byte(T_STR_NEW);
        w.uint(bytes.length);
        w.bytes(bytes);
        return;
      }
      id = this.list.length;
      this.ids.set(text, id);
      this.list.push(text);
    }
    if (this.known.has(id) || this.inFrame.has(id)) {
      w.byte(T_STR_REF);
      w.uint(id);
      return;
    }
    const bytes = utf8Encode(text);
    w.byte(T_STR_DEF);
    w.uint(id);
    w.uint(bytes.length);
    w.bytes(bytes);
    this.frameDefs.push(id);
    this.inFrame.add(id);
  }

  idOf(text: string): number | undefined {
    const id = this.ids.get(text);
    return id !== undefined && (this.known.has(id) || this.inFrame.has(id)) ? id : undefined;
  }

  mark(): number {
    return this.frameDefs.length;
  }

  rewind(mark: number): void {
    while (this.frameDefs.length > mark) this.inFrame.delete(this.frameDefs.pop() as number);
  }

  begin(): void {
    this.frameDefs = [];
    this.inFrame.clear();
  }

  end(): number[] {
    return this.frameDefs;
  }

  learn(defs: readonly number[]): void {
    for (const id of defs) this.known.add(id);
  }

  readNew(): string {
    throw new Error('Solo escribe');
  }

  readDef(): string {
    throw new Error('Solo escribe');
  }

  ref(): string {
    throw new Error('Solo escribe');
  }
}

/** En el celular: cada texto queda en su número, llegue en el orden que llegue. */
class SparseStrings implements Strings {
  private readonly list: (string | undefined)[] = [];

  readNew(r: Reader): string {
    return utf8Decode(r.bytes(r.uint()));
  }

  readDef(r: Reader): string {
    const id = r.uint();
    const text = utf8Decode(r.bytes(r.uint()));
    if (id < MAX_STRINGS) this.list[id] = text;
    return text;
  }

  ref(id: number): string {
    const text = this.list[id];
    if (text === undefined) throw new Error('Texto desconocido');
    return text;
  }

  write(): void {
    throw new Error('Solo lee');
  }

  idOf(): number | undefined {
    return undefined;
  }

  mark(): number {
    return 0;
  }

  rewind(): void {}
}

/**
 * En la Sala, uno por celular con canal que no espera. `eventsOf` saca de un cuadro sus eventos,
 * que se repiten mientras ese cuadro no se confirme. `keyOf` le da a cada cuadro un número que el
 * celular reconoce aunque el mismo cuadro le llegue también por el WebSocket (la ronda y el paso):
 * así no repite los eventos que ya vio por el otro lado.
 */
export class DatagramStateEncoder {
  private strings = new AckedStrings();
  private seq = 0;
  private sent: SentFrame[] = [];
  private base: SentFrame | null = null;
  private readonly writer = new Writer();

  constructor(
    private readonly eventsOf: (frame: unknown) => readonly unknown[],
    private readonly keyOf: (frame: unknown) => number = () => 0,
  ) {}

  /** El número del último cuadro confirmado (0 si ninguno). */
  get acked(): number {
    return this.base?.seq ?? 0;
  }

  /** El número del último cuadro mandado. */
  get latest(): number {
    return this.seq;
  }

  /** Olvida todo: el próximo cuadro va completo (el celular volvió a la app, por ejemplo). */
  reset(): void {
    this.strings = new AckedStrings();
    this.sent = [];
    this.base = null;
  }

  encode(frame: unknown): Uint8Array {
    const w = this.writer;
    const strings = this.strings;
    const base = this.base;
    this.seq++;
    strings.begin();
    w.byte(DATAGRAM_FRAME);
    w.uint(this.seq);
    w.uint(base?.seq ?? 0);
    const missed = this.sent.filter((s) => this.eventsOf(s.frame).length > 0);
    w.uint(missed.length);
    for (const s of missed) {
      w.uint(s.seq);
      w.uint(Math.max(0, Math.floor(this.keyOf(s.frame))));
      writeValue(w, strings, this.eventsOf(s.frame));
    }
    if (base) writeDiff(w, strings, base.frame, frame);
    else writeValue(w, strings, frame);
    this.sent.push({ seq: this.seq, frame, defs: [...strings.end()] });
    if (this.sent.length > MAX_UNACKED) {
      // Hace mucho que no confirma nada: se vuelve a partir de un cuadro completo.
      this.sent.shift();
      if (base && this.seq - base.seq > MAX_UNACKED) this.base = null;
    }
    return w.take();
  }

  /** El celular confirmó un cuadro: desde ahora se manda la diferencia con ese. */
  ack(seq: number): void {
    if (this.base && seq <= this.base.seq) return;
    const index = this.sent.findIndex((s) => s.seq === seq);
    const confirmed = this.sent[index];
    if (!confirmed) return;
    this.strings.learn(confirmed.defs);
    this.base = confirmed;
    this.sent = this.sent.slice(index + 1);
  }
}

/** Un cuadro leído del canal que no espera. */
export interface DatagramFrame {
  readonly seq: number;
  readonly frame: unknown;
  /** Si llegó después de uno más nuevo (se usan solo sus eventos). */
  readonly stale: boolean;
  /** Eventos de cuadros que no llegaron (o llegaron tarde), en orden, aún no vistos. */
  readonly missedEvents: readonly unknown[];
  /** Los mismos, junto al número (`keyOf`) del cuadro de cada uno. */
  readonly missed: readonly MissedEvents[];
}

/** Los eventos de un cuadro que no llegó por el canal. */
export interface MissedEvents {
  readonly key: number;
  readonly events: readonly unknown[];
}

/** En el celular: arma cada cuadro sobre el que confirmó, y junta los eventos perdidos. */
export class DatagramStateDecoder {
  private readonly strings = new SparseStrings();
  private readonly frames = new Map<number, unknown>();
  private readonly seen = new Set<number>();
  private newest = 0;

  /**
   * Lee un cuadro. `null` si no se puede armar: su base ya no está (el próximo vendrá sobre una
   * más nueva) o ya se había leído.
   */
  decode(data: Uint8Array): DatagramFrame | null {
    const r = new Reader(data);
    if (r.byte() !== DATAGRAM_FRAME) throw new Error('No es un cuadro del canal rápido');
    const seq = r.uint();
    const baseSeq = r.uint();
    if (this.seen.has(seq)) return null;
    const missed: { seq: number; key: number; events: unknown }[] = [];
    // Los eventos se leen siempre: pueden definir textos que usa el cuadro.
    for (let count = r.uint(); count > 0; count--) {
      const at = r.uint();
      const key = r.uint();
      missed.push({ seq: at, key, events: readValue(r, this.strings) });
    }
    let frame: unknown;
    if (baseSeq === 0) {
      frame = readValue(r, this.strings);
    } else {
      const base = this.frames.get(baseSeq);
      if (base === undefined) return null;
      frame = readDiff(r, this.strings, base);
    }
    this.frames.set(seq, frame);
    // La Sala nunca vuelve a una base más vieja: lo anterior ya no sirve.
    for (const key of this.frames.keys()) if (key < baseSeq) this.frames.delete(key);
    for (const key of this.seen) if (key < baseSeq) this.seen.delete(key);
    const groups: MissedEvents[] = [];
    for (const m of missed) {
      if (m.seq === seq || this.seen.has(m.seq)) continue;
      this.seen.add(m.seq);
      if (Array.isArray(m.events) && m.events.length > 0) {
        groups.push({ key: m.key, events: m.events });
      }
    }
    this.seen.add(seq);
    const stale = seq < this.newest;
    this.newest = Math.max(this.newest, seq);
    return { seq, frame, stale, missedEvents: groups.flatMap((g) => g.events), missed: groups };
  }
}

/** La confirmación que manda el celular por el mismo canal. */
const ackWriter = new Writer();

export function encodeDatagramAck(seq: number): Uint8Array {
  const w = ackWriter;
  w.byte(DATAGRAM_ACK);
  w.uint(seq);
  return w.take();
}

/** El número confirmado, o null si no es una confirmación. */
export function decodeDatagramAck(data: Uint8Array): number | null {
  try {
    const r = new Reader(data);
    if (r.byte() !== DATAGRAM_ACK) return null;
    return r.uint();
  } catch {
    return null;
  }
}
