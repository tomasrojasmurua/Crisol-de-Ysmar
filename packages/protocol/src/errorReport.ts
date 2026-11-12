/**
 * Informes de errores que un celular manda al servidor para la prueba con amigos. No llevan datos
 * personales: ni nombre del jugador, ni IP, ni nada guardado en el celular. Solo qué pasó, en qué
 * versión, en qué tipo de celular y en qué sala y partida.
 */

/** Qué clase de problema es. */
export const REPORT_KINDS = ['error', 'promesa', 'red', 'sala'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export interface ErrorReport {
  /** `error`: excepción; `promesa`: promesa rechazada sin atender; `red`: corte o reconexión rara. */
  readonly kind: ReportKind;
  /** Una línea: qué pasó. */
  readonly message: string;
  /** La pila del error o un dato extra (código de cierre, segundos sin conexión…). */
  readonly detail: string;
  /** Versión del juego ("v79 · abc1234"). */
  readonly version: string;
  /** Tipo de celular y navegador ("Android 14 · SM-A145M · Chrome 131"). */
  readonly device: string;
  /** Pantalla ("844×390 @3x"). */
  readonly screen: string;
  /** Código de la sala, si hay una. */
  readonly room: string;
  /** Qué partida y ronda ("red #2 · free4 · ronda 3"). */
  readonly match: string;
  /** Un número al azar por cada vez que se abre el juego: agrupa los informes de una misma visita. */
  readonly session: string;
  /** Segundos desde que se abrió la página. */
  readonly uptime: number;
}

/** Topes de largo por campo: un informe nunca pesa más de unos pocos kB. */
export const REPORT_LIMITS = {
  message: 300,
  detail: 2000,
  short: 80,
  /** Informes por envío. */
  batch: 20,
  /** Bytes por envío. */
  bytes: 64_000,
} as const;

const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

/** Limpia un informe que llegó de afuera: descarta lo raro y recorta lo largo. */
export function cleanReport(raw: unknown): ErrorReport | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kind = REPORT_KINDS.find((k) => k === r.kind);
  const message = clip(r.message, REPORT_LIMITS.message).trim();
  if (!kind || !message) return null;
  const uptime = typeof r.uptime === 'number' && Number.isFinite(r.uptime) ? r.uptime : 0;
  return {
    kind,
    message,
    detail: clip(r.detail, REPORT_LIMITS.detail),
    version: clip(r.version, REPORT_LIMITS.short),
    device: clip(r.device, REPORT_LIMITS.short),
    screen: clip(r.screen, REPORT_LIMITS.short),
    room: clip(r.room, REPORT_LIMITS.short),
    match: clip(r.match, REPORT_LIMITS.short),
    session: clip(r.session, REPORT_LIMITS.short),
    uptime: Math.max(0, Math.min(Math.round(uptime), 1_000_000)),
  };
}

/** Lee un envío (un arreglo de informes en JSON). Lo que no calza se descarta. */
export function parseReports(text: string): ErrorReport[] {
  if (text.length > REPORT_LIMITS.bytes) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .slice(0, REPORT_LIMITS.batch)
    .map(cleanReport)
    .filter((r): r is ErrorReport => r !== null);
}

/**
 * Resume el navegador en pocas palabras, sin guardar el texto completo: sistema, modelo (si el
 * navegador lo dice) y navegador. Chrome en Android suele esconder el modelo ("K").
 */
export function describeDevice(userAgent: string): string {
  const ua = userAgent;
  const parts: string[] = [];
  const ios = /\b(iPhone|iPad|iPod)\b.*? OS (\d+)[_.](\d+)/.exec(ua);
  const android = /Android (\d+(?:\.\d+)?)(?:; ([^;)]+))?/.exec(ua);
  if (ios) {
    parts.push(`${ios[1]} · iOS ${ios[2]}.${ios[3]}`);
  } else if (android) {
    parts.push(`Android ${android[1]}`);
    const model = android[2]?.replace(/\s*Build\/.*$/, '').trim();
    if (model && model !== 'K' && model !== 'wv') parts.push(model);
  } else if (/Macintosh/.test(ua)) {
    parts.push('Mac');
  } else if (/Windows/.test(ua)) {
    parts.push('Windows');
  } else if (/Linux/.test(ua)) {
    parts.push('Linux');
  } else {
    parts.push('Otro');
  }
  parts.push(browserOf(ua));
  return parts.join(' · ');
}

function browserOf(ua: string): string {
  const rules: readonly (readonly [RegExp, string])[] = [
    [/CriOS\/(\d+)/, 'Chrome'],
    [/FxiOS\/(\d+)/, 'Firefox'],
    [/EdgA?\/(\d+)/, 'Edge'],
    [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]*.*Safari/, 'Safari'],
  ];
  for (const [pattern, name] of rules) {
    const found = pattern.exec(ua);
    if (found) return `${name} ${found[1]}`;
  }
  return 'navegador desconocido';
}
