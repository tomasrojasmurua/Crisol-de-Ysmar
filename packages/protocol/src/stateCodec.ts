/**
 * El estado de la partida por la red, en binario y solo con lo que cambió.
 *
 * Cada conexión tiene un `StateEncoder` en la Sala y un `StateDecoder` en el celular. El primero
 * recuerda el último cuadro que mandó y manda solo la diferencia; el segundo la aplica sobre el
 * último cuadro que recibió. El WebSocket entrega en orden y sin perder nada, así que basta con
 * comparar contra el cuadro anterior. Si se corta, la conexión nueva parte de un cuadro completo.
 *
 * Los números con decimales viajan redondeados a milésimas (sobra para posiciones en metros y
 * vida). Los textos que se repiten (nombres de campos, ids de hechizos) se mandan una vez y luego
 * por su número en una tabla que ambos lados arman igual.
 */

/** Primer byte de un mensaje binario. */
export const FRAME_FULL = 1;
export const FRAME_DELTA = 2;

/** Etiquetas de valor. */
const T_SAME = 0;
const T_NULL = 1;
const T_FALSE = 2;
const T_TRUE = 3;
const T_INT = 4;
const T_FLOAT = 5;
const T_DOUBLE = 6;
const T_STR_NEW = 7;
const T_STR_REF = 8;
const T_ARRAY = 9;
const T_OBJECT = 10;
const T_OBJECT_DIFF = 11;
const T_ARRAY_DIFF = 12;
const T_ARRAY_ID_DIFF = 13;
const T_UNDEFINED = 14;

const FLOAT_SCALE = 1000;
/** Más allá de esto, un entero no cabe exacto en un double de JavaScript. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
/** Con más textos distintos que esto, la tabla deja de crecer y se mandan enteros. */
const MAX_STRINGS = 4096;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };

