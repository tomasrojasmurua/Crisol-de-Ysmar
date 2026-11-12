# Registro de errores

Para la prueba con amigos: si a alguien se le cae el juego, queda anotado qué pasó, en qué versión,
en qué celular y en qué sala y partida. Así "se me cayó" se convierte en algo que se puede arreglar.

## Qué se anota

| Tipo      | Cuándo                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error`   | Una excepción en el celular (`window.onerror`).                                                                                                                                                                            |
| `promesa` | Una promesa rechazada que nadie atendió (`unhandledrejection`).                                                                                                                                                            |
| `red`     | Se cortó la conexión (código de cierre, segundos conectado, si la app estaba en segundo plano), se recuperó (tras cuántos segundos), no se pudo volver, estado ilegible, la sala se reinició o la Sala respondió un error. |
| `sala`    | Una excepción dentro de la Sala (Durable Object), al procesar un mensaje o en un paso.                                                                                                                                     |

Cada informe lleva: versión del juego (`v79 · abc1234`), celular y navegador resumidos
(`Android 13 · SM-A145M · Chrome 131 · 8 núcleos · 4 GB`), pantalla, código de sala, partida
(`red #2 · free4 · ronda 3`), un número al azar por visita (agrupa los informes de una misma vez que
se abrió el juego) y segundos desde que se abrió la página.

**Sin datos personales:** ni el nombre del jugador, ni la IP, ni el texto completo del navegador,
ni nada de lo guardado en el celular. Los informes se borran solos a los 30 días.

Para no inundar la base: el mismo problema se manda una vez cada 30 s, hay un tope de 40 informes
por visita y salen juntos cada 3 s (o al cerrar o esconder la página, con `sendBeacon`).

## Cómo leerlos

- **Desde GitHub (también en el celular):** Actions → **Leer errores** → Run workflow. Se puede
  elegir cuántas horas hacia atrás y una sala. El resultado queda en el resumen de la ejecución: un
  resumen agrupado por problema, los últimos 60 informes en hora de Chile y las pilas de error.
- **Desde un computador:** `pnpm errores` (opciones `--horas 6`, `--sala ABCD`), con
  `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el entorno.

Las pilas vienen del código compilado; los mapas (`*.js.map`) se publican junto al juego, así que se
pueden traducir a archivo y línea del código fuente.

## Piezas

| Pieza                                                  | Qué hace                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `packages/protocol/src/errorReport.ts`                 | Forma del informe, limpieza y topes, resumen del celular.         |
| `apps/client/src/platform/ErrorReporter.ts`            | Escucha errores, junta, filtra y manda los informes.              |
| `apps/client/src/net/NetMatch.ts`                      | Anota los cortes y reconexiones (`reportProblem('red', …)`).      |
| `apps/server/src/errorLog.ts`                          | `POST /api/errors`, guarda en D1 y anota los errores de la Sala.  |
| `apps/server/wrangler.jsonc`                           | Enlace `ERRORS` a la base `crisol-errores` (se crea al publicar). |
| `scripts/errores.mjs`, `.github/workflows/errores.yml` | Leer el registro.                                                 |

La tabla `reports` se crea sola la primera vez que llega un informe. Si el enlace a D1 no existe
(desarrollo local o pruebas), el servidor responde igual y no guarda nada.
