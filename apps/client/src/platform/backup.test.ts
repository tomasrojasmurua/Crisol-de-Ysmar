import { describe, expect, it } from 'vitest';
import { describeWhen } from '../ui/BackupSheet';
import { backupEntries, fingerprint, heroName } from './backup';

describe('respaldo del perfil', () => {
  it('lleva el progreso del juego, sin el código ni lo del momento', () => {
    const entries = backupEntries({
      'crisol.grimorio': '["brasa"]',
      'crisol.perfil': '{"name":"Tomás"}',
      'crisol.respaldo': '{"code":"K7QFM9XA2RHT"}',
      'crisol.ultimaSala': 'K7QF',
      'crisol.sala.K7QF': '{}',
      'otro.sitio': 'x',
    });
    expect(Object.keys(entries)).toEqual(['crisol.grimorio', 'crisol.perfil']);
  });

  it('ordena las claves: el mismo progreso da la misma huella', () => {
    const a = backupEntries({ 'crisol.b': '2', 'crisol.a': '1' });
    const b = backupEntries({ 'crisol.a': '1', 'crisol.b': '2' });
    expect(fingerprint(JSON.stringify(a))).toBe(fingerprint(JSON.stringify(b)));
    expect(fingerprint('uno')).not.toBe(fingerprint('dos'));
  });

  it('solo hay hechicero que respaldar si tiene nombre', () => {
    expect(heroName({ 'crisol.perfil': '{"name":" Tomás "}' })).toBe('Tomás');
    expect(heroName({ 'crisol.perfil': '{"name":""}' })).toBe('');
    expect(heroName({ 'crisol.perfil': 'roto' })).toBe('');
    expect(heroName({})).toBe('');
  });

  it('dice hace cuánto se respaldó', () => {
    expect(describeWhen(10_000)).toBe('hace un momento');
    expect(describeWhen(5 * 60_000)).toBe('hace 5 minutos');
    expect(describeWhen(60 * 60_000)).toBe('hace 1 hora');
    expect(describeWhen(3 * 86_400_000)).toBe('hace 3 días');
  });
});
