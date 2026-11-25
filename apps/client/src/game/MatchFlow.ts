import { type Combo, ELEMENTS, NO_OMEN, spellName } from '@crisol/content';
import {
  type ElementId,
  favoriteSpell,
  type GameEvent,
  type GameRules,
  type Highlight,
  SPELL_WEAVES,
  spellOf,
  TICK_RATE,
  type Weave,
} from '@crisol/core';
import type { GameAudio } from '../audio/GameAudio';
import type { TouchControls } from '../input/TouchControls';
import { reportProblem } from '../platform/ErrorReporter';
import { sendMatchLog } from '../platform/matchLog';
import type { GameScene } from '../render/GameScene';
import type { ComboCallouts } from '../ui/ComboCallouts';
import { comboStepsView } from '../ui/comboSteps';
import type { GlyphPicker } from '../ui/GlyphPicker';
import { weaveOrbs } from '../ui/GrimoireBook';
import type { HighlightView } from '../ui/HighlightCard';
import type { Hud, WizardBadge } from '../ui/Hud';
import { intentTag } from '../ui/intentTag';
import type { Minimap } from '../ui/Minimap';
import type {
  Outcome,
  ResultGrimoire,
  ResultPath,
  ResultPlayer,
  ResultTeam,
} from '../ui/ResultScreen';
import { ComboDetector } from './ComboDetector';
import { ComboLog } from './ComboLog';
import type { Diagnostics } from './Diagnostics';
import type { Grimoire } from './Grimoire';
import { highlightView } from './highlightView';
import { LastBlow } from './LastBlow';
import { MatchFeed } from './MatchFeed';
import { MatchMoments } from './MatchMoments';
import type { MatchRenderer } from './MatchRenderer';
import type { MatchView } from './MatchView';
import { masterQuote } from './masterLine';
import type { ModeGroup, PlayerStats } from './PlayerStats';
import type { ReplayClip } from './ReplayRecorder';
import { TrainingMatch } from './TrainingMatch';

const elementName = (element: string): string =>
  ELEMENTS.find((e) => e.id === element)?.name ?? element;

export interface MatchFlowDeps {
  readonly view: GameScene;
  readonly hud: Hud;
  readonly audio: GameAudio;
  readonly minimap: Minimap;
  readonly controls: TouchControls;
  readonly glyphPicker: GlyphPicker;
  readonly grimoire: Grimoire;
  readonly comboLog: ComboLog;
  readonly comboCallouts: ComboCallouts;
  readonly renderer: MatchRenderer;
  readonly diagnostics: Diagnostics;
  /** Tu historial: cada partida terminada se suma al perfil. */
  readonly stats: PlayerStats;
  /** Tu Linaje, para que tu maestro comente el resultado (null: aún no eliges). */
  readonly school: () => ElementId | null;
  /** Repite la mejor jugada (o el desenlace) sobre el resultado. */
  readonly replay: (clip: ReplayClip, card: HighlightView | null) => void;
  /** Un combate de la Historia terminó: se guarda y dice cómo sigue (bajo el título). */
  readonly story: (won: boolean) => ResultPath;
}

/**
 * El curso de una partida visto por el jugador: los avisos de lo que pasa (descubrimientos,
 * caídas, Guardián, Esencias), el anuncio de cada ronda, la elección de Glifo entre rondas y
 * la pantalla de resultado.
 */
export class MatchFlow {
  private shownRound = 0;
  private detector: ComboDetector | null = null;
  private resultShown = false;
  private pickerShown = false;
  /** La ronda en que ya cayó alguien: el Crisol lo dice solo la primera vez. */
  private firstFallRound = 0;
  /** Quién ganó la última ronda: si perdiste, el selector de Glifos lo dice. */
  private lastWinner = -1;
  /**
   * La pausa ya anunciada, por rondas jugadas. Antes el aviso salía en un paso exacto de la
   * pausa y se perdía si un cuadro lento avanzaba dos pasos de una vez.
   */
  private announcedPause = -1;
  /** Quién derribó a quién y otros avisos cortos, arriba al centro. */
  private readonly feed = new MatchFeed();
  /** Los momentos del tejido que se cuentan para el informe de la partida. */
  private readonly moments = new MatchMoments();
  /** El último paso visto de la ronda en curso, para medir cuánto duró. */
  private roundTick = 0;
  /** Lo que la partida deja para tu Grimorio (va en el resultado). */
  private discovered: Weave[] = [];
  private newCombos: Combo[] = [];
  private lastBlow: LastBlow | null = null;

  constructor(private readonly deps: MatchFlowDeps) {}

