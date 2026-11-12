import { describe, expect, it } from 'vitest';
import { cleanReport, describeDevice, parseReports, REPORT_LIMITS } from './errorReport';

const base = {
  kind: 'error',
  message: 'x is undefined',
  detail: 'at foo',
  version: 'v79 · abc1234',
  device: 'Android 14',
  screen: '844×390 @3x',
  room: 'ABCD',
  match: 'red #1',
  session: 'k3j2',
  uptime: 12.4,
};

describe('informes de errores', () => {
  it('acepta un informe válido y redondea el tiempo', () => {
    expect(cleanReport(base)).toEqual({ ...base, uptime: 12 });
  });

  it('descarta tipos desconocidos o sin mensaje', () => {
    expect(cleanReport({ ...base, kind: 'otro' })).toBeNull();
    expect(cleanReport({ ...base, message: '   ' })).toBeNull();
    expect(cleanReport('hola')).toBeNull();
  });

  it('recorta lo largo y rellena lo que falta', () => {
    const report = cleanReport({ kind: 'red', message: 'm'.repeat(1000), extra: 'nombre' });
    expect(report?.message.length).toBe(REPORT_LIMITS.message);
    expect(report?.room).toBe('');
    expect(report).not.toHaveProperty('extra');
  });

  it('lee un envío y se queda con los válidos, sin pasarse del tope', () => {
    const many = Array.from({ length: 50 }, () => base);
    expect(parseReports(JSON.stringify(many))).toHaveLength(REPORT_LIMITS.batch);
    expect(parseReports(JSON.stringify([base, { kind: 'x' }]))).toHaveLength(1);
    expect(parseReports('no es json')).toEqual([]);
  });
});

describe('describeDevice', () => {
  it('reconoce iPhone con Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    expect(describeDevice(ua)).toBe('iPhone · iOS 18.1 · Safari 18');
  });

  it('reconoce el modelo de Android cuando viene', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-A145M Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(ua)).toBe('Android 13 · SM-A145M · Chrome 131');
  });

  it('omite el modelo escondido de Chrome ("K")', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(ua)).toBe('Android 10 · Chrome 131');
  });

  it('reconoce el navegador de Samsung', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(ua)).toBe('Android 14 · SM-S911B · Samsung 26');
  });
});
