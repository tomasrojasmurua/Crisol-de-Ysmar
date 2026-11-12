import { describeDevice, type ErrorReport, type ReportKind } from '@crisol/protocol';
import { errorReportUrl } from '../net/serverUrl';

/**
 * Manda al servidor los errores que ocurren en este celular (y los cortes de red raros), para
 * saber qué pasó cuando un amigo dice "se me cayó". Sin datos personales: ni nombre, ni nada de
 * lo guardado en el celular. Se lee con `pnpm errores` o el flujo "Leer errores" de GitHub.
 */

/** Dónde se está jugando cuando ocurre el problema. */
export interface ReportContext {
  readonly room: string;
  readonly match: string;
}

/** Tope de informes por visita: si algo falla en cada cuadro, no se inunda la base. */
const MAX_PER_VISIT = 40;
/** El mismo problema repetido dentro de este lapso se manda una sola vez. */
const REPEAT_MS = 30_000;
/** Los informes se juntan y salen de a varios, cada tantos milisegundos. */
const FLUSH_MS = 3_000;

/** Lo que el informe sabe del celular y la visita; se arma una vez. */
export interface ReportEnvironment {
  readonly version: string;
  device: string;
  readonly screen: string;
  readonly session: string;
}

/** Junta, filtra y manda informes. No toca el DOM: se prueba sin navegador. */
export class ErrorReporter {
  private readonly queue: ErrorReport[] = [];
  private readonly lastSeen = new Map<string, number>();
  private count = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly environment: ReportEnvironment,
    private readonly context: () => ReportContext,
    private readonly send: (body: string) => void,
    private readonly now: () => number,
  ) {}

  report(kind: ReportKind, message: string, detail = ''): void {
    const text = message.trim() || '(sin mensaje)';
    const key = `${kind}|${text}`;
    const at = this.now();
    const seen = this.lastSeen.get(key);
    if (seen !== undefined && at - seen < REPEAT_MS) return;
    this.lastSeen.set(key, at);
    if (this.count >= MAX_PER_VISIT) return;
    this.count++;
    let where: ReportContext = { room: '', match: '' };
    try {
      where = this.context();
    } catch {
      // Si leer el contexto falla, el informe sale igual.
    }
    this.queue.push({
      kind,
      message: text,
      detail,
      ...this.environment,
      ...where,
      uptime: Math.round(at / 1000),
    });
    if (!this.timer) this.timer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  /** Manda lo pendiente ya (también al cerrar o esconder la página). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    try {
      this.send(JSON.stringify(batch));
    } catch {
      // Sin red no hay nada que hacer: el informe se pierde.
    }
  }
}

let active: ErrorReporter | null = null;

/** Anota un problema. No hace nada si el registro no se encendió (pruebas, entrenamiento local…). */
export function reportProblem(kind: ReportKind, message: string, detail = ''): void {
  active?.report(kind, message, detail);
}

/** Enciende el registro: escucha los errores de la página y manda los informes al servidor. */
export function startErrorReports(context: () => ReportContext): void {
  if (active) return;
  const url = errorReportUrl();
  const reporter = new ErrorReporter(
    readEnvironment(),
    context,
    (body) => beam(url, body),
    () => performance.now(),
  );
  active = reporter;
  refineDevice(reporter.environment);

  window.addEventListener('error', (event) => {
    if (IGNORED.some((pattern) => pattern.test(event.message))) return;
    const error: unknown = event.error;
    const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '';
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    reporter.report('error', event.message || describe(error), [where, stack].join('\n').trim());
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    reporter.report(
      'promesa',
      describe(reason),
      reason instanceof Error ? (reason.stack ?? '') : '',
    );
  });
  // Al cerrar o esconder la página, lo pendiente sale de inmediato.
  window.addEventListener('pagehide', () => reporter.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reporter.flush();
  });
}

/** Avisos del navegador que no son fallas del juego. */
const IGNORED = [/ResizeObserver loop/];

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** `sendBeacon` sigue aunque la página se cierre; si no existe, un fetch que no espera respuesta. */
function beam(url: string, body: string): void {
  // Texto plano: el navegador no pide permiso previo (CORS) y el envío sale en un solo viaje.
  const blob = new Blob([body], { type: 'text/plain' });
  if (navigator.sendBeacon?.(url, blob)) return;
  void fetch(url, { method: 'POST', body: blob, keepalive: true, mode: 'no-cors' }).catch(() => {});
}

function readEnvironment(): ReportEnvironment {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const extras = [
    nav.hardwareConcurrency ? `${nav.hardwareConcurrency} núcleos` : '',
    nav.deviceMemory ? `${nav.deviceMemory} GB` : '',
  ].filter(Boolean);
  const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return {
    version: __APP_VERSION__,
    device: [describeDevice(navigator.userAgent), ...extras].join(' · '),
    screen: `${screen.width}×${screen.height} @${Math.round(devicePixelRatio * 10) / 10}x`,
    session: random.toString(36),
  };
}

interface HighEntropy {
  readonly model?: string;
  readonly platformVersion?: string;
}

/** Chrome en Android esconde el modelo en el texto del navegador, pero lo entrega si se pide. */
function refineDevice(environment: ReportEnvironment): void {
  const data = (
    navigator as Navigator & {
      userAgentData?: { getHighEntropyValues(hints: string[]): Promise<HighEntropy> };
    }
  ).userAgentData;
  if (!data) return;
  data
    .getHighEntropyValues(['model'])
    .then(({ model }) => {
      if (model && !environment.device.includes(model)) {
        environment.device = environment.device.replace(/^(Android [\d.]+)/, `$1 · ${model}`);
      }
    })
    .catch(() => {});
}
