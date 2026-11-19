import type { Highlight, MatchState } from '@crisol/core';

/** Un paso guardado para la repetición: el estado y a quién no veías en él. */
export interface ReplayFrame {
  readonly state: MatchState;
  /** En red, los rivales que la Sala no te mostraba (llegan quietos y sin tejido). */
  readonly hidden: readonly number[];
}

/** Lo que se repite al final: los pasos y qué jugada son (null: el desenlace de la partida). */
export interface ReplayClip {
  readonly highlight: Highlight | null;
  readonly frames: readonly ReplayFrame[];
}

/** Pasos que se guardan: una jugada larga (5 s), la pausa que la cierra (2 s) y lo de antes. */
export const REPLAY_CAPACITY = 330;
/** La repetición empieza 1,5 s antes del primer golpe y termina 1,5 s después del último. */
export const REPLAY_LEAD_TICKS = 45;
export const REPLAY_TAIL_TICKS = 45;
/** Sin la mejor jugada guardada, se repiten los últimos 5 s de la partida. */
export const ENDING_TICKS = 150;
/** Menos que esto no alcanza a contar nada. */
const MIN_FRAMES = 20;

/**
 * Guarda los últimos ~10 s de la partida y, cuando la Sala (o la partida contra la IA) dice que
 * hay una mejor jugada nueva, aparta sus pasos. Solo guarda referencias: en red cada estado
 * llega nuevo y nadie lo modifica, así que no copia nada. Contra la IA, la partida copia el
 * estado antes de pasarlo (ver `LocalMatch`).
 */
export class ReplayRecorder {
  private readonly ring: (ReplayFrame | undefined)[] = new Array(REPLAY_CAPACITY);
  private next = 0;
  private size = 0;
  private best: ReplayClip | null = null;
  private offered: Highlight | null = null;

  /** Una partida nueva (o revancha): se olvida todo. */
  reset(): void {
    this.ring.fill(undefined);
    this.next = 0;
    this.size = 0;
    this.best = null;
    this.offered = null;
  }

  /** Un paso nuevo. Si el reloj vuelve atrás es otra ronda: lo de la anterior ya no sirve. */
  push(frame: ReplayFrame): void {
    const last = this.last();
    if (last && frame.state.tick === last.state.tick) return;
    if (last && frame.state.tick < last.state.tick) {
      this.ring.fill(undefined);
      this.size = 0;
    }
    this.ring[this.next] = frame;
    this.next = (this.next + 1) % REPLAY_CAPACITY;
    this.size = Math.min(REPLAY_CAPACITY, this.size + 1);
  }

  /**
   * La mejor jugada de la partida hasta ahora. Si es nueva, se apartan sus pasos; si ya no
   * están (estuviste fuera de la app), no queda repetición de esa jugada.
   */
  offer(best: Highlight | null): void {
    if (best === null || sameHighlight(best, this.offered)) return;
    this.offered = best;
    const from = best.endTick - best.ticks - REPLAY_LEAD_TICKS;
    const to = best.endTick + REPLAY_TAIL_TICKS;
    const frames = this.frames().filter((f) => f.state.tick >= from && f.state.tick <= to);
    const first = frames[0];
    const covered =
      first !== undefined &&
      first.state.tick <= best.endTick - best.ticks &&
      frames.length >= MIN_FRAMES;
    this.best = covered ? { highlight: best, frames } : null;
  }

  /** Lo que se repite al final: la mejor jugada o, si no se pudo guardar, el desenlace. */
  clip(): ReplayClip | null {
    if (this.best) return this.best;
    const frames = this.frames().slice(-ENDING_TICKS);
    return frames.length >= MIN_FRAMES ? { highlight: null, frames } : null;
  }

  private last(): ReplayFrame | undefined {
    return this.size === 0
      ? undefined
      : this.ring[(this.next - 1 + REPLAY_CAPACITY) % REPLAY_CAPACITY];
  }

  /** Los pasos guardados, del más viejo al más nuevo. */
  private frames(): ReplayFrame[] {
    const out: ReplayFrame[] = [];
    for (let i = this.size; i > 0; i--) {
      const frame = this.ring[(this.next - i + REPLAY_CAPACITY) % REPLAY_CAPACITY];
      if (frame) out.push(frame);
    }
    return out;
  }
}

/**
 * Una copia del estado para la repetición contra la IA, donde la simulación lo cambia en su
 * lugar. Copia a mano lo que cambia (las bestias son muchas y planas) y comparte lo que no: los
 * avisos del paso son nuevos en cada paso. Con el procesador 4 veces más lento, 0,1 ms por paso
 * contra 0,5 ms de copiarlo entero con `structuredClone`.
 */
export function snapshotState(state: MatchState): MatchState {
  return {
    ...state,
    wizards: structuredClone(state.wizards),
    spells: structuredClone(state.spells),
    beasts: state.beasts.map((beast) => ({
      ...beast,
      pos: { ...beast.pos },
      facing: { ...beast.facing },
      velocity: { ...beast.velocity },
    })),
    campRespawn: state.campRespawn.slice(),
    burnedTrees: state.burnedTrees.slice(),
    shrines: state.shrines.map((shrine) => ({ ...shrine })),
  };
}

/** La misma jugada aunque llegue en otro objeto (en red, cada estado se arma de nuevo). */
function sameHighlight(a: Highlight, b: Highlight | null): boolean {
  return (
    b !== null &&
    a.round === b.round &&
    a.wizardId === b.wizardId &&
    a.endTick === b.endTick &&
    a.score === b.score
  );
}
