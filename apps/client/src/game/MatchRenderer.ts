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
  type GameRules,
  PLACED_SPELLS,
  placedShape,
  spellOf,
  TICK_MS,
  type Vec2,
  type Wizard,
} from '@crisol/core';
import type { GameAudio } from '../audio/GameAudio';
import type { CameraFocus } from '../camera/CameraRig';
import type { PlayerInput } from '../input/PlayerInput';
import type { TouchControls } from '../input/TouchControls';
import type { AimSpot } from '../render/AimGuide';
import type { GameScene } from '../render/GameScene';
import { type WizardLook, WizardView } from '../render/WizardView';
import type { BlindVeil } from '../ui/BlindVeil';
import type { ComboCallouts } from '../ui/ComboCallouts';
import { setHidden, setText } from '../ui/dom';
import type { Hud, WizardBadge } from '../ui/Hud';
import type { HurtEdge } from '../ui/HurtEdge';
import type { Minimap } from '../ui/Minimap';
import { MENU_ICONS } from '../ui/menuIcons';
import type { PocketStrip } from '../ui/PocketStrip';
import type { UiObstacles } from '../ui/UiObstacles';
import type { WeaveName } from '../ui/WeaveName';
import type { WorldLabels } from '../ui/WorldLabels';
import type { MatchView } from './MatchView';
import { TrainingMatch } from './TrainingMatch';