  /** Ya terminó la serie y se ve el resultado. */
  get finished(): boolean {
    return this.resultShown;
  }

  /** Una partida nueva (o revancha) empieza de cero. */
  begin(): void {
    this.detector = null;
    this.shownRound = 0;
    this.resultShown = false;
    this.pickerShown = false;
    this.firstFallRound = 0;
    this.announcedPause = -1;
    this.feed.reset();
    this.moments.reset();
    this.roundTick = 0;
    this.discovered = [];
    this.newCombos = [];
    this.lastBlow = null;
  }

  /** Avisos de la partida según lo que pasó en el paso. */
  announce(
    events: readonly GameEvent[],
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
    rules: GameRules,
  ): void {
    const me = current.playerId;
    this.detectCombos(events, current);
    if (!(current instanceof TrainingMatch)) {
      // Solo la ronda ya anunciada: el primer paso de la siguiente no pisa la duración de esta.
      if (current.stage.kind === 'playing' && current.roundNumber === this.shownRound)
        this.roundTick = current.state.tick;
      this.moments.onStep(events, me);
      if (this.lastBlow?.playerId !== me) this.lastBlow = new LastBlow(me);
      const myTeam = current.player.team;
      this.lastBlow.onStep(
        events,
        current.state.tick,
        (id) => id !== me && current.state.wizards.find((w) => w.id === id)?.team !== myTeam,
      );
      const lines = this.feed.onStep(events, current.state, {
        playerId: me,
        nameOf: (id) => badges.get(id)?.name ?? 'Hechicero',
      });
      if (lines.length > 0) this.deps.hud.pushFeed(lines);
    }
    for (const event of events) {
      if (event.type === 'cast' && event.wizardId === me) {
        if (this.deps.grimoire.discover(event.weave)) {
          this.discovered.push(event.weave);
          this.moments.discovered();
          this.deps.audio.discover();
          this.deps.audio.say('voice.crisol.discover');
          const spell = spellOf(event.weave);
          this.deps.hud.celebrateDiscovery(
            spellName(event.weave),
            weaveOrbs(event.weave),
            this.deps.grimoire.count,
            this.deps.grimoire.total,
            undefined,
            spell ? intentTag(spell) : null,
          );
        }
      } else if (event.type === 'combo' && event.sourceId === me) {
        const combo = ComboLog.forReaction(event.combo);
        if (combo) this.countCombo(combo, current);
      } else if (event.type === 'phase') {
        this.deps.hud.announcePhase(event.phase);
        if (event.phase !== 'hunt') this.deps.audio.say(`voice.crisol.${event.phase}`);
      }
      if (
        event.type === 'defeated' &&
        !(current instanceof TrainingMatch) &&
        this.firstFallRound !== current.roundNumber
      ) {
        this.firstFallRound = current.roundNumber;
        this.deps.audio.say('voice.crisol.firstFall');
      }
      if (event.type === 'defeated' && event.wizardId === me) {
        const rule = current.state.deathRule;
        const subtitle =
          rule === 'out'
            ? 'Miras a quienes siguen en pie'
            : current.player.lives > 1
              ? 'Reapareces en unos segundos'
              : 'Te quedaste sin vidas';
        this.deps.hud.announce('Caíste', subtitle);
      } else if (event.type === 'revived' && event.wizardId === me) {
        this.deps.hud.announce(
          'De pie',
          `${badges.get(event.byId)?.name ?? 'Un aliado'} te levantó`,
        );
      } else if (event.type === 'guardianAwake') {
        this.deps.audio.say('voice.crisol.guardian');
        this.deps.hud.announce(
          'El Guardián despertó',
          'Está en la plaza: vencerlo da Esencia de todo',
          2.6,
        );
      } else if (event.type === 'beastSlain' && event.guardian) {
        const killer = event.killerId === me ? 'Tú' : badges.get(event.killerId ?? -1)?.name;
        this.deps.hud.announce(
          'Cayó el Guardián',
          event.killerId === me
            ? 'Esencia de los cinco elementos'
            : `${killer ?? 'Alguien'} se llevó su Esencia`,
          2.4,
        );
      } else if (event.type === 'beastSlain' && event.killerId === me) {
        const bonus = Math.round(rules.beasts.essenceDamagePerStack * 100);
        this.deps.hud.announce(
          `Esencia de ${elementName(event.element)}`,
          `+${bonus}% de daño con ${elementName(event.element)} esta ronda`,
          1.8,
        );
      } else if (event.type === 'shrineClaimed' && event.team === current.player.team) {
        this.deps.hud.announce('Santuario tomado', 'Recuperas vida y tu magia pega más fuerte', 2);
      }
    }
  }

