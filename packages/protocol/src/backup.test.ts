import { describe, expect, it } from 'vitest';
import {
  BACKUP_CODE_LENGTH,
  formatBackupCode,
  generateBackupCode,
  normalizeBackupCode,
  parseBackupEntries,
} from './backup';

describe('código de respaldo', () => {
  it('genera 12 letras del alfabeto de las salas', () => {
    const code = generateBackupCode((length) => Uint8Array.from({ length }, (_, i) => i * 37));
    expect(code).toHaveLength(BACKUP_CODE_LENGTH);
    expect(normalizeBackupCode(code)).toBe(code);
  });

  it('se muestra de a cuatro y se lee como lo escriba el jugador', () => {
    expect(formatBackupCode('K7QFM9XA2RHT')).toBe('K7QF-M9XA-2RHT');
    expect(normalizeBackupCode(' k7qf-m9xa 2rht ')).toBe('K7QFM9XA2RHT');
    expect(normalizeBackupCode('K7QF-M9XA')).toBeNull();
    // Sin 0/O ni 1/I: un código con ellas está mal escrito.
    expect(normalizeBackupCode('K7QF-M9XA-2RH0')).toBeNull();
  });

  it('solo acepta claves del juego con texto', () => {
    expect(parseBackupEntries({ 'crisol.perfil': '{}' })).toEqual({ 'crisol.perfil': '{}' });
    expect(parseBackupEntries({ 'crisol.perfil': 3 })).toBeNull();
    expect(parseBackupEntries({ otra: 'x' })).toBeNull();
    expect(parseBackupEntries(['crisol.perfil'])).toBeNull();
    expect(parseBackupEntries(null)).toBeNull();
  });
});
