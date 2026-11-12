/**
 * La prueba con amigos, sin amigos: 6 celulares sin pantalla, cada uno en su proceso y con el
 * código de red real del juego, juegan una sala de todos contra todos contra una Sala de verdad
 * (`pnpm dev:server`). Cada uno tiene lag y paquetes perdidos; quien crea la sala tiene mala
 * señal, y durante la partida se van a WhatsApp, pierden la señal o recargan la página.
 * No corre en CI: se lanza con
 *
 *   SALA=http://127.0.0.1:8787 pnpm exec vitest run --config apps/client/red/vitest.config.ts
 *
 * Variables: LAG (ms de ida y vuelta, 300), PERDIDA (%, 5), SEGUNDOS (de partida, 150) y REPORTE
 * (archivo donde dejar el resultado en JSON).
 *
 * Mide, tras cada problema, cuánto tarda el celular en volver a jugar su mago, y falla si alguno
 * no vuelve, ve un error que corta la partida o queda en manos de la IA al final.
 */
import { type ChildProcess, fork } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test } from 'vitest';
import type { PhoneCommand, PhoneStatus } from './celular';

const BASE = process.env.SALA ?? '';
const LAG = Number(process.env.LAG ?? 300);
const LOSS = Number(process.env.PERDIDA ?? 5);
const SECONDS = Number(process.env.SEGUNDOS ?? 150);
/** Tras un problema, el celular debe volver a jugar su mago antes de esto. */
const RECOVERY_LIMIT_MS = 12_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Phone {
  readonly name: string;
  readonly storage: string;
  readonly search: string;
  child: ChildProcess;
  status: PhoneStatus | null;
}

interface Incident {
  readonly phone: string;
  readonly what: string;
  /** Cuándo terminó el problema (volvió a la app o volvió la señal). */
  readonly endsAt: number;
  recoveredMs: number | null;
}