  private teamName(
    current: MatchView,
    team: number,
    badges: ReadonlyMap<number, WizardBadge>,
  ): string {
    const ffa = solo(current);
    if (team === current.player.team) return ffa ? 'ti' : 'tu equipo';
    if (!ffa) return 'el equipo rival';
    const member = current.state.wizards.find((w) => w.team === team);
    return (member && badges.get(member.id)?.name) ?? 'un rival';
  }

  /** Anuncios de ronda, elección de Glifo y resultado, según la etapa de la partida. */
  update(current: MatchView, badges: ReadonlyMap<number, WizardBadge>, rules: GameRules): void {
    const playerTeam = current.player.team;
    const stage = current.stage;
    if (stage.kind === 'playing' && current.roundNumber !== this.shownRound) {
      this.shownRound = current.roundNumber;
      if (this.shownRound > 1) this.moments.roundEnded(this.roundTick);
      this.roundTick = 0;
      this.feed.reset();
      this.deps.audio.reset();
      this.deps.audio.setMood('hunt');
      this.deps.hud.reset(current.state, current.player, badges);
      this.deps.hud.hideHighlight();
      this.deps.view.creatures.clear();
      this.deps.minimap.reset();
      this.deps.view.rig.snap();
      if (current instanceof TrainingMatch) {
        this.deps.hud.announce('Entrenamiento', 'Teje y mira qué sale', 3);
      } else {
        this.deps.audio.say(`voice.crisol.round${Math.min(3, this.shownRound)}`);
        this.deps.hud.announce(
          `Ronda ${this.shownRound}`,
          this.shownRound === 1 && current.omen.id !== NO_OMEN.id
            ? `Presagio: ${current.omen.name}`
            : 'Caza: la arena está abierta',
          this.shownRound === 1 ? 3 : 2.4,
        );
      }
    }
    if ((stage.kind === 'playing' || stage.kind === 'waiting') && this.pickerShown) {
      this.pickerShown = false;
      this.deps.glyphPicker.hide();
      this.deps.controls.visible = stage.kind === 'playing';
      if (stage.kind === 'waiting')
        this.deps.hud.announce('Glifo elegido', 'Esperando a tu rival', 3);
    }
    // Jugando, los controles se ven salvo que hayas caído y estés mirando a otro.
    if (stage.kind === 'playing' && !this.resultShown)
      this.deps.controls.visible = this.deps.renderer.watchedOf(current) === null;
    if (stage.kind === 'choosing' && !this.pickerShown) {
      this.pickerShown = true;
      this.deps.hud.hideHighlight();
      this.deps.audio.setMood('menu');
      this.deps.controls.visible = false;
      const lost = current.series.roundsPlayed > 0 && this.lastWinner !== playerTeam;
      this.deps.glyphPicker.show(
        stage.options,
        current.glyphsOf(current.playerId),
        lost,
        stage.secondsLeft ?? null,
      );
    } else if (stage.kind === 'choosing' && stage.secondsLeft !== undefined) {
      this.deps.glyphPicker.setClock(stage.secondsLeft);
    }
    // En la pausa nada se mueve: los botones se guardan y dejan ver la jugada de la ronda.
    if (stage.kind === 'intermission') this.deps.controls.visible = false;
    if (stage.kind === 'intermission' && this.announcedPause !== current.series.roundsPlayed) {
      this.announcedPause = current.series.roundsPlayed;
      // La mejor jugada de la ronda queda a la vista hasta que termina la pausa.
      if (stage.highlight)
        this.deps.hud.showHighlight(
          this.highlightOf(stage.highlight, false, current, badges),
          Math.max(1, stage.ticksLeft / TICK_RATE),
        );
      const winner = stage.roundWinner;
      this.lastWinner = winner;
      if (winner >= 0) this.deps.audio.say('voice.crisol.roundWon');
      if (winner < 0) this.deps.hud.announce('Ronda empatada', 'Nadie suma', 3.5);
      else if (winner === playerTeam) this.deps.hud.announce('Ganaste la ronda', '', 3.5);
      else
        this.deps.hud.announce(
          'Ronda perdida',
          `Para ${this.teamName(current, winner, badges)}`,
          3.5,
        );
    }
    if (stage.kind === 'finished' && !this.resultShown) {
      this.resultShown = true;
      const winner = current.series.winnerTeam ?? -1;
      this.deps.audio.finish(winner === playerTeam);
      const ffa = solo(current);
      const outcome: Outcome = winner === playerTeam ? 'win' : winner < 0 ? 'draw' : 'loss';
      const school = this.deps.school();
      // En la Historia, lo que dicen los maestros va en las escenas.
      const story = current.options.story;
      const master =
        school && !story
          ? masterQuote(
              school,
              outcome,
              current.series.wins,
              rules.round.roundsToWin,
              Math.random(),
            )
          : undefined;
      // El Crisol dice el resultado y, cuando termina, tu maestro lo comenta.
      this.deps.audio.say(
        `voice.crisol.${outcome === 'win' ? 'victory' : outcome === 'loss' ? 'defeat' : 'draw'}`,
      );
      if (master) this.deps.audio.say(master.voice, true);
      const players = this.resultPlayers(current, badges, winner);
      const best = this.matchHighlight(current, badges);
      const clip = current.replayClip?.() ?? null;
      this.deps.hud.showResult({
        outcome,
        detail:
          winner >= 0 && winner !== playerTeam
            ? `Ganó ${ffa ? this.teamName(current, winner, badges) : 'el equipo rival'}`
            : '',
        // Cada uno por su cuenta y con resumen: las rondas van en el cuadro de cada mago.
        teams: players.length > 0 && ffa ? [] : this.resultTeams(current, badges, winner),
        roundsToWin: rules.round.roundsToWin,
        players,
        master,
        path: story ? this.deps.story(winner === playerTeam) : undefined,
        highlight: best,
        replay: clip?.highlight != null,
        grimoire: this.forGrimoire(),
      });
      this.addToProfile(current, outcome);
      this.deps.hud.showPerf(this.deps.diagnostics.report());
      this.reportPerformance(current);
      this.deps.controls.visible = false;
      // Primero la repetición, sola; el resultado aparece al terminar o al tocar Saltar.
      if (clip) this.deps.replay(clip, clip.highlight ? (best ?? null) : null);
    }
    if (stage.kind === 'finished') this.deps.hud.setRematch(current.rematchStatus?.() ?? null);
  }

