/**
 * Un celular sin pantalla: el código de red real del juego (`NetMatch`, con su colchón,
 * predicción, reconexión y simulador de lag) manejado por la IA del núcleo en vez de un dedo.
 * Lo lanza `celulares.test.ts`, uno por proceso, y obedece lo que le manda: salir de la app,
 * perder la señal, empezar la partida. Cada segundo cuenta cómo le va.
 */

import { cleanLook, GLYPHS } from '@crisol/content';
import { BotController, type Controller, type Intent, TICK_MS } from '@crisol/core';
import type { NetListener } from '../src/net/NetMatch';
import { NetMatch } from '../src/net/NetMatch';
import { killSockets, setHidden, signalBack, signalLost } from './entorno';

/** Lo que el celular le cuenta a la prueba. */
export interface PhoneStatus {
  readonly playerId: number;
  readonly hostId: number;
  /** La Sala lo ve conectado y con la app a la vista (no juega la IA por él). */
  readonly present: boolean;
  readonly started: boolean;
  readonly stage: string;
  /** Hace cuánto llegó el último estado, según el reloj de la prueba (`Date.now()`). */
  readonly lastFrameAt: number;
  readonly stalls: number;
  readonly problems: readonly string[];
  readonly fatal: string;
  readonly settingsMode: string;
  readonly tick: number;
  /** Cuándo llegó el último mensaje de la Sala, de cualquier tipo. */
  readonly lastHeardAt: number;
}

/** Lo que la prueba le pide al celular. */
export type PhoneCommand =
  | { readonly cmd: 'settings'; readonly settings: unknown }
  | { readonly cmd: 'begin' }
  | { readonly cmd: 'background'; readonly ms: number; readonly kill: boolean }
  | { readonly cmd: 'signal'; readonly ms: number; readonly announce: boolean }
  | { readonly cmd: 'quit' };

const NAME = process.env.NOMBRE ?? 'Amigo';
const CODE = process.env.CODIGO ?? '';

let bot: BotController | null = null;
// Como el dedo de verdad, manda dónde camina en cada paso aunque la IA no quiera hacer nada (por
// ejemplo, con su mago caído): si no, la Sala lo daría por callado.
const human: Controller = {
  intentsFor: (state, self): readonly Intent[] => {
    const intents = [...(bot?.intentsFor(state, self) ?? [])];
    if (!intents.some((i) => i.kind === 'move')) intents.unshift({ kind: 'move', x: 0, z: 0 });
    return intents;
  },
};
const problems: string[] = [];
let fatal = '';
let present = false;
let lastFrameAt = 0;
let lastTick = -1;
let chose = -1;
let rematchAt = 0;

const listener: NetListener = {
  players: (players, me) => {
    const mine = players.find((p) => p.id === me);
    present = !!mine && mine.connected && !mine.away;
  },
  start: (started) => {
    bot = new BotController((Math.random() * 2 ** 31) >>> 0, started.rules);
  },
  problem: (reason, isFatal) => {
    problems.push(reason);
    if (isFatal) fatal = reason;
  },
  notice: () => {},
  stats: () => {},
};

const match = new NetMatch(
  CODE,
  { name: NAME, look: cleanLook(undefined), affinity: null },
  human,
  listener,
);

// La pantalla: 30 pasos por segundo con la app a la vista (afuera, el navegador la congela).
setInterval(() => {
  if (document.hidden) return;
  match.step();
  if (match.state.tick !== lastTick) {
    lastTick = match.state.tick;
    lastFrameAt = Date.now();
  }
  const stage = match.stage;
  if (stage.kind === 'choosing' && chose !== match.series.roundsPlayed) {
    chose = match.series.roundsPlayed;
    const pick = stage.options[Math.floor(Math.random() * stage.options.length)] ?? GLYPHS[0];
    if (pick) setTimeout(() => match.chooseGlyph(pick), 1000 + Math.random() * 4000);
  }
  if (stage.kind === 'finished' && !match.rematchAsked) {
    if (rematchAt === 0) rematchAt = Date.now() + 2000 + Math.random() * 4000;
    else if (Date.now() > rematchAt) {
      rematchAt = 0;
      match.requestRematch();
    }
  }
}, TICK_MS);

setInterval(() => {
  const status: PhoneStatus = {
    playerId: match.playerId,
    hostId: match.hostId,
    present,
    started: match.started,
    stage: match.stage.kind,
    lastFrameAt,
    stalls: (match as unknown as { stalls: number }).stalls,
    problems,
    fatal,
    settingsMode: JSON.stringify(match.settings.mode),
    tick: match.state.tick,
    lastHeardAt:
      Date.now() - (performance.now() - (match as unknown as { lastHeard: number }).lastHeard),
  };
  process.send?.({ status });
}, 250);

process.on('message', (raw) => {
  const message = raw as PhoneCommand;
  switch (message.cmd) {
    case 'settings':
      match.configure(message.settings as never);
      return;
    case 'begin':
      match.begin();
      return;
    case 'background':
      setHidden(true);
      // iOS suele matar la conexión al rato de salir; Android a veces la deja viva.
      if (message.kill) setTimeout(killSockets, 1000);
      setTimeout(() => setHidden(false), message.ms);
      return;
    case 'signal':
      signalLost();
      setTimeout(() => signalBack(message.announce), message.ms);
      return;
    case 'quit':
      match.close();
      process.exit(0);
  }
});
