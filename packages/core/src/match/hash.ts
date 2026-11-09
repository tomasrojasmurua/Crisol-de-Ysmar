import type { MatchState } from './state';

/** Huella del estado (FNV-1a sobre su JSON): sirve para comprobar repeticiones exactas. */
export function stateHash(state: MatchState): string {
  const text = JSON.stringify(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