/** La interfaz que se actualiza cada cuadro junto con la partida. */
export interface MatchUi {
  readonly hud: Hud;
  readonly labels: WorldLabels;
  readonly minimap: Minimap;
  readonly controls: TouchControls;
  readonly blindVeil: BlindVeil;
  readonly hurtEdge: HurtEdge;
  readonly comboCallouts: ComboCallouts;
  readonly obstacles: UiObstacles;
  readonly weaveName: WeaveName;
  readonly pocketStrip: PocketStrip;
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
 * Dibuja una partida cada cuadro: los magos, los hechizos, la cámara (y el duelo con lo que
 * fijaste), la marca de objetivo y la interfaz que sigue a la partida. Si caíste y quedaste
 * fuera, sigue al mago que miras.
 */
export class MatchRenderer {
  private readonly wizardViews = new Map<number, WizardView>();
  private readonly watchBadge: HTMLElement;
  private readonly watchName: HTMLElement;
  /** A quién mirabas, para no saltar de un rival a otro en cada cuadro. */
  private watchedId = -1;
  /** Lo último que se dibujó, para pasar al siguiente mago con las flechas. */
  private lastView: MatchView | null = null;
  /** Si en el cuadro anterior estabas mirando a otro (caído y sin nada tapando la arena). */
  private wasWatching = false;
  /** Abrir el Grimorio mientras miras a los demás (lo conecta quien arma el juego). */
  onGrimoire: (() => void) | null = null;
  /** Se acabó el mirar: volviste a jugar o la pantalla de Glifos o el resultado lo taparon. */
  onWatchEnd: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly view: GameScene,
    private readonly ui: MatchUi,
    private readonly audio: GameAudio,
    private readonly input: PlayerInput,
  ) {
    // Caíste: arriba al centro, a quién miras y dos flechas para pasar a otro mago en pie.
    this.watchBadge = document.createElement('div');
    this.watchBadge.className = 'watch-badge';
    this.watchBadge.hidden = true;
    const arrow = (label: string, glyph: string, step: 1 | -1): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'watch-arrow';
      button.textContent = glyph;
      button.setAttribute('aria-label', label);
      button.addEventListener('pointerdown', (event) => {
        // Que el toque no gire la cámara ni fije a nadie.
        event.stopPropagation();
        event.preventDefault();
        this.cycleWatched(step);
      });
      return button;
    };
    const text = document.createElement('div');
    text.className = 'watch-text';
    const kicker = document.createElement('span');
    kicker.className = 'watch-kicker';
    kicker.textContent = 'Caíste · miras a';
    this.watchName = document.createElement('strong');
    this.watchName.className = 'watch-name';
    text.append(kicker, this.watchName);
    // Fuera de la ronda es buen momento para leer qué te hicieron: el Grimorio a un toque.
    const book = document.createElement('button');
    book.type = 'button';
    book.className = 'watch-grimoire';
    book.innerHTML = MENU_ICONS.grimoire;
    book.setAttribute('aria-label', 'Abrir el Grimorio');
    book.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
    });
    book.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onGrimoire?.();
    });
    this.watchBadge.append(
      arrow('Mirar al mago anterior', '‹', -1),
      text,
      arrow('Mirar al siguiente mago', '›', 1),
      book,
    );
    parent.append(this.watchBadge);
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

  /** Fuera de partida: sin magos ni aviso de a quién miras. */
  clear(): void {
    this.clearWizards();
    this.watchBadge.hidden = true;
    this.watchedId = -1;
    this.lastView = null;
    if (this.wasWatching) this.onWatchEnd?.();
    this.wasWatching = false;
  }

  /**
   * Si caíste y quedaste fuera, el mago al que miras: el que elegiste con las flechas mientras
   * siga en pie; si no, un aliado en pie y si no, el rival que siga vivo. Null mientras sigas
   * jugando.
   */
  watchedOf(current: MatchView): Wizard | null {
    const standing = watchable(current);
    if (standing === null) return null;
    return (
      standing.find((w) => w.id === this.watchedId) ??
      standing.find((w) => w.team === current.player.team) ??
      standing[0] ??
      null
    );
  }

  /** Pasa al siguiente (1) o al anterior (-1) mago en pie: primero tus aliados, luego rivales. */
  cycleWatched(step: 1 | -1): void {
    const current = this.lastView;
    if (!current) return;
    const standing = watchable(current);
    if (!standing || standing.length < 2) return;
    const at = standing.findIndex((w) => w.id === this.watchedOf(current)?.id);
    const next = standing[(Math.max(0, at) + step + standing.length) % standing.length];
    if (!next) return;
    this.watchedId = next.id;
    // La cámara salta al nuevo mago de una vez, sin cruzar la arena volando.
    this.view.rig.snap();
  }

  render(current: MatchView, alpha: number, delta: number, context: FrameContext): void {
    const { rules, badges, covered } = context;
    const { view, ui, audio } = this;
    const { rig, camera } = view;
    const state = current.state;
    const time = ((current.displayTick?.(alpha) ?? state.tick + alpha) * TICK_MS) / 1000;
    const player = current.player;
    const teamColor = (team: number): string => {
      const member = state.wizards.find((w) => w.team === team);
      return (member && badges.get(member.id)?.color) ?? '#ffffff';
    };
    // Si caíste, la cámara sigue a quien miras.
    this.lastView = current;
    const watched = this.watchedOf(current);
    this.watchedId = watched?.id ?? -1;
    // Entre rondas y al final, la pantalla de Glifos o el resultado ocupan el centro.
    setHidden(this.watchBadge, watched === null || covered);
    const watching = watched !== null && !covered;
    if (this.wasWatching && !watching) this.onWatchEnd?.();
    this.wasWatching = watching;
    if (watched) {
      const badge = badges.get(watched.id);
      const ally = watched.team === player.team;
      setText(this.watchName, `${badge?.name ?? 'otro mago'}${ally ? ' · aliado' : ''}`);
      this.watchName.style.setProperty('--watched', badge?.color ?? '#f3e6c8');
      // Con uno solo en pie no hay a quién más pasar: las flechas sobran.
      this.watchBadge.classList.toggle('single', (watchable(current)?.length ?? 0) < 2);
    }
    const focus = watched ?? player;
    const playerPos = current.interpolated(focus.id, focus.pos, alpha);
    /** El tejido del mago que miras, tal como lo ves tú (con Ilusión, el falso; escondido, nada). */
    let watchedWeave: Wizard | null = null;

    for (const wizard of state.wizards) {
      const wizardView = this.wizardViews.get(wizard.id);
      if (!wizardView) continue;
      const pos = current.interpolated(wizard.id, wizard.pos, alpha);
      const hidden =
        current.isHidden?.(wizard.id) === true ||
        veiledFromTeam(state, player.team, wizard.id, rules) ||
        blindedFrom(player, wizard, rules);
      // Ilusión de tejido: el rival ve otros elementos en lo que tejes.
      const base = current.present?.(wizard) ?? wizard;
      const shown =
        base.team !== player.team && base.statuses.disguised ? disguise(base, state.tick) : base;
      if (wizard.id === watched?.id && !hidden) watchedWeave = shown;
      wizardView.update(shown, pos.x, pos.z, time, delta, rules, hidden);
      audio.watchWeave(shown, pos, hidden);
      if (!hidden) view.effects.aura(wizard, pos.x, pos.z, delta);
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
    // Golpe recibido: los bordes se tiñen de rojo un instante (solo tu mago, no a quien miras).
    if (watched === null) ui.hurtEdge.update(player, delta);
    // En el entrenamiento la esquina es del panel; el muñeco no se esconde.
    const sightless = player.statuses.blind && !player.statuses.hunting;
    ui.minimap.show(!sightless && !(current instanceof TrainingMatch));
    view.zone.update(state.zoneRadius, time);
    view.creatures.sync(state, teamColor, time, delta, view.camera.position, (id, pos) =>
      current.interpolated(id, pos, alpha),
    );

    // La marca muestra a quién irá el disparo automático (lo mismo que calcula el núcleo).
    // Tu mago como se ve en este celular: en red, lo que fijaste cuenta antes de que el
    // servidor lo confirme, así la cámara entra en duelo en el acto.
    const me = current.present?.(player) ?? player;
    const aimed = autoTarget(state, watched ?? me, rules);
    // Interpolado también si es una bestia o una invocación: en duelo la cámara lo sigue, y con
    // la posición del paso giraba a saltos de 30 por segundo.
    const targetPos = aimed ? current.interpolated(aimed.id, aimed.pos, alpha) : null;
    // Duelo: lo que fijaste tú sigue siendo el blanco, y la cámara lo mantiene al frente. Si
    // caíste, la cámara se acomoda (sin duelo) hacia el blanco de quien miras.
    const duel = watched === null && me.hp > 0 && aimed !== null && aimed.id === me.lockTarget;
    const cameraFocus: CameraFocus | null =
      aimed && targetPos
        ? duel
          ? { id: aimed.id, pos: targetPos, kind: 'duel' }
          : watched
            ? { id: aimed.id, pos: targetPos, kind: 'watch' }
            : null
        : null;
    // ✦ sin tejido usado como palanca: gira mientras el dedo siga corrido.
    if (this.input.lookRate !== 0) rig.rotate(this.input.lookRate * delta);
    rig.update(playerPos, cameraFocus, delta, view.effects.shake);
    ui.controls.dueling = duel;
    const forward = rig.forward();
    WizardView.viewYaw = Math.atan2(-forward.x, -forward.z);
    audio.setListener(playerPos, forward, current.playerId);
    view.follow(playerPos);
    view.targetMarker.update(
      player.hp > 0 && aimed && targetPos
        ? {
            id: aimed.id,
            pos: targetPos,
            kind: aimed.kind,
            guardian: state.beasts.find((b) => b.id === aimed.id)?.guardian === true,
          }
        : null,
      time,
      duel,
    );
    const aim = this.input.aimPreview;
    const aimDir = aim && player.hp > 0 ? rig.screenToGround(aim.right, aim.up) : null;
    view.aimGuide.update(
      playerPos,
      aimDir,
      aimDir
        ? placedSpotFor(
            player,
            playerPos,
            aimDir,
            this.input.reachPreview,
            targetPos ?? null,
            rules,
          )
        : null,
    );

    ui.controls.render(current.present?.(player) ?? player, rules);
    // Lo que tejes, abajo al centro: el tuyo, o si caíste, el de quien miras. Tu bolsillo es
    // tuyo y se guarda al caer. Si algo tapa la arena, ninguno se muestra.
    const own = watched === null && !covered ? me : null;
    ui.weaveName.render(covered ? null : (own ?? watchedWeave));
    ui.pocketStrip.render(own);
    // La ficha de vida es de quien miras: tu barra en cero no dice nada mientras miras a otro.
    ui.hud.update(
      state,
      player,
      current.series,
      current.roundNumber,
      badges,
      rules,
      watched ?? player,
    );
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
    ui.minimap.update(state, player, forward, seen, badges, time, watched ?? player);
  }
}

