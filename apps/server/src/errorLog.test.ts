import { describe, expect, it } from 'vitest';
import { receiveReports, reportRoomError } from './errorLog';

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

const report = {
  kind: 'error',
  message: 'boom',
  detail: '',
  version: 'v79',
  device: 'iPhone · iOS 18.1 · Safari 18',
  screen: '844×390 @3x',
  room: 'ABCD',
  match: 'red #1 · ronda 2',
  session: 'abc',
  uptime: 40,
};

function post(body: string): Request {
  return new Request('https://x/api/errors', { method: 'POST', body });
}

describe('registro de errores', () => {
  it('guarda los informes válidos y crea la tabla la primera vez', async () => {
    const { db, batches } = fakeDb();
    const tasks: Promise<unknown>[] = [];
    const response = await receiveReports(
      post(JSON.stringify([report, { kind: 'raro' }])),
      db,
      (t) => tasks.push(t),
    );
    await Promise.all(tasks);
    expect(response.status).toBe(204);
    expect(batches[0]?.[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS reports');
    const inserts = batches[1]?.filter((s) => s.sql.includes('INSERT')) ?? [];
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.args.slice(1, 4)).toEqual(['cliente', 'error', 'boom']);
    expect(batches[1]?.at(-1)?.sql).toContain('DELETE FROM reports');
  });

  it('responde igual sin base de datos o con basura', async () => {
    expect((await receiveReports(post('{{'), undefined, () => {})).status).toBe(204);
    const { db, batches } = fakeDb();
    await receiveReports(post('[]'), db, () => {});
    expect(batches).toHaveLength(0);
  });

  it('la Sala anota sus propios errores', async () => {
    const { db, batches } = fakeDb();
    const original = console.error;
    console.error = () => {};
    await reportRoomError(db, 'WXYZ', 'paso', new Error('falló'));
    console.error = original;
    const insert = batches.flat().find((s) => s.sql.includes('INSERT'));
    expect(insert?.args.slice(1, 4)).toEqual(['sala', 'sala', 'paso: Error: falló']);
    expect(insert?.args[8]).toBe('WXYZ');
  });
});