test.skipIf(!BASE)(
  'seis celulares con mala red vuelven siempre a su mago',
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crisol-celulares-'));
    process.env.VITE_SERVER_URL = BASE;
    await build({
      configFile: false,
      logLevel: 'warn',
      root: join(import.meta.dirname, '..'),
      build: {
        ssr: join(import.meta.dirname, 'celular.ts'),
        outDir: dir,
        target: 'node22',
        minify: false,
        rollupOptions: { output: { entryFileNames: 'celular.mjs' } },
      },
      ssr: { noExternal: true },
    });
    const bundle = join(dir, 'celular.mjs');

    const created = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
    const { roomCode } = (await created.json()) as { roomCode: string };

    const spawn = (phone: Omit<Phone, 'child' | 'status'>): Phone => {
      const child = fork(bundle, [], {
        env: {
          ...process.env,
          NOMBRE: phone.name,
          CODIGO: roomCode,
          ALMACEN: phone.storage,
          DIRECCION: phone.search,
        },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      const full: Phone = { ...phone, child, status: null };
      child.on('message', (m) => {
        full.status = (m as { status: PhoneStatus }).status;
      });
      return full;
    };
    const tell = (phone: Phone, command: PhoneCommand) => phone.child.send(command);

    // Quien crea la sala tiene la peor señal del grupo, como en el de Tomás.
    const specs = Array.from({ length: 6 }, (_, i) => ({
      name: `Amigo${i + 1}`,
      storage: join(dir, `almacen${i + 1}.json`),
      search:
        i === 0
          ? `?lag=${Math.round(LAG * 2.5)}&perdida=${Math.min(20, LOSS * 3)}`
          : `?lag=${Math.round(LAG * (0.5 + (i % 3) * 0.25))}&perdida=${LOSS}`,
    }));
    const phones: Phone[] = [spawn(specs[0] as Phone)];
    const host = phones[0] as Phone;
    const incidents: Incident[] = [];
    const t0 = Date.now();
    const log = (text: string) =>
      process.stderr.write(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${text}\n`);
    const incident = (phone: Phone, what: string, ms: number) => {
      log(`${phone.name}: ${what}`);
      incidents.push({ phone: phone.name, what, endsAt: Date.now() + ms, recoveredMs: null });
    };

    // Revisa cada cuarto de segundo quién volvió a jugar tras su problema.
    const watcher = setInterval(() => {
      const now = Date.now();
      for (const inc of incidents) {
        if (inc.recoveredMs !== null || now < inc.endsAt) continue;
        const s = phones.find((p) => p.name === inc.phone)?.status;
        if (!s?.present || s.lastHeardAt <= inc.endsAt) continue;
        if (!s.started) inc.recoveredMs = s.lastHeardAt - inc.endsAt;
        else if (s.lastFrameAt > inc.endsAt) inc.recoveredMs = s.lastFrameAt - inc.endsAt;
      }
    }, 250);

    // Sala de espera: quien la crea entra, se va a WhatsApp a mandar el enlace (iOS le corta la
    // conexión) y los amigos van llegando mientras tanto.
    await sleep(2500);
    tell(host, {
      cmd: 'settings',
      settings: {
        mode: { kind: 'ffa', players: 6 },
        minutes: 1,
        bestOf: 3,
        glyphs: true,
        omen: true,
        lives: false,
        botLevel: 'duelist',
      },
    });
    await sleep(1500);
    tell(host, { cmd: 'background', ms: 9000, kill: true });
    incident(host, 'se va a WhatsApp en la sala de espera', 9000);
    for (const spec of specs.slice(1)) {
      await sleep(1200);
      phones.push(spawn(spec));
    }
    await sleep(6000);
    const [, p2, p3, p4, p5, p6] = phones as [Phone, Phone, Phone, Phone, Phone, Phone];
    const hostIdAfterLobby = host.status?.hostId;
    const hostIsBoss = host.status?.playerId === host.status?.hostId;
    log(`en la sala: anfitrión ${host.status?.playerId}, manda ${hostIdAfterLobby}`);
    // Quien manda toca "Empezar" (y lo vuelve a tocar si no pasó nada, como cualquiera).
    for (let tries = 0; tries < 10 && !phones.every((p) => p.status?.started); tries++) {
      const boss = phones.find((p) => p.status?.playerId === p.status?.hostId) ?? host;
      tell(boss, { cmd: 'begin' });
      await sleep(3000);
    }
    const beganAfter = (Date.now() - t0) / 1000;
    log(`empezó la partida`);

    // Partida: cada uno tiene su problema, repartidos en el tiempo.
    const plan: [number, () => void][] = [
      [
        10,
        () => {
          tell(p2, { cmd: 'signal', ms: 10_000, announce: false });
          incident(p2, 'pierde la señal 10 s (túnel)', 10_000);
        },
      ],
      [
        25,
        () => {
          tell(p3, { cmd: 'background', ms: 15_000, kill: true });
          incident(p3, 'WhatsApp 15 s, iOS le corta la conexión', 15_000);
        },
      ],
      [
        35,
        () => {
          tell(p4, { cmd: 'background', ms: 5000, kill: false });
          incident(p4, 'WhatsApp 5 s, la conexión sigue viva', 5000);
        },
      ],
      [
        50,
        () => {
          // Recarga la página en plena partida: el proceso muere y vuelve con su almacenamiento.
          p5.child.kill('SIGKILL');
          incident(p5, 'recarga la página', 2000);
          setTimeout(() => {
            const again = spawn({ name: p5.name, storage: p5.storage, search: p5.search });
            p5.child = again.child;
            again.child.on('message', (m) => {
              p5.status = (m as { status: PhoneStatus }).status;
            });
          }, 2000);
        },
      ],
      [
        65,
        () => {
          tell(host, { cmd: 'signal', ms: 8000, announce: false });
          incident(host, 'anfitrión pierde la señal 8 s', 8000);
        },
      ],
      [
        80,
        () => {
          tell(p6, { cmd: 'signal', ms: 2500, announce: false });
          incident(p6, 'señal intermitente (1/3)', 2500);
        },
      ],
      [
        86,
        () => {
          tell(p6, { cmd: 'signal', ms: 2500, announce: false });
          incident(p6, 'señal intermitente (2/3)', 2500);
        },
      ],
      [
        92,
        () => {
          tell(p6, { cmd: 'signal', ms: 2500, announce: false });
          incident(p6, 'señal intermitente (3/3)', 2500);
        },
      ],
      [
        100,
        () => {
          tell(p2, { cmd: 'background', ms: 40_000, kill: true });
          incident(p2, 'WhatsApp 40 s, iOS le corta la conexión', 40_000);
        },
      ],
      [
        110,
        () => {
          tell(p3, { cmd: 'signal', ms: 30_000, announce: true });
          incident(p3, 'sin señal 30 s', 30_000);
        },
      ],
    ];
    const start = Date.now();
    for (const [at, run] of plan) {
      if (at > SECONDS) break;
      await sleep(Math.max(0, start + at * 1000 - Date.now()));
      run();
    }
    await sleep(Math.max(0, start + SECONDS * 1000 - Date.now()));
    await sleep(RECOVERY_LIMIT_MS);
    clearInterval(watcher);

    const report = phones.map((p) => ({
      nombre: p.name,
      id: p.status?.playerId,
      presente: p.status?.present,
      etapa: p.status?.stage,
      sinEstadoMs: p.status ? Date.now() - p.status.lastFrameAt : null,
      cortes: p.status?.stalls,
      avisos: [...new Set(p.status?.problems ?? [])].join(' | '),
      fatal: p.status?.fatal,
      empezo: p.status?.started,
      paso: p.status?.tick,
    }));
    console.table(report);
    console.table(
      incidents.map((i) => ({ celular: i.phone, problema: i.what, vuelveEnMs: i.recoveredMs })),
    );
    if (process.env.REPORTE) {
      writeFileSync(process.env.REPORTE, JSON.stringify({ report, incidents }, null, 1));
    }
    for (const p of phones) p.child.kill();
    rmSync(dir, { recursive: true, force: true });

    expect({ hostIsBoss, hostIdAfterLobby }).toMatchObject({ hostIsBoss: true });
    expect(beganAfter).toBeLessThan(40);
    expect(report.filter((r) => r.fatal)).toEqual([]);
    expect(report.filter((r) => !r.presente)).toEqual([]);
    expect(
      incidents.filter((i) => i.recoveredMs === null || i.recoveredMs > RECOVERY_LIMIT_MS),
    ).toEqual([]);
  },
  900_000,
);