class Writer {
  private buffer = new Uint8Array(4096);
  length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const bigger = new Uint8Array(size);
    bigger.set(this.buffer.subarray(0, this.length));
    this.buffer = bigger;
  }

  byte(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value;
  }

  /** Entero sin signo de largo variable: 7 bits por byte. Sin operaciones de bits (más de 32). */
  uint(value: number): void {
    this.ensure(8);
    let v = value;
    while (v >= 128) {
      this.buffer[this.length++] = (v % 128) + 128;
      v = Math.floor(v / 128);
    }
    this.buffer[this.length++] = v;
  }

  /** Entero con signo en zigzag: 0, -1, 1, -2… para que los chicos ocupen poco. */
  int(value: number): void {
    this.uint(value >= 0 ? value * 2 : -value * 2 - 1);
  }

  double(value: number): void {
    this.ensure(8);
    new DataView(this.buffer.buffer).setFloat64(this.length, value, true);
    this.length += 8;
  }

  bytes(data: Uint8Array): void {
    this.ensure(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
  }

  result(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

class Reader {
  private offset = 0;
  private readonly view: DataView;
  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  byte(): number {
    const value = this.data[this.offset++];
    if (value === undefined) throw new Error('Mensaje cortado');
    return value;
  }

  uint(): number {
    let result = 0;
    let scale = 1;
    for (;;) {
      const b = this.byte();
      result += (b % 128) * scale;
      if (b < 128) return result;
      scale *= 128;
    }
  }

  int(): number {
    const z = this.uint();
    return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
  }

  double(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  bytes(length: number): Uint8Array {
    const slice = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}

/** La tabla de textos de una conexión: los dos lados la arman en el mismo orden. */
class StringTable {
  private readonly ids = new Map<string, number>();
  private readonly list: string[] = [];

  write(w: Writer, text: string): void {
    const id = this.ids.get(text);
    if (id !== undefined) {
      w.byte(T_STR_REF);
      w.uint(id);
      return;
    }
    const bytes = utf8Encode(text);
    w.byte(T_STR_NEW);
    w.uint(bytes.length);
    w.bytes(bytes);
    if (this.list.length < MAX_STRINGS) {
      this.ids.set(text, this.list.length);
      this.list.push(text);
    }
  }

  readNew(r: Reader): string {
    const text = utf8Decode(r.bytes(r.uint()));
    if (this.list.length < MAX_STRINGS) {
      this.ids.set(text, this.list.length);
      this.list.push(text);
    }
    return text;
  }

  ref(id: number): string {
    const text = this.list[id];
    if (text === undefined) throw new Error('Texto desconocido');
    return text;
  }
}

/** UTF-8 a mano: el núcleo y el protocolo no dependen de las APIs del navegador. */
function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let text = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++] ?? 0;
    let code = b;
    if (b >= 0xf0)
      code =
        ((b & 7) << 18) | (cont(bytes, i++) << 12) | (cont(bytes, i++) << 6) | cont(bytes, i++);
    else if (b >= 0xe0) code = ((b & 15) << 12) | (cont(bytes, i++) << 6) | cont(bytes, i++);
    else if (b >= 0xc0) code = ((b & 31) << 6) | cont(bytes, i++);
    text += String.fromCodePoint(code);
  }
  return text;
}

function cont(bytes: Uint8Array, i: number): number {
  return (bytes[i] ?? 0) & 63;
}

function isObject(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Si todos los elementos son objetos con `id` numérico distinto: se comparan por id. */
function keyedById(list: readonly unknown[]): boolean {
  if (list.length === 0) return false;
  const seen = new Set<number>();
  for (const item of list) {
    if (!isObject(item) || typeof item.id !== 'number' || seen.has(item.id)) return false;
    seen.add(item.id);
  }
  return true;
}

function writeValue(w: Writer, strings: StringTable, value: unknown): void {
  if (value === undefined) {
    w.byte(T_UNDEFINED);
  } else if (value === null) {
    w.byte(T_NULL);
  } else if (value === true) {
    w.byte(T_TRUE);
  } else if (value === false) {
    w.byte(T_FALSE);
  } else if (typeof value === 'number') {
    writeNumber(w, value);
  } else if (typeof value === 'string') {
    strings.write(w, value);
  } else if (Array.isArray(value)) {
    w.byte(T_ARRAY);
    w.uint(value.length);
    for (const item of value) writeValue(w, strings, item);
  } else if (isObject(value)) {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    w.byte(T_OBJECT);
    w.uint(keys.length);
    for (const key of keys) {
      strings.write(w, key);
      writeValue(w, strings, value[key]);
    }
  } else {
    w.byte(T_NULL);
  }
}

function writeNumber(w: Writer, value: number): void {
  if (Number.isInteger(value) && Math.abs(value) <= MAX_SAFE / 2) {
    w.byte(T_INT);
    w.int(value);
    return;
  }
  const scaled = Math.round(value * FLOAT_SCALE);
  if (Number.isFinite(value) && Math.abs(scaled) <= MAX_SAFE / 2) {
    w.byte(T_FLOAT);
    w.int(scaled);
    return;
  }
  w.byte(T_DOUBLE);
  w.double(value);
}

/** Escribe cómo pasar de `prev` a `next`. */
function writeDiff(w: Writer, strings: StringTable, prev: unknown, next: unknown): void {
  if (prev === next) {
    w.byte(T_SAME);
    return;
  }
  if (isObject(prev) && isObject(next)) {
    writeObjectDiff(w, strings, prev, next);
    return;
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (keyedById(next) && keyedById(prev)) {
      const before = new Map<number, unknown>();
      for (const item of prev) before.set((item as { id: number }).id, item);
      w.byte(T_ARRAY_ID_DIFF);
      w.uint(next.length);
      for (const item of next) {
        const id = (item as { id: number }).id;
        w.int(id);
        const old = before.get(id);
        if (old === undefined) writeValue(w, strings, item);
        else writeDiff(w, strings, old, item);
      }
      return;
    }
    if (prev.length === next.length && next.length > 0) {
      w.byte(T_ARRAY_DIFF);
      w.uint(next.length);
      for (let i = 0; i < next.length; i++) writeDiff(w, strings, prev[i], next[i]);
      return;
    }
  }
  if (typeof prev === 'number' && typeof next === 'number' && sameNumber(prev, next)) {
    w.byte(T_SAME);
    return;
  }
  writeValue(w, strings, next);
}

function writeObjectDiff(
  w: Writer,
  strings: StringTable,
  prev: Record<string, Json | undefined>,
  next: Record<string, Json | undefined>,
): void {
  const changed: string[] = [];
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (value === undefined) continue;
    if (!unchanged(prev[key], value)) changed.push(key);
  }
  const removed = Object.keys(prev).filter(
    (key) => prev[key] !== undefined && next[key] === undefined,
  );
  if (changed.length === 0 && removed.length === 0) {
    w.byte(T_SAME);
    return;
  }
  w.byte(T_OBJECT_DIFF);
  w.uint(changed.length);
  for (const key of changed) {
    strings.write(w, key);
    writeDiff(w, strings, prev[key], next[key]);
  }
  w.uint(removed.length);
  for (const key of removed) strings.write(w, key);
}

/** Igualdad profunda barata, para no mandar campos que no cambiaron. */
function unchanged(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return sameNumber(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!unchanged(a[i], b[i])) return false;
    return true;
  }
  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a).filter((k) => a[k] !== undefined);
    const keysB = Object.keys(b).filter((k) => b[k] !== undefined);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) if (!unchanged(a[key], b[key])) return false;
    return true;
  }
  return false;
}

