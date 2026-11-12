import type { Room } from './room';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Base D1 `crisol-errores` (ver errorLog.ts). Puede faltar en desarrollo o en pruebas. */
  ERRORS?: D1Database;
}
