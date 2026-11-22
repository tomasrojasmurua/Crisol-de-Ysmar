/**
 * Un celular en un navegador de verdad (Chromium sin pantalla), con el código de red real del
 * juego y la IA del núcleo en vez de un dedo. Lo usa `canal.test.ts` para probar el canal que no
 * espera (WebRTC), que en Node no existe. Expone en `window.crisol` cómo le va.
 */
import { cleanLook, GLYPHS } from '@crisol/content';
import { BotController, type Controller, type Intent, TICK_MS } from '@crisol/core';
import { NetMatch } from '../src/net/NetMatch';

interface PageStatus {
  playerId: number;
  hostId: number;
  started: boolean;
  stage: string;
  tick: number;
  /** Pasos que el juego mostró sin estado nuevo (el colchón vacío). */
  stalls: number;
  /** El salto más largo entre dos pasos nuevos mostrados, en ms (desde los 5 s de ronda). */
  worstGapMs: number;
  /** Eventos que vio el juego (golpes, sonidos…). */
  events: number;
  problems: string[];
  summary: string[];
}

const status: PageStatus = {
  playerId: -1,
  hostId: -1,
  started: false,
  stage: '',
  tick: -1,
  stalls: 0,
  worstGapMs: 0,
  events: 0,
  problems: [],
  summary: [],
};

function start(code: string, name: string): NetMatch {
  let bot: BotController | null = null;
  const human: Controller = {
    intentsFor: (state, self): readonly Intent[] => {
      const intents = [...(bot?.intentsFor(state, self) ?? [])];
      if (!intents.some((i) => i.kind === 'move')) intents.unshift({ kind: 'move', x: 0, z: 0 });
      return intents;
    },
  };
  const match = new NetMatch(code, { name, look: cleanLook(undefined), affinity: null }, human, {
    players: () => {},
    start: (started) => {
      bot = new BotController((Math.random() * 2 ** 31) >>> 0, started.rules);
    },
    problem: (reason) => status.problems.push(reason),
    notice: () => {},
    stats: () => {},
  });
  let chose = -1;
  let lastNewAt = 0;
  setInterval(() => {
    const events = match.step();
    status.events += events.length;
    const now = performance.now();
    if (match.state.tick !== status.tick) {
      // Desde los 5 s de ronda: al empezar, el reloj de la ronda espera la cuenta regresiva.
      if (lastNewAt > 0 && match.stage.kind === 'playing' && match.state.tick > 150) {
        status.worstGapMs = Math.max(status.worstGapMs, now - lastNewAt);
      }
      lastNewAt = now;
      status.tick = match.state.tick;
    }
    const stage = match.stage;
    if (stage.kind === 'choosing' && chose !== match.series.roundsPlayed) {
      chose = match.series.roundsPlayed;
      const pick = stage.options[0] ?? GLYPHS[0];
      if (pick) setTimeout(() => match.chooseGlyph(pick), 500);
    }
    status.playerId = match.playerId;
    status.hostId = match.hostId;
    status.started = match.started;
    status.stage = stage.kind;
    status.stalls = (match as unknown as { stalls: number }).stalls;
    status.summary = match.networkSummary();
  }, TICK_MS);
  return match;
}

declare global {
  interface Window {
    crisol: { start: typeof start; status: PageStatus; match: NetMatch | null };
  }
}

window.crisol = { start, status, match: null };
