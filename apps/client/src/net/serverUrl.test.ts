import { roomServerOf } from '@crisol/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** El módulo como en el juego publicado (no en desarrollo), con Santiago contestando así. */
async function load(health: 'ok' | 'full' | 'down') {
  vi.resetModules();
  vi.stubEnv('DEV', false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (health === 'down') throw new Error('sin respuesta');
      return new Response(JSON.stringify({ ok: true, full: health === 'full' }));
    }),
  );
  return import('./serverUrl');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('respaldo de salas en Cloudflare', () => {
  it('con Santiago bien, las salas nuevas y los códigos con letra van a Santiago', async () => {
    const urls = await load('ok');
    expect(await urls.newRoomServer()).toBe('main');
    await urls.chooseRoomServer('K7QF');
    expect(urls.roomSocketUrl('K7QF')).toContain('sslip.io');
    expect((await urls.quickMatchUrls())[0]).toContain('sslip.io');
  });

  it('un código con número va siempre a Cloudflare', async () => {
    const urls = await load('ok');
    await urls.chooseRoomServer('7KQF');
    expect(roomServerOf('7KQF')).toBe('fallback');
    expect(urls.roomSocketUrl('7KQF')).toContain('workers.dev');
  });

  it('con Santiago lleno, las salas nuevas van a Cloudflare pero se puede entrar a las suyas', async () => {
    const urls = await load('full');
    expect(await urls.newRoomServer()).toBe('fallback');
    // La Partida rápida igual pregunta a Santiago: puede tener una sala esperando gente.
    expect((await urls.quickMatchUrls())[1]).toContain('workers.dev');
    await urls.chooseRoomServer('K7QF');
    expect(urls.roomSocketUrl('K7QF')).toContain('sslip.io');
  });

  it('con Santiago caído, todo va a Cloudflare y la sala se queda ahí al reconectar', async () => {
    const urls = await load('down');
    expect(await urls.newRoomServer()).toBe('fallback');
    await urls.chooseRoomServer('K7QF');
    expect(urls.roomSocketUrl('K7QF')).toContain('workers.dev');
    expect(urls.roomsServerName('K7QF')).toBe('Cloudflare');
    expect(await urls.quickMatchUrls()).toEqual([expect.stringContaining('workers.dev')]);
  });
});
