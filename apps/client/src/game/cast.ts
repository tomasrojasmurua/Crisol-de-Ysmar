import { ROBE_COLORS, SKIN_TONES, TRIM_COLORS } from '@crisol/content';
import type { ElementId } from '@crisol/core';
import { teamColorHex } from '../render/palette';
import type { WizardLook } from '../render/WizardView';
import type { WizardBadge } from '../ui/Hud';
import type { MatchView } from './MatchView';
import { type Appearance, lookColor, type Profile } from './Profile';

/** Cómo se ven los magos del Vestidor y del menú (sin bando). */
export const NEUTRAL_TEAM_COLOR = '#e8d7a8';

/** El aspecto de un mago en pantalla: sus piezas, su Afinidad y el color de su bando. */
export function lookOf(
  look: Appearance,
  affinity: ElementId | null,
  teamColor: string,
  isPlayer: boolean,
): WizardLook {
  return {
    teamColor,
    isPlayer,
    robe: lookColor(ROBE_COLORS, look.robe),
    trim: lookColor(TRIM_COLORS, look.trim),
    skin: lookColor(SKIN_TONES, look.skin),
    face: look.face,
    outfit: look.outfit,
    headwear: look.headwear,
    mask: look.mask,
    cape: look.cape,
    focus: look.focus,
    affinity,
  };
}

/** Tu mago tal como lo elegiste, para el Vestidor y la tarjeta del menú. */
export function ownLook(profile: Profile): WizardLook {
  return lookOf(profile.look, profile.affinity, NEUTRAL_TEAM_COLOR, true);
}

/** El nombre y el aspecto de los demás magos (de la sala en red, o inventados contra la IA). */
export type OtherWizard = (id: number) => { readonly name: string; readonly look: Appearance };

/**
 * El reparto de una partida: el nombre y color de cada mago (para el HUD, las etiquetas y el
 * minimapa) y su aspecto completo (para dibujarlo).
 */
export function castOf(
  current: MatchView,
  profile: Profile,
  other: OtherWizard,
): { badges: Map<number, WizardBadge>; looks: Map<number, WizardLook> } {
  const ffa = current.options.mode.kind === 'ffa';
  const playerTeam = current.player.team;
  const badges = new Map<number, WizardBadge>();
  const looks = new Map<number, WizardLook>();
  for (const wizard of current.state.wizards) {
    const isPlayer = wizard.id === current.playerId;
    const name = isPlayer ? profile.name || 'Tú' : other(wizard.id).name;
    const color = teamColorHex(wizard.team, playerTeam, isPlayer, ffa);
    badges.set(wizard.id, { name, color });
    looks.set(
      wizard.id,
      lookOf(
        isPlayer ? profile.look : other(wizard.id).look,
        current.affinities.get(wizard.id) ?? null,
        color,
        isPlayer,
      ),
    );
  }
  return { badges, looks };
}