  /** Lo que la partida deja para tu Grimorio: quién te derribó, lo descubierto y los combos. */
  private forGrimoire(): ResultGrimoire {
    const spell = this.lastBlow?.spell ?? null;
    const weave = spell ? SPELL_WEAVES[spell] : null;
    return {
      defeatedBy: weave ? { weave, name: spellName(weave) } : null,
      discovered: this.discovered.map((w) => ({ weave: w, name: spellName(w) })),
      combos: this.newCombos.map((c) => ({ id: c.id, name: c.name, steps: c.steps })),
    };
  }

  /** La mejor jugada de toda la partida, para la pantalla final. */
  private matchHighlight(
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
  ): HighlightView | undefined {
    const best = current.matchSummary()?.highlight;
    return best ? this.highlightOf(best, true, current, badges) : undefined;
  }

  private highlightOf(
    highlight: Highlight,
    whole: boolean,
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
  ): HighlightView {
    return highlightView(highlight, whole, {
      playerId: current.playerId,
      nameOf: (id) => badges.get(id)?.name ?? 'Hechicero',
      colorOf: (id) => badges.get(id)?.color ?? '#d8bf8a',
    });
  }

  /**
   * En red, al terminar la serie: el resumen de conexión y cuadros va al registro remoto, para
   * saber de dónde viene el lag sin pedir capturas.
   */
  private reportPerformance(current: MatchView): void {
    const network = current.networkSummary?.();
    // Sin datos de red (una revancha que terminó al toque) no hay nada que contar.
    if (!network || network.length === 0) return;
    const series = current.series;
    const winner = series.winnerTeam ?? -1;
    const result = winner < 0 ? 'empate' : winner === current.player.team ? 'ganó' : 'perdió';
    const game = `Partida: ${current.state.wizards.length} magos · ${series.roundsPlayed} rondas · ${result} · marcador ${series.wins.join('-')}`;
    this.moments.roundEnded(this.roundTick);
    const lines = [
      ...network,
      game,
      ...this.moments.report(),
      ...this.deps.diagnostics.fullReport(),
    ];
    reportProblem('rendimiento', network[0] ?? 'Resumen de la partida', lines.join('\n'));
    // Y se pregunta a cada uno cómo se jugó: lo que sintió junto a lo que midió su celular.
    const ping = network[0] ?? '';
    this.deps.hud.askOpinion((opinion, comment) => {
      if (comment)
        reportProblem('opinion', `Comentario: ${comment}`, [opinion ?? '', ping].join('\n').trim());
      else if (opinion) reportProblem('opinion', `Se jugó: ${opinion}`, ping);
    });
  }