/**
 * Los magos que puedes mirar si caíste y quedaste fuera, en el orden de las flechas: primero
 * tus aliados en pie y después los rivales. Null si sigues jugando (o la ronda es con vidas).
 */
function watchable(current: MatchView): Wizard[] | null {
  const { state, player } = current;
  if (state.deathRule !== 'out' || !player.fallen) return null;
  const standing = state.wizards.filter((w) => w.hp > 0 && !w.fallen);
  return [
    ...standing.filter((w) => w.team === player.team),
    ...standing.filter((w) => w.team !== player.team),
  ];
}

/**
 * Dónde caería el hechizo de suelo que estás tejiendo si sueltas ✦ ahora, igual que lo calcula
 * la simulación: al alcance elegido o, si el objetivo queda cerca de ese punto, sobre él.
 */
function placedSpotFor(
  player: Wizard,
  from: Vec2,
  direction: Vec2,
  reach: number | null,
  targetPos: Vec2 | null,
  rules: GameRules,
): AimSpot | null {
  if (reach === null) return null;
  const spell = spellOf(player.weave);
  if (!spell || !PLACED_SPELLS.has(spell)) return null;
  const { range, radius } = placedShape(spell, rules);
  const chosen = {
    x: from.x + direction.x * range * reach,
    z: from.z + direction.z * range * reach,
  };
  const snapped =
    targetPos && Math.hypot(targetPos.x - chosen.x, targetPos.z - chosen.z) <= rules.weave.aimSnap;
  return { pos: snapped ? targetPos : chosen, radius };
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
