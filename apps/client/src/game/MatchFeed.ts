import { REACTION_TEXT } from '@crisol/content';
import { type GameEvent, type MatchState, TICK_RATE } from '@crisol/core';
import type { FeedLine } from '../ui/Hud';

/** Cuánto puede pasar entre dos derribos de un mismo mago para que cuenten como doble o triple. */
const STREAK_TICKS = 5 * TICK_RATE;

const STREAK_NAMES = ['', '', 'Doble', 'Triple', 'Cuádruple', 'Quíntuple'];

export interface FeedNames {
  readonly playerId: number;
  readonly nameOf: (id: number) => string;
}

/**
 * Arma los avisos de la partida a partir de los eventos de cada paso: quién derribó a quién,
 * dobles derribos, quién quedó último en pie, quién levantó a quién y las reacciones ajenas (las
 * tuyas ya salen grandes sobre el blanco). Todo sale de eventos que ya llegan a cada celular.
 */
export class MatchFeed {
  private readonly streaks = new Map<number, { count: number; tick: number }>();
  private readonly lastStanding = new Set<number>();

  /** Una ronda nueva: las rachas y los "último en pie" vuelven a cero. */
  reset(): void {
    this.streaks.clear();
    this.lastStanding.clear();
  }

  onStep(events: readonly GameEvent[], state: MatchState, names: FeedNames): FeedLine[] {
    const lines: FeedLine[] = [];
    const me = names.playerId;
    const teamOf = (id: number): number | undefined => state.wizards.find((w) => w.id === id)?.team;
    const myTeam = teamOf(me);
    const isWizard = (id: number): boolean => teamOf(id) !== undefined;
    const rivals = (a: number, b: number): boolean => {
      const ta = teamOf(a);
      const tb = teamOf(b);
      return ta !== undefined && tb !== undefined && ta !== tb;
    };
    const who = (id: number): string => (id === me ? 'Tú' : names.nameOf(id));
    const whom = (id: number): string => (id === me ? 'ti' : names.nameOf(id));
    const toneOf = (actor: number, target: number): FeedLine['tone'] => {
      if (teamOf(actor) === myTeam) return 'own';
      if (teamOf(target) === myTeam) return 'foe';
      return 'neutral';
    };

    // El último golpe del paso a cada mago dice quién lo derribó (como la mejor jugada).
    const lastHit = new Map<number, Extract<GameEvent, { type: 'hit' }>>();
    let anyFall = false;
    for (const event of events) {
      if (event.type === 'hit') {
        lastHit.set(event.targetId, event);
      } else if (event.type === 'defeated') {
        anyFall = true;
        const victim = event.wizardId;
        const hit = lastHit.get(victim);
        if (
          hit &&
          hit.form !== 'zone' &&
          hit.form !== 'beast' &&
          isWizard(hit.sourceId) &&
          rivals(hit.sourceId, victim)
        ) {
          const killer = hit.sourceId;
          const verb = killer === me ? 'derribaste a' : 'derribó a';
          lines.push({
            text: `${who(killer)} ${verb} ${whom(victim)}`,
            tone: toneOf(killer, victim),
            big: false,
          });
          const streak = this.streaks.get(killer);
          const count = streak && state.tick - streak.tick <= STREAK_TICKS ? streak.count + 1 : 1;
          this.streaks.set(killer, { count, tick: state.tick });
          if (count >= 2) {
            const name = STREAK_NAMES[Math.min(count, STREAK_NAMES.length - 1)] ?? 'Doble';
            lines.push({
              text: `¡${name} derribo${killer === me ? '!' : ` de ${names.nameOf(killer)}!`}`,
              tone: teamOf(killer) === myTeam ? 'own' : 'foe',
              big: true,
            });
          }
        } else {
          const cause =
            hit?.form === 'zone' ? ' en la zona' : hit?.form === 'beast' ? ' ante una bestia' : '';
          const verb = victim === me ? 'Caíste' : `Cayó ${names.nameOf(victim)}`;
          lines.push({
            text: `${verb}${cause}`,
            tone: teamOf(victim) === myTeam ? 'foe' : 'neutral',
            big: false,
          });
        }
      } else if (event.type === 'revived') {
        lines.push({
          text: `${who(event.byId)} ${event.byId === me ? 'levantaste a' : 'levantó a'} ${whom(event.wizardId)}`,
          tone: teamOf(event.byId) === myTeam ? 'own' : 'neutral',
          big: false,
        });
      } else if (event.type === 'combo' && event.sourceId !== me) {
        if (!isWizard(event.sourceId) || !rivals(event.sourceId, event.targetId)) continue;
        lines.push({
          text: `${names.nameOf(event.sourceId)} · ${REACTION_TEXT[event.combo].name} sobre ${whom(event.targetId)}`,
          tone: toneOf(event.sourceId, event.targetId),
          big: false,
        });
      }
    }
    // Con Vidas, caer no es quedar fuera: "último en pie" solo tiene sentido sin ellas.
    if (anyFall && state.deathRule === 'out')
      lines.push(...this.checkLastStanding(state, me, myTeam, names));
    return lines;
  }

  /** En equipos de dos o más: avisa una vez por ronda cuando a un equipo le queda un solo mago. */
  private checkLastStanding(
    state: MatchState,
    me: number,
    myTeam: number | undefined,
    names: FeedNames,
  ): FeedLine[] {
    const lines: FeedLine[] = [];
    const teams = new Map<number, { total: number; up: number[] }>();
    for (const w of state.wizards) {
      const team = teams.get(w.team) ?? { total: 0, up: [] };
      team.total++;
      if (w.fallen === null) team.up.push(w.id);
      teams.set(w.team, team);
    }
    // Si ya queda un solo equipo en pie, la ronda terminó: lo dice el aviso de fin de ronda.
    const standing = [...teams.values()].filter((t) => t.up.length > 0).length;
    if (standing < 2) return lines;
    for (const [team, { total, up }] of teams) {
      const last = up[0];
      if (total < 2 || up.length !== 1 || last === undefined || this.lastStanding.has(team))
        continue;
      this.lastStanding.add(team);
      lines.push({
        text:
          last === me
            ? 'Eres el último en pie de tu equipo'
            : `${names.nameOf(last)} es el último en pie${team === myTeam ? ' de tu equipo' : ''}`,
        tone: team === myTeam ? 'own' : 'neutral',
        big: true,
      });
    }
    return lines;
  }
}
