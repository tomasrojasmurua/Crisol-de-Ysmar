import {
  BEAST_NAMES,
  blindedFrom,
  ELEMENTS,
  GUARDIAN_NAME,
  veiledFromTeam,
  visibleEnemies,
} from '@crisol/content';
import {
  autoTarget,
  type Beast,
  ELEMENT_IDS,
  type ElementId,
  type GameEvent,
  type GameRules,
  isHiddenFrom,
  isSpectre,
  type MatchState,
  TICK_MS,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { GameAudio } from '../audio/GameAudio';
import type { CameraMode } from '../camera/CameraMode';
import { CENTER_STYLE, FOLLOW_STYLE } from '../camera/CameraRig';
import type { PlayerInput } from '../input/PlayerInput';
import type { TouchControls } from '../input/TouchControls';
import type { GameScene } from '../render/GameScene';
import { type WizardLook, WizardView } from '../render/WizardView';
import type { BlindVeil } from '../ui/BlindVeil';
import type { ComboCallouts } from '../ui/ComboCallouts';
import { EdgeIndicators } from '../ui/EdgeIndicators';
import type { Hud, WizardBadge } from '../ui/Hud';
import type { Minimap } from '../ui/Minimap';
import type { UiObstacles } from '../ui/UiObstacles';
import type { WorldLabels } from '../ui/WorldLabels';
import type { MatchView } from './MatchView';
import { TrainingMatch } from './TrainingMatch';

/** Hasta dónde se avisa con flechas de un rival fuera de pantalla (cámara asistida). */
const EDGE_RANGE = 25;
/** Cámara asistida: al disparar sin arrastrar, la cámara se centra este rato en ese blanco. */
const CAST_FOCUS_SECONDS = 1.5;

/** La interfaz que se actualiza cada cuadro junto con la partida. */
export interface MatchUi {
  readonly hud: Hud;
  readonly labels: WorldLabels;
  readonly minimap: Minimap;
  readonly controls: TouchControls;
  readonly blindVeil: BlindVeil;
  readonly comboCallouts: ComboCallouts;
  readonly obstacles: UiObstacles;
}

/** Lo que cambia de partida en partida y el dibujo necesita saber. */
export interface FrameContext {
  readonly rules: GameRules;
  readonly badges: ReadonlyMap<number, WizardBadge>;
  /** El centro de la pantalla está ocupado (resultado o elección de Glifo). */
  readonly covered: boolean;
}

const elementColorHex = (element: string): string =>
  ELEMENTS.find((e) => e.id === element)?.color ?? '#ffffff';
const beastName = (beast: Beast): string =>
  beast.guardian
    ? GUARDIAN_NAME
    : (BEAST_NAMES[beast.element as keyof typeof BEAST_NAMES] ?? 'Bestia');

/**
 * Dibuja una partida cada cuadro: los magos, los hechizos, la cámara (con sus modos de
 * prueba), la marca de objetivo y la interfaz que sigue a la partida. Si caíste y quedaste
 * fuera, sigue al mago que miras.
 */
export class MatchRenderer {
  private readonly wizardViews = new Map<number, WizardView>();
  private readonly edges: EdgeIndicators;
  private readonly watchBadge: HTMLElement;
  /** A quién mirabas, para no saltar de un rival a otro en cada cuadro. */
  private watchedId = -1;
  private mode: CameraMode = 'fija';
  /** Cámara asistida: el blanco del último disparo automático, por un rato. */
  private castFocus: { id: number; until: number } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly view: GameScene,
    private readonly ui: MatchUi,
    private readonly audio: GameAudio,
    private readonly input: PlayerInput,
  ) {
    this.edges = new EdgeIndicators(parent);
    this.watchBadge = document.createElement('div');
    this.watchBadge.className = 'watch-badge';
    this.watchBadge.hidden = true;
    parent.append(this.watchBadge);
  }

  set cameraMode(mode: CameraMode) {
    this.mode = mode;
    this.view.rig.style = mode === 'seguimiento' ? FOLLOW_STYLE : CENTER_STYLE;
    this.castFocus = null;
    if (mode !== 'asistida') this.edges.clear();
  }

  /** Crea la vista de cada mago con su aspecto. */
  setWizards(looks: ReadonlyMap<number, WizardLook>, rules: GameRules): void {
    this.clearWizards();
    for (const [id, look] of looks) {
      const view = new WizardView(look, rules, this.view.particles);
      this.view.scene.add(view.group);
      this.wizardViews.set(id, view);
    }
  }

  clearWizards(): void {
    for (const view of this.wizardViews.values()) view.dispose();
    this.wizardViews.clear();
  }

  /** Fuera de partida: sin magos, flechas ni aviso de a quién miras. */
  clear(): void {
    this.clearWizards();
    this.edges.clear();
    this.watchBadge.hidden = true;
    this.castFocus = null;
  }

  /** Disparaste sin arrastrar: en la cámara asistida, se centra un rato en ese blanco. */
  autoCast(current: MatchView, rules: GameRules): void {
    if (this.mode !== 'asistida') return;
    const target = autoTarget(current.state, current.player, rules);
    this.castFocus = target
      ? { id: target.id, until: performance.now() / 1000 + CAST_FOCUS_SECONDS }
      : null;
  }

  /** En la cámara asistida, un golpe desde fuera de pantalla se avisa en el borde. */
  onEvents(events: readonly GameEvent[], current: MatchView): void {
    if (this.mode !== 'asistida') return;
    for (const event of events) {
      if (
        event.type === 'hit' &&
        event.targetId === current.playerId &&
        event.form !== 'zone' &&
        event.sourceId !== current.playerId
      ) {
        const from = entityPos(current.state, event.sourceId);
        if (from) this.edges.hit(from);
      }
    }
  }

  /**
   * Si caíste y quedaste fuera, el mago al que miras: primero un aliado en pie y si no, el rival
   * que siga vivo. Null mientras sigas jugando.
   */
  watchedOf(current: MatchView): Wizard | null {
    const state = current.state;
    const player = current.player;
    if (state.deathRule !== 'out' || !player.fallen) return null;
    const standing = state.wizards.filter((w) => w.hp > 0 && !w.fallen);
    return (
      standing.find((w) => w.team === player.team) ??
      standing.find((w) => w.id === this.watchedId) ??
      standing[0] ??
      null
    );
  }

  render(current: MatchView, alpha: number, delta: number, context: FrameContext): void {
    const { rules, badges, covered } = context;
    const { view, ui, audio } = this;
    const { rig, camera } = view;
    const state = current.state;
    const time = ((state.tick + alpha) * TICK_MS) / 1000;
    const player = current.player;
    const teamColor = (team: number): string => {
      const member = state.wizards.find((w) => w.team === team);
      return (member && badges.get(member.id)?.color) ?? '#ffffff';
    };
    // Si caíste, la cámara sigue a quien miras.
    const watched = this.watchedOf(current);
    this.watchedId = watched?.id ?? -1;
    // Entre rondas y al final, la pantalla de Glifos o el resultado ocupan el centro.
    this.watchBadge.hidden = watched === null || covered;
    if (watched) {
      this.watchBadge.textContent = `Caíste · miras a ${badges.get(watched.id)?.name ?? 'otro mago'}`;
    }
    const focus = watched ?? player;
    const playerPos = current.interpolated(focus.id, focus.pos, alpha);

    for (const wizard of state.wizards) {
      const wizardView = this.wizardViews.get(wizard.id);
      if (!wizardView) continue;
      const pos = current.interpolated(wizard.id, wizard.pos, alpha);
      const spectre = isSpectre(state, wizard);
      const hidden =
        current.isHidden?.(wizard.id) === true ||
        veiledFromTeam(state, player.team, wizard.id, rules) ||
        blindedFrom(player, wizard, rules);
      // Ilusión de tejido: el rival ve otros elementos en lo que tejes.
      const base = current.present?.(wizard) ?? wizard;
      const shown =
        base.team !== player.team && base.statuses.disguised ? disguise(base, state.tick) : base;
      wizardView.update(shown, pos.x, pos.z, time, delta, spectre, rules, hidden);
      audio.watchWeave(shown, pos, hidden || spectre);
      if (!hidden) view.effects.aura(wizard, pos.x, pos.z, spectre, delta);
    }
    const wizardOf = (id: number): Wizard | undefined => state.wizards.find((w) => w.id === id);
    const wizardPos = (id: number): Vec2 | undefined => {
      const wizard = wizardOf(id);
      return wizard ? current.interpolated(id, wizard.pos, alpha) : undefined;
    };
    view.spells.sync(state.spells, {
      positionOf: (spell) =>
        spell.kind === 'projectile' ||
        spell.kind === 'summon' ||
        spell.kind === 'sweeper' ||
        spell.kind === 'guidedBolt'
          ? current.interpolated(spell.id, spell.pos, alpha)
          : { x: 0, z: 0 },
      viewerTeam: player.team,
      time,
      delta,
      wizard: wizardOf,
      wizardPos,
    });
    // Cegado: la pantalla se oscurece alrededor y el minimapa se apaga.
    ui.blindVeil.update(player, delta);
    // En el entrenamiento la esquina es del panel; el muñeco no se esconde.
    const sightless = player.statuses.blind && !player.statuses.hunting;
    ui.minimap.show(!sightless && !(current instanceof TrainingMatch));
    view.zone.update(state.zoneRadius, time);
    view.creatures.sync(state, teamColor, time, delta);

    // La marca muestra a quién irá el disparo automático (lo mismo que calcula el núcleo).
    const aimed = autoTarget(state, focus, rules);
    const targetPos = aimed
      ? aimed.kind === 'wizard'
        ? current.interpolated(aimed.id, aimed.pos, alpha)
        : aimed.pos
      : null;
    // Qué sigue la cámara depende del modo: lo fijado a mano (y, en la asistida, el blanco de un
    // disparo reciente) o, en seguimiento, el blanco del disparo. Si caíste, el de quien miras.
    const now = performance.now() / 1000;
    if (this.castFocus && (now > this.castFocus.until || this.castFocus.id !== aimed?.id)) {
      this.castFocus = null;
    }
    const follows =
      aimed !== null &&
      (watched !== null ||
        aimed.id === player.lockTarget ||
        this.mode === 'seguimiento' ||
        this.castFocus?.id === aimed.id);
    const cameraFocus = follows && aimed && targetPos ? { id: aimed.id, pos: targetPos } : null;
    rig.update(playerPos, cameraFocus, delta, view.effects.shake);
    if (this.mode === 'asistida') {
      const arrows =
        player.hp > 0 && !covered
          ? state.wizards
              .filter(
                (w) =>
                  w.team !== player.team &&
                  w.hp > 0 &&
                  !isHiddenFrom(w, player, rules) &&
                  !blindedFrom(player, w, rules) &&
                  Math.hypot(w.pos.x - playerPos.x, w.pos.z - playerPos.z) <= EDGE_RANGE,
              )
              .map((w) => ({
                pos: current.interpolated(w.id, w.pos, alpha),
                color: teamColor(w.team),
                strong: w.id === aimed?.id,
              }))
          : [];
      this.edges.update(camera, arrows, delta);
    }
    const forward = rig.forward();
    WizardView.viewYaw = Math.atan2(-forward.x, -forward.z);
    audio.setListener(playerPos, forward, current.playerId);
    view.follow(playerPos);
    view.targetMarker.update(player.hp > 0 ? targetPos : null, time);
    const aim = this.input.aimPreview;
    view.aimGuide.update(
      playerPos,
      aim && player.hp > 0 ? rig.screenToGround(aim.right, aim.up) : null,
    );

    ui.controls.render(current.present?.(player) ?? player, rules, isSpectre(state, player));
    ui.hud.update(state, player, current.series, current.roundNumber, badges, rules);
    ui.obstacles.refresh();
    ui.labels.updateBeasts(state, camera, beastName, elementColorHex);
    const seen = visibleEnemies(state, player.team, rules);
    // En red, a quien la Sala no te muestra no se lo ve ni en el mapa (llega quieto y sin tejido).
    for (const id of seen) if (current.isHidden?.(id)) seen.delete(id);
    ui.labels.update(
      state,
      (id, pos) => current.interpolated(id, pos, alpha),
      camera,
      player.team,
      badges,
      rules,
      seen,
      player.statuses.insight !== undefined,
    );
    view.maps.jungle.setBurned(state.burnedTrees);
    ui.comboCallouts.update(camera, wizardPos, delta);
    ui.minimap.update(state, player, forward, seen, badges, time);
  }
}

/** Dónde está ahora un mago o una bestia (para el aviso de golpes). */
function entityPos(state: MatchState, id: number): Vec2 | null {
  return (
    state.wizards.find((w) => w.id === id)?.pos ??
    state.beasts.find((b) => b.id === id)?.pos ??
    null
  );
}

/** Un tejido falso, que cambia cada segundo y medio, igual en todas las pantallas. */
function disguise(wizard: Wizard, tick: number): Wizard {
  const shift = (Math.floor(tick / 45) + wizard.id) % ELEMENT_IDS.length;
  const fake = (weave: readonly ElementId[]): ElementId[] =>
    weave.map(
      (e, i) => ELEMENT_IDS[(ELEMENT_IDS.indexOf(e) + shift + i) % ELEMENT_IDS.length] ?? e,
    );
  return {
    ...wizard,
    weave: fake(wizard.weave),
    channel: wizard.channel ? { ...wizard.channel, weave: fake(wizard.channel.weave) } : null,
  };
}
