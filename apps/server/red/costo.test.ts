/**
 * Cuánto le cuesta a la Sala cada paso con 6 magos (la IA juega por todos), contando el núcleo
 * y armar el estado de cada jugador. El paso dura 33 ms: si esto se acerca, la partida se atrasa.
 *
 *   pnpm exec vitest run --config apps/server/red/vitest.config.ts apps/server/red/costo.test.ts
 */
import { StateEncoder } from '@crisol/protocol';
import { expect, test } from 'vitest';
import { DuelHost } from '../src/duel';

test('costo de un paso con 6 jugadores', () => {
  const host = new DuelHost(7, () => Math.random().toString(36));
  const ids: number[] = [];
  for (let i = 0; i < 6; i++) {
    const joined = host.join({ name: `A${i}` });
    if (joined) ids.push(joined.playerId);
  }
  const first = ids[0] ?? 1;
  host.configure(first, {
    mode: { kind: 'ffa', players: 6 },
    minutes: 5,
    bestOf: 1,
    glyphs: true,
    omen: true,
  });
  host.begin(first);
  // Todos "se desconectan": la IA juega por todos, como peor caso de cálculo.
  for (const id of ids) host.leave(id);
  const encoders = ids.map(() => new StateEncoder());
  const times: number[] = [];
  let bytes = 0;
  for (let t = 0; t < 30 * 120; t++) {
    const start = performance.now();
    host.tick();
    if (host.state && host.stageFor(first).kind === 'playing') {
      const snapshot = structuredClone(host.state);
      ids.forEach((id, i) => {
        bytes += encoders[i]?.encode(host.frameFor(id, snapshot)).length ?? 0;
      });
    }
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const at = (p: number): string => (times[Math.floor(times.length * p)] ?? 0).toFixed(2);
  const kbps = (bytes / ids.length / 120 / 1024).toFixed(1);
  process.stderr.write(
    `\np50 ${at(0.5)} ms · p95 ${at(0.95)} · p99 ${at(0.99)} · máx ${(times.at(-1) ?? 0).toFixed(1)} · ${kbps} KB/s por jugador\n`,
  );
  expect(at(0.99)).not.toBe('');
});