/** Dos números que el celular vería iguales (mismas milésimas). */
function sameNumber(a: number, b: number): boolean {
  if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
  return Math.round(a * FLOAT_SCALE) === Math.round(b * FLOAT_SCALE);
}

function readValue(r: Reader, strings: StringTable, tag: number = r.byte()): unknown {
  switch (tag) {
    case T_UNDEFINED:
      return undefined;
    case T_NULL:
      return null;
    case T_TRUE:
      return true;
    case T_FALSE:
      return false;
    case T_INT:
      return r.int();
    case T_FLOAT:
      return r.int() / FLOAT_SCALE;
    case T_DOUBLE:
      return r.double();
    case T_STR_NEW:
      return strings.readNew(r);
    case T_STR_REF:
      return strings.ref(r.uint());
    case T_ARRAY: {
      const length = r.uint();
      const list: unknown[] = new Array(length);
      for (let i = 0; i < length; i++) list[i] = readValue(r, strings);
      return list;
    }
    case T_OBJECT: {
      const count = r.uint();
      const object: Record<string, unknown> = {};
      for (let i = 0; i < count; i++) {
        const key = readString(r, strings);
        object[key] = readValue(r, strings);
      }
      return object;
    }
    default:
      throw new Error(`Etiqueta desconocida ${tag}`);
  }
}

function readString(r: Reader, strings: StringTable): string {
  const tag = r.byte();
  if (tag === T_STR_NEW) return strings.readNew(r);
  if (tag === T_STR_REF) return strings.ref(r.uint());
  throw new Error('Se esperaba un texto');
}

/** Aplica una diferencia sobre `prev` sin modificarlo: lo que no cambió se comparte. */
function readDiff(r: Reader, strings: StringTable, prev: unknown): unknown {
  const tag = r.byte();
  switch (tag) {
    case T_SAME:
      return prev;
    case T_OBJECT_DIFF: {
      const base = isObject(prev) ? prev : {};
      const next: Record<string, unknown> = { ...base };
      const changed = r.uint();
      for (let i = 0; i < changed; i++) {
        const key = readString(r, strings);
        next[key] = readDiff(r, strings, base[key]);
      }
      const removed = r.uint();
      for (let i = 0; i < removed; i++) delete next[readString(r, strings)];
      return next;
    }
    case T_ARRAY_DIFF: {
      const base = Array.isArray(prev) ? prev : [];
      const length = r.uint();
      const next: unknown[] = new Array(length);
      for (let i = 0; i < length; i++) next[i] = readDiff(r, strings, base[i]);
      return next;
    }
    case T_ARRAY_ID_DIFF: {
      const before = new Map<number, unknown>();
      if (Array.isArray(prev)) {
        for (const item of prev) if (isObject(item)) before.set(item.id as number, item);
      }
      const length = r.uint();
      const next: unknown[] = new Array(length);
      for (let i = 0; i < length; i++) {
        const id = r.int();
        next[i] = readDiff(r, strings, before.get(id));
      }
      return next;
    }
    default:
      return readValue(r, strings, tag);
  }
}

/** En la Sala, uno por conexión: convierte cada cuadro en bytes, completo o como diferencia. */
export class StateEncoder {
  private previous: unknown = undefined;
  private strings = new StringTable();

  /** Olvida lo mandado: el próximo cuadro va completo (conexión nueva). */
  reset(): void {
    this.previous = undefined;
    this.strings = new StringTable();
  }

  encode(frame: unknown): Uint8Array {
    const w = new Writer();
    if (this.previous === undefined) {
      w.byte(FRAME_FULL);
      writeValue(w, this.strings, frame);
    } else {
      w.byte(FRAME_DELTA);
      writeDiff(w, this.strings, this.previous, frame);
    }
    this.previous = frame;
    return w.result();
  }
}

/** En el celular: arma cada cuadro aplicando lo recibido sobre el anterior. */
export class StateDecoder {
  private previous: unknown = undefined;
  private strings = new StringTable();

  decode(data: Uint8Array): unknown {
    const r = new Reader(data);
    const kind = r.byte();
    if (kind === FRAME_FULL) {
      this.strings = new StringTable();
      this.previous = readValue(r, this.strings);
    } else if (kind === FRAME_DELTA) {
      if (this.previous === undefined) throw new Error('Diferencia sin cuadro anterior');
      this.previous = readDiff(r, this.strings, this.previous);
    } else {
      throw new Error('Mensaje binario desconocido');
    }
    return this.previous;
  }
}
