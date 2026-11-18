/** Lo que Chrome en Android dice de la conexión (`navigator.connection`); Safari no lo tiene. */
interface ConnectionInfo extends EventTarget {
  readonly type?: string;
  readonly effectiveType?: string;
  readonly rtt?: number;
  readonly downlink?: number;
  readonly saveData?: boolean;
}

/** Lo que Chrome dice de la batería (`navigator.getBattery`); Safari no lo tiene. */
interface BatteryInfo {
  readonly level: number;
  readonly charging: boolean;
}

/** Lo del navegador que se usa aquí (en las pruebas, uno de mentira). */
export interface DeviceSource {
  readonly connection?: ConnectionInfo;
  getBattery?(): Promise<BatteryInfo>;
}

const TYPE_LABEL: Record<string, string> = {
  wifi: 'wifi',
  cellular: 'datos móviles',
  ethernet: 'cable',
  none: 'sin conexión',
};

/** Tipos de conexión que se anotan como cambio (los demás, "otro" o "desconocido", no dicen nada). */
const KNOWN_TYPES = new Set(Object.keys(TYPE_LABEL));

/**
 * Lo que el celular dice de sí mismo durante una partida: por dónde se conecta (wifi o datos
 * móviles, y si cambió en plena partida) y cómo va la batería. Solo Chrome en Android lo dice;
 * en iPhone queda la compañía que anota el servidor. Sirve para saber si los tirones vienen de
 * la conexión de alguien o de un celular con poca batería que se frena solo.
 */
export class DeviceWatch {
  private battery: BatteryInfo | null = null;
  private batteryStart: number | null = null;
  private types: string[] = [];
  private readonly onChange = (): void => this.noteType();

  constructor(
    private readonly source: DeviceSource | undefined = globalThis.navigator as
      | DeviceSource
      | undefined,
  ) {
    this.source?.connection?.addEventListener?.('change', this.onChange);
  }

  /** Empieza una partida: se anota la batería y la conexión de partida. */
  start(): void {
    this.types = [];
    this.batteryStart = null;
    this.noteType();
    const getBattery = this.source?.getBattery;
    if (!getBattery) return;
    getBattery
      .call(this.source)
      .then((battery) => {
        this.battery = battery;
        this.batteryStart = battery.level;
      })
      .catch(() => {});
  }

  /** Líneas para el informe de la partida (nada de lo que el navegador no diga). */
  lines(): string[] {
    const lines: string[] = [];
    const connection = this.source?.connection;
    if (connection) {
      const parts: string[] = [];
      const type = connection.type ? TYPE_LABEL[connection.type] : undefined;
      if (type) parts.push(type);
      if (connection.effectiveType) parts.push(`calidad ${connection.effectiveType}`);
      if (connection.rtt !== undefined) parts.push(`~${connection.rtt} ms`);
      if (connection.downlink !== undefined) parts.push(`${connection.downlink} Mb/s`);
      if (connection.saveData) parts.push('ahorro de datos');
      const changes =
        this.types.length > 1
          ? ` · cambió en la partida: ${this.types.map((t) => TYPE_LABEL[t] ?? t).join(' → ')}`
          : '';
      if (parts.length > 0) lines.push(`Conexión: ${parts.join(' · ')}${changes}`);
    }
    const battery = this.battery;
    if (battery && this.batteryStart !== null) {
      const percent = (level: number) => `${Math.round(level * 100)}%`;
      lines.push(
        `Batería: ${percent(this.batteryStart)} → ${percent(battery.level)} · ${battery.charging ? 'cargando' : 'sin cargar'}`,
      );
    }
    return lines;
  }

  private noteType(): void {
    const type = this.source?.connection?.type;
    if (!type || !KNOWN_TYPES.has(type)) return;
    if (this.types[this.types.length - 1] !== type) this.types.push(type);
  }
}
