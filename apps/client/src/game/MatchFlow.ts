import { type Combo, ELEMENTS, NO_OMEN, spellName } from '@crisol/content';
import type { GameEvent, GameRules } from '@crisol/core';
import type { GameAudio } from '../audio/GameAudio';
import type { TouchControls } from '../input/TouchControls';
import type { GameScene } from '../render/GameScene';
import type { ComboCallouts } from '../ui/ComboCallouts';
import { comboStepsView } from '../ui/comboSteps';
import type { GlyphPicker } from '../ui/GlyphPicker';
import { weaveOrbs } from '../ui/GrimoireBook';
import type { Hud, WizardBadge } from '../ui/Hud';
import type { Minimap } from '../ui/Minimap';
import type { ResultTeam } from '../ui/ResultScreen';
import { ComboDetector } from './ComboDetector';
import { ComboLog } from './ComboLog';
import type { Diagnostics } from './Diagnostics';
import type { Grimoire } from './Grimoire';
import type { MatchRenderer } from './MatchRenderer';
import type { MatchView } from './MatchView';
import { TrainingMatch } from './TrainingMatch';

/** El anuncio de quién ganó la ronda sale al empezar el entreacto. */
const INTERMISSION_ANNOUNCE_TICK = 4 * 30 - 1;

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
  /** Quién ganó la última ronda: si perdiste, el selector de Glifos lo dice. */
  private lastWinner = -1;

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
    for (const event of events) {
      if (event.type === 'cast' && event.wizardId === me) {
        if (this.deps.grimoire.discover(event.weave)) {
          this.deps.audio.discover();
          this.deps.hud.celebrateDiscovery(
            spellName(event.weave),
            weaveOrbs(event.weave),
            this.deps.grimoire.count,
            this.deps.grimoire.total,
          );
        }
      } else if (event.type === 'combo' && event.sourceId === me) {
        const combo = ComboLog.forReaction(event.combo);
        if (combo) this.countCombo(combo, current);
      } else if (event.type === 'phase') {
        this.deps.hud.announcePhase(event.phase);
      } else if (event.type === 'defeated' && event.wizardId === me) {
        const rule = current.state.deathRule;
        const subtitle =
          rule === 'spectre'
            ? 'Sigues como espectro'
            : rule === 'out'
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
    const ffa = current.options.mode.kind === 'ffa';
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
      this.deps.audio.reset();
      this.deps.audio.setMood('hunt');
      this.deps.hud.reset(current.state, current.player, badges);
      this.deps.view.creatures.clear();
      this.deps.minimap.reset();
      this.deps.view.rig.snap();
      if (current instanceof TrainingMatch) {
        this.deps.hud.announce('Entrenamiento', 'Teje y mira qué sale', 3);
      } else {
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
    if (stage.kind === 'intermission' && stage.ticksLeft === INTERMISSION_ANNOUNCE_TICK) {
      const winner = stage.roundWinner;
      this.lastWinner = winner;
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
      const ffa = current.options.mode.kind === 'ffa';
      this.deps.hud.showResult({
        outcome: winner === playerTeam ? 'win' : winner < 0 ? 'draw' : 'loss',
        detail:
          winner >= 0 && winner !== playerTeam
            ? `Ganó ${ffa ? this.teamName(current, winner, badges) : 'el equipo rival'}`
            : '',
        teams: this.resultTeams(current, badges, winner),
        roundsToWin: rules.round.roundsToWin,
      });
      this.deps.hud.showPerf(this.deps.diagnostics.report());
      this.deps.controls.visible = false;
    }
    if (stage.kind === 'finished') this.deps.hud.setRematch(current.rematchStatus?.() ?? null);
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
    const unlocked = this.deps.comboLog.record(combo.id);
    if (!unlocked) return;
    this.deps.audio.discover();
    this.deps.hud.celebrateDiscovery(
      unlocked.name,
      comboStepsView(unlocked),
      this.deps.comboLog.unlockedCount,
      this.deps.comboLog.total,
      'Nuevo combo',
    );
  }

  /** El marcador final: tu bando primero y después los demás, con su color y su nombre. */
  private resultTeams(
    current: MatchView,
    badges: ReadonlyMap<number, WizardBadge>,
    winner: number,
  ): ResultTeam[] {
    const playerTeam = current.player.team;
    const ffa = current.options.mode.kind === 'ffa';
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
