import type { GameAudio } from '../audio/GameAudio';
import { ownLook } from '../game/cast';
import type { Diagnostics } from '../game/Diagnostics';
import type { Grimoire } from '../game/Grimoire';
import type { MatchRenderer } from '../game/MatchRenderer';
import type { Profile } from '../game/Profile';
import type { CameraDrag } from '../input/CameraDrag';
import type { TouchControls } from '../input/TouchControls';
import type { ScreenAwake } from '../platform/mobile';
import type { GameScene } from '../render/GameScene';
import type { MenuPortrait } from '../render/MenuPortrait';
import type { BlindVeil } from './BlindVeil';
import type { ComboCallouts } from './ComboCallouts';
import type { GlyphPicker } from './GlyphPicker';
import type { GrimoireBook } from './GrimoireBook';
import type { Hud } from './Hud';
import type { Lobby } from './Lobby';
import type { Menu } from './Menu';
import type { Minimap } from './Minimap';
import type { PauseMenu } from './PauseMenu';
import type { TrainingPanel } from './TrainingPanel';
import type { UiObstacles } from './UiObstacles';
import type { Wardrobe } from './Wardrobe';
import type { WorldLabels } from './WorldLabels';

export interface ScreenParts {
  readonly view: GameScene;
  readonly menu: Menu;
  readonly menuPortrait: MenuPortrait;
  readonly wardrobe: Wardrobe;
  readonly grimoireBook: GrimoireBook;
  readonly lobby: Lobby;
  readonly hud: Hud;
  readonly labels: WorldLabels;
  readonly controls: TouchControls;
  readonly minimap: Minimap;
  readonly blindVeil: BlindVeil;
  readonly comboCallouts: ComboCallouts;
  readonly glyphPicker: GlyphPicker;
  readonly pauseMenu: PauseMenu;
  readonly trainingPanel: TrainingPanel;
  readonly obstacles: UiObstacles;
  readonly cameraDrag: CameraDrag;
  readonly screenAwake: ScreenAwake;
  readonly renderer: MatchRenderer;
  readonly diagnostics: Diagnostics;
  readonly audio: GameAudio;
}

/**
 * Qué se ve en cada pantalla. Pasar del menú a una partida (y de vuelta) muestra y oculta
 * decenas de piezas; aquí está todo junto, para que ninguna quede a la vista donde no va.
 */
export class Screens {
  constructor(private readonly parts: ScreenParts) {}

  /** El menú principal: la arena de fondo, sin nada de la partida. */
  menu(profile: Profile, grimoire: Grimoire): void {
    const p = this.parts;
    p.trainingPanel.visible = false;
    p.hud.training = false;
    p.screenAwake.active = false;
    p.lobby.hide();
    p.diagnostics.net = false;
    p.pauseMenu.setAvailable(false, false);
    p.view.clearMatch();
    p.glyphPicker.hide();
    p.renderer.clear();
    p.menu.visible = true;
    p.audio.setMood('menu');
    p.hud.visible = false;
    p.labels.visible = false;
    p.controls.visible = false;
    p.minimap.show(false);
    p.blindVeil.reset();
    p.comboCallouts.clear();
    p.cameraDrag.enabled = false;
    p.view.setLantern(false);
    p.hud.hideResult();
    p.wardrobe.hide();
    p.grimoireBook.hide();
    p.view.hidePreview();
    this.refreshIdentity(profile, grimoire);
  }

  /** Tu nombre, tu mago y tu avance en el Grimorio en el menú. */
  refreshIdentity(profile: Profile, grimoire: Grimoire): void {
    this.parts.menu.setIdentity(profile, grimoire.count, grimoire.total);
    this.parts.menuPortrait.setLook(ownLook(profile));
  }

  /** Una partida: el HUD, los controles, el minimapa y la Pausa. */
  match(training: boolean, online: boolean): void {
    const p = this.parts;
    p.menu.visible = false;
    p.lobby.hide();
    p.hud.visible = true;
    p.hud.hideResult();
    p.labels.visible = true;
    p.controls.visible = true;
    p.minimap.show(true);
    p.minimap.reset();
    p.cameraDrag.enabled = true;
    p.view.setLantern(true);
    p.hud.training = training;
    p.pauseMenu.training = training;
    p.pauseMenu.setAvailable(true, online);
    // Los datos de la conexión solo se ven en red (y si se pidieron en Pausa).
    p.diagnostics.net = online;
    p.screenAwake.active = true;
    p.obstacles.invalidate();
    p.view.rig.snap();
  }
}
