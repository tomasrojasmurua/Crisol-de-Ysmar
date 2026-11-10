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
    };
    expect(cleanRoomSettings(settings)).toEqual(settings);
  });

  it('lo que viene mal vuelve al valor por defecto', () => {
    expect(
      cleanRoomSettings({ mode: { kind: 'ffa', players: 40 }, minutes: 99, bestOf: 2, omen: 'sí' }),
    ).toEqual(DEFAULT_ROOM_SETTINGS);
    expect(cleanRoomSettings(null)).toEqual(DEFAULT_ROOM_SETTINGS);
  });
});
