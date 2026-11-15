import { describe, expect, it } from 'vitest';
import { handleProfile, profileId } from './profiles';

/** Una D1 de mentira que entiende las tres sentencias del respaldo. */
function fakeDb(): { db: D1Database; rows: Map<string, { data: string; updated_at: string }> } {
  const rows = new Map<string, { data: string; updated_at: string }>();
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    run: async () => {
      const [id, data, at] = args as [string, string, string];
      if (sql.includes('INSERT INTO profiles')) rows.set(id, { data, updated_at: at });
      return {};
    },
    first: async () => rows.get(args[0] as string) ?? null,
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async () => [],
  } as unknown as D1Database;
  return { db, rows };
}

const CODE = 'K7QFM9XA2RHT';

function post(body: unknown, path = '/api/perfil'): Request {
  return new Request(`https://x${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('respaldo de perfiles', () => {
  it('guarda y devuelve el progreso con el código, aunque venga con guiones', async () => {
    const { db, rows } = fakeDb();
    const entries = { 'crisol.perfil': '{"name":"Tomás"}', 'crisol.grimorio': '["brasa"]' };
    const saved = await handleProfile(post({ code: 'k7qf-m9xa-2rht', entries }), db, false);
    expect(saved.status).toBe(204);
    // La base guarda la huella, nunca el código.
    expect([...rows.keys()]).toEqual([await profileId(CODE)]);
    expect([...rows.keys()][0]).not.toContain(CODE);

    const read = await handleProfile(post({ code: CODE }, '/api/perfil/leer'), db, true);
    expect(read.status).toBe(200);
    expect(((await read.json()) as { entries: unknown }).entries).toEqual(entries);
  });

  it('un código que no existe da 404', async () => {
    const { db } = fakeDb();
    const read = await handleProfile(post({ code: CODE }), db, true);
    expect(read.status).toBe(404);
  });

  it('rechaza códigos inválidos y claves que no son del juego', async () => {
    const { db, rows } = fakeDb();
    expect((await handleProfile(post({ code: 'ABC', entries: {} }), db, false)).status).toBe(400);
    expect(
      (await handleProfile(post({ code: 'O0O0O0O0O0O0', entries: {} }), db, false)).status,
    ).toBe(400);
    const foreign = { code: CODE, entries: { 'otra.cosa': 'x' } };
    expect((await handleProfile(post(foreign), db, false)).status).toBe(400);
    expect((await handleProfile(post('no es json'), db, false)).status).toBe(400);
    expect(rows.size).toBe(0);
  });

  it('rechaza un respaldo demasiado grande', async () => {
    const { db } = fakeDb();
    const entries = { 'crisol.grande': 'x'.repeat(70_000) };
    expect((await handleProfile(post({ code: CODE, entries }), db, false)).status).toBe(400);
  });

  it('sin base (desarrollo) responde 503 en vez de fallar', async () => {
    expect((await handleProfile(post({ code: CODE }), undefined, true)).status).toBe(503);
  });
});
