import { describe, expect, it } from 'vitest';
import { DeviceWatch } from './DeviceWatch';

class FakeConnection extends EventTarget {
  type = 'wifi';
  effectiveType = '4g';
  rtt = 50;
  downlink = 10;
  saveData = false;
}

describe('DeviceWatch: conexión y batería del celular', () => {
  it('sin nada que diga el navegador (iPhone), no agrega líneas', () => {
    const watch = new DeviceWatch({});
    watch.start();
    expect(watch.lines()).toEqual([]);
  });

  it('dice por dónde se conecta y si cambió en plena partida', () => {
    const connection = new FakeConnection();
    const watch = new DeviceWatch({ connection });
    watch.start();
    connection.type = 'cellular';
    connection.dispatchEvent(new Event('change'));
    expect(watch.lines()).toEqual([
      'Conexión: datos móviles · calidad 4g · ~50 ms · 10 Mb/s · cambió en la partida: wifi → datos móviles',
    ]);
  });

  it('anota la batería al empezar y al terminar', async () => {
    const battery = { level: 0.54, charging: false };
    const watch = new DeviceWatch({ getBattery: async () => battery });
    watch.start();
    await Promise.resolve();
    await Promise.resolve();
    battery.level = 0.47;
    expect(watch.lines()).toEqual(['Batería: 54% → 47% · sin cargar']);
  });
});