  /** Los combos de hechizos del catálogo: su nombre sobre el blanco y, en partidas, el acierto. */
  private detectCombos(events: readonly GameEvent[], current: MatchView): void {
    if (this.detector?.playerId !== current.playerId) {
      this.detector = new ComboDetector(current.playerId);
    }
    for (const hit of this.detector.onStep(events, current.state)) {
      this.deps.comboCallouts.showCombo(hit.combo.name, hit.targetId);
      this.countCombo(hit.combo, current);
    }
  }

  /**
   * Suma un acierto: solo en partidas, no en Entrenamiento (ahí basta con el nombre en
   * pantalla). Si con este el combo aparece en el Grimorio, se celebra.
   */
  private countCombo(combo: Combo, current: MatchView): void {
    if (current instanceof TrainingMatch) return;
    this.moments.combo();
    const unlocked = this.deps.comboLog.record(combo.id);
    if (!unlocked) return;
    this.newCombos.push(unlocked);
    this.deps.audio.discover();
    this.deps.hud.celebrateDiscovery(
      unlocked.name,
      comboStepsView(unlocked),
      this.deps.comboLog.unlockedCount,
      this.deps.comboLog.total,
      'Nuevo combo',
    );
  }

  /** Un cuadro por mago con lo que hizo: tú primero, después tu equipo y luego cada rival. */
  private resultPlayers(
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
    winner: number,
  ): ResultPlayer[] {
    const summary = current.matchSummary();
    if (!summary) return [];
    const me = current.playerId;
    const myTeam = current.player.team;
    const teamOf = (id: number): number =>
      current.state.wizards.find((w) => w.id === id)?.team ?? -1;
    const rank = (id: number): number => {
      const team = teamOf(id);
      return id === me ? -2 : team === myTeam ? -1 : team;
    };
    const rows = [...summary.stats].sort((a, b) => rank(a.id) - rank(b.id) || a.id - b.id);
    const topDamage = Math.max(0, ...rows.map((r) => r.damage));
    return rows.map((row) => {
      const favorite = favoriteSpell(row);
      const weave = favorite ? SPELL_WEAVES[favorite] : null;
      return {
        name: badges.get(row.id)?.name ?? 'Hechicero',
        color: badges.get(row.id)?.color ?? '#d8bf8a',
        own: row.id === me,
        damage: row.damage,
        knockouts: row.knockouts,
        falls: row.falls,
        casts: row.casts,
        favorite: weave ? { name: spellName(weave), weave } : null,
        top: topDamage > 0 && row.damage === topDamage,
        rounds: solo(current)
          ? {
              wins: current.series.wins[teamOf(row.id)] ?? 0,
              winner: teamOf(row.id) === winner,
            }
          : undefined,
      };
    });
  }

  /** Suma la partida a tu perfil (contra la IA o en red; el entrenamiento no tiene resumen). */
  private addToProfile(current: MatchView, outcome: Outcome): void {
    const summary = current.matchSummary();
    if (!summary) return;
    const log = current.matchLog?.(__APP_VERSION__);
    if (log) sendMatchLog(summary.id, log);
    const kind = current.options.mode.kind;
    const mode: ModeGroup = kind === 'duel' ? 'duel' : kind === 'teams' ? 'teams' : 'ffa';
    this.deps.stats.add({
      id: summary.id,
      outcome,
      mode,
      online: current.rematchStatus !== undefined,
      own: summary.stats.find((row) => row.id === current.playerId),
    });
  }

  /** El marcador final: tu bando primero y después los demás, con su color y su nombre. */
  private resultTeams(
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
    winner: number,
  ): ResultTeam[] {
    const playerTeam = current.player.team;
    const ffa = solo(current);
    const teams = current.series.wins.map((wins, team): ResultTeam => {
      const member = current.state.wizards.find((w) => w.team === team);
      const own = team === playerTeam;
      return {
        label: own
          ? ffa
            ? 'Tú'
            : 'Tu equipo'
          : ffa
            ? ((member && badges.get(member.id)?.name) ?? 'Rival')
            : 'Equipo rival',
        color: (member && badges.get(member.id)?.color) ?? '#d8bf8a',
        wins,
        own,
        winner: team === winner,
      };
    });
    return [...teams.filter((t) => t.own), ...teams.filter((t) => !t.own)];
  }
}

/** Cada mago por su cuenta (1v1 y todos contra todos): el marcador lleva nombres, no equipos. */
function solo(current: MatchView): boolean {
  return current.options.mode.kind !== 'teams';
}
