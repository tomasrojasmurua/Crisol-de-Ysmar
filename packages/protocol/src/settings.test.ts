import { describe, expect, it } from 'vitest';
import { cleanRoomSettings, DEFAULT_ROOM_SETTINGS } from './settings';

describe('ajustes de la sala', () => {
  it('acepta lo que se puede elegir', () => {
    const settings = {
      mode: { kind: 'teams', size: 3 },
      minutes: 5,
      bestOf: 1,
      glyphs: false,
      omen: false,
      lives: true,
      botLevel: 'master',
    };
    expect(cleanRoomSettings(settings)).toEqual(settings);
  });

  it('lo que viene mal vuelve al valor por defecto', () => {
    expect(
      cleanRoomSettings({ mode: { kind: 'ffa', players: 40 }, minutes: 99, bestOf: 2, omen: 'sí' }),
    ).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(cleanRoomSettings(null)).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('las Vidas vienen apagadas y no se pueden en el 1v1', () => {
    expect(DEFAULT_ROOM_SETTINGS.lives).toBe(false);
    expect(cleanRoomSettings({ mode: { kind: 'duel' }, lives: true }).lives).toBe(false);
    expect(cleanRoomSettings({ mode: { kind: 'ffa', players: 4 }, lives: true }).lives).toBe(true);
  });

  it('la dificultad de los bots es Duelista salvo que se elija otra válida', () => {
    expect(DEFAULT_ROOM_SETTINGS.botLevel).toBe('duelist');
    expect(cleanRoomSettings({ botLevel: 'apprentice' }).botLevel).toBe('apprentice');
    expect(cleanRoomSettings({ botLevel: 'dios' }).botLevel).toBe('duelist');
  });
});
