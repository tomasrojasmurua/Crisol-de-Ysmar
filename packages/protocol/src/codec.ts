import type { ClientMessage, ServerMessage } from './messages';

/**
 * Mensajes de texto (JSON): todo lo poco frecuente. El estado de cada paso va aparte, en binario
 * y solo con lo que cambió (`stateCodec.ts`).
 */
export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export function decodeClientMessage(raw: string): ClientMessage | null {
  return parseWithType<ClientMessage>(raw, [
    'hello',
    'intents',
    'glyph',
    'rematch',
    'away',
    'ping',
  ]);
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  return parseWithType<ServerMessage>(raw, ['welcome', 'players', 'start', 'pong', 'error']);
}

function parseWithType<T extends { type: string }>(
  raw: string,
  types: readonly string[],
): T | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      typeof value.type === 'string' &&
      types.includes(value.type)
    ) {
      return value as T;
    }
    return null;
  } catch {
    return null;
  }
}
