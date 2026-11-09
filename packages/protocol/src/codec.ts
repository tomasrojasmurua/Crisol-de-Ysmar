import type { ClientMessage, ServerMessage } from './messages';

/**
 * Codificación de mensajes. En el Hito 0 es JSON para depurar fácil;
 * en el Hito 2 se reemplaza por binario sin tocar a quien la usa.
 */
export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export function decodeClientMessage(raw: string): ClientMessage | null {
  return parseWithType<ClientMessage>(raw, ['hello', 'intents', 'ping']);
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  return parseWithType<ServerMessage>(raw, ['welcome', 'pong', 'error']);
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
