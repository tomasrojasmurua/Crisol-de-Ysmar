import { describe, expect, it } from 'vitest';
import { receiveMatchLog } from './matchLog';

interface Statement {
  sql: string;
  args: unknown[];
}

/** Una D1 de mentira: anota cada lote de sentencias. */
function fakeDb(): { db: D1Database; batches: Statement[][] } {
  const batches: Statement[][] = [];
  const statement = (sql: string, args: unknown[] = []): Statement & { bind: unknown } => ({
    sql,
    args,
    bind: (...next: unknown[]) => statement(sql, next),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (list: Statement[]) => {
      batches.push(list.map(({ sql, args }) => ({ sql, args })));
      return [];
    },
  } as unknown as D1Database;
  return { db, batches };
}

const log = {
  format: 1,
  source: 'ia',
  mode: 'duel',
  botLevel: 'duelist',
  wizards: [
    { id: 1, team: 0, human: true },
    { id: 2, team: 1, human: false },
  ],
  rounds: [
    {
      ticks: 90,
      winnerTeam: 1,
      casts: [[3, 1, 'fireball']],
      hits: [],
      blocked: [],
      combos: [],
      falls: [],
    },
  ],
  winnerTeam: 1,
  version: 'v80',
};

function post(body: string): Request {
  return new Request('https://x/api/partida', { method: 'POST', body });
}

describe('registro de partidas en D1', () => {
  it('guarda un registro válido (creando la tabla) y borra los viejos', async () => {
    const { db, batches } = fakeDb();
    const tasks: Promise<unknown>[] = [];
    const response = await receiveMatchLog(post(JSON.stringify(log)), db, (t) => tasks.push(t));
    await Promise.all(tasks);
    expect(response.status).toBe(204);
    expect(batches[0]?.[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS matches');
    const insert = batches[1]?.[0];
    expect(insert?.args.slice(1, 6)).toEqual(['ia', 'duel', 'duelist', 1, 'v80']);
    expect(JSON.parse(insert?.args[6] as string).rounds[0].casts).toEqual([[3, 1, 'fireball']]);
    expect(batches[1]?.[1]?.sql).toContain('DELETE FROM matches');
  });

  it('rechaza lo mal formado sin guardar nada', async () => {
    const { db, batches } = fakeDb();
    const response = await receiveMatchLog(post('{"format":1}'), db, () => undefined);
    expect(response.status).toBe(400);
    expect(batches).toHaveLength(0);
  });
});
