/**
 * El canal que no espera (WebRTC), probado en navegadores de verdad: dos Chromium sin pantalla
 * juegan contra una Sala de Santiago local que pierde a propósito parte de los estados por el
 * canal. No corre en CI (necesita Playwright). Se lanza con la Sala así:
 *
 *   SALA_IP=127.0.0.1 SALA_RTC_PERDIDA=0.15 PORT=8090 pnpm --filter @crisol/server sala
 *   SALA_RAPIDA=http://127.0.0.1:8090 pnpm exec vitest run --config apps/client/red/vitest.config.ts canal
 *
 * Falla si el canal no abre, si los estados no van por él o si el juego se traba: con un 15% de
 * estados perdidos, ningún hueco entre pasos mostrados debe pasar de lo que cubre el colchón.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test } from 'vitest';

const BASE = process.env.SALA_RAPIDA ?? '';
const SECONDS = Number(process.env.SEGUNDOS ?? 40);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PageStatus {
  playerId: number;
  hostId: number;
  started: boolean;
  stage: string;
  stalls: number;
  worstGapMs: number;
  events: number;
  problems: string[];
  summary: string[];
}

test.skipIf(!BASE)(
  'el canal que no espera abre y aguanta estados perdidos sin trabarse',
  { timeout: 180_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crisol-canal-'));
    process.env.VITE_SERVER_URL = BASE;
    await build({
      configFile: false,
      logLevel: 'warn',
      root: join(import.meta.dirname, '..'),
      build: {
        outDir: dir,
        minify: false,
        lib: { entry: join(import.meta.dirname, 'pagina.ts'), formats: ['es'], fileName: 'pagina' },
      },
    });
    const script = readFileSync(join(dir, 'pagina.js'), 'utf8');
    const { chromium } = createRequire(import.meta.url)(
      'playwright',
    ) as typeof import('playwright');
    const browser = await chromium.launch({
      // Para llegar a la Sala local (127.0.0.1) desde la página.
      args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'],
    });
    try {
      const created = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
      const { roomCode } = (await created.json()) as { roomCode: string };
      const pages = await Promise.all(
        ['Ana', 'Beto'].map(async (name) => {
          const page = await browser.newPage();
          page.on('console', (m) => console.log(`[${name}] ${m.text()}`));
          page.on('pageerror', (e) => console.log(`[${name}] error: ${e.message}`));
          await page.setContent('<!doctype html><title>celular</title>');
          await page.addScriptTag({ content: script, type: 'module' });
          await page.evaluate(
            ([code, who]) => {
              window.crisol.match = window.crisol.start(code as string, who as string);
            },
            [roomCode, name],
          );
          return page;
        }),
      );
      const statusOf = (i: number) =>
        pages[i]?.evaluate(() => window.crisol.status) as Promise<PageStatus>;
      await sleep(2000);
      for (let tries = 0; tries < 10; tries++) {
        const all = await Promise.all(pages.map((_, i) => statusOf(i)));
        if (all.every((s) => s.started)) break;
        const boss = all.findIndex((s) => s.playerId === s.hostId);
        await pages[Math.max(0, boss)]?.evaluate(() => window.crisol.match?.begin());
        await sleep(1500);
      }
      await sleep(SECONDS * 1000);
      const all = await Promise.all(pages.map((_, i) => statusOf(i)));
      for (const [i, s] of all.entries()) {
        console.log(`celular ${i}:`, JSON.stringify(s, null, 1));
        expect(s.started).toBe(true);
        const line = s.summary.find((l) => l.startsWith('Canal rápido')) ?? '';
        expect(line).toMatch(/abrió en/);
        const share = Number(/(\d+)% de los estados/.exec(line)?.[1] ?? 0);
        expect(share).toBeGreaterThan(90);
        expect(s.events).toBeGreaterThan(0);
        expect(s.worstGapMs).toBeLessThan(400);
      }
    } finally {
      await browser.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
