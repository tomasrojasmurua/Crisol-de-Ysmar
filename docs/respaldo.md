# Respaldo del perfil

Hasta ahora todo el progreso (Grimorio, combos, Vestidor, Linaje, tutorial) vivía solo en el
celular: si Safari lo borraba o alguien cambiaba de teléfono, empezaba de cero. Ahora se respalda
en el servidor, **sin cuentas**: no se pide correo ni contraseña.

## Cómo funciona para el jugador

- La primera vez, el celular inventa un **código de respaldo** de 12 letras (`K7QF-M9XA-2RHT`),
  con las mismas letras que los códigos de sala (sin 0/O ni 1/I).
- Apenas el hechicero tiene nombre, y después cada vez que algo cambia, el progreso se sube solo:
  al rato de abrir, cada 45 s si cambió algo, al volver al menú, al salir del Vestidor y al dejar la
  app (con `keepalive`, para que llegue aunque se cierre).
- En el menú, bajo Sonido, la tarjeta **Tu respaldo** abre una ventana con el código (para copiarlo)
  y un campo para traer a un hechicero desde otro celular. El código no se muestra en el menú mismo
  porque las capturas del menú se comparten.
- En el Vestidor, bajo el arquetipo, está **"Tu código de respaldo"** (abre la misma ventana). La
  primera vez que se abre el juego, sin hechicero todavía, dice **"¿Ya tienes un hechicero? Tráelo
  con tu código"** y solo ofrece traerlo.
- Traer un respaldo reemplaza todo el progreso de ese celular (se pide confirmar) y la página se
  recarga con lo traído. Desde ahí ese celular respalda con el mismo código.
- Si dos celulares usan el mismo código, gana el último que respaldó. Para el uso normal (un
  celular a la vez) no importa.

El código viaja al ícono de inicio del iPhone junto con el resto del progreso (`#traer=…`, ver
`platform/homeScreen.ts`), así que Safari y el ícono respaldan al mismo hechicero.

## Servidor

El Worker de Cloudflare (no el servidor de Santiago) guarda los respaldos en D1, base
`crisol-perfiles`, enlace `PROFILES`. La base y la tabla se crean solas al publicar y al primer uso,
igual que el registro de errores. No hace falta tocar nada a mano.

| Ruta                    | Cuerpo (texto plano con JSON) | Respuesta                        |
| ----------------------- | ----------------------------- | -------------------------------- |
| `POST /api/perfil`      | `{ code, entries }`           | 204 guardado, 400 mal formado    |
| `POST /api/perfil/leer` | `{ code }`                    | 200 `{ entries, savedAt }` o 404 |

- `entries` son las claves `crisol.*` del celular con su texto, tal cual (máximo 64 claves y 60 KB).
  Lo del momento (`crisol.ultimaSala`, `crisol.sala.*`, `crisol.inicio`) y el propio código no van.
- Son POST con texto plano y el código en el cuerpo: el navegador no pregunta antes ("preflight"),
  `keepalive` funciona y el código no queda en direcciones ni registros.
- La fila se guarda bajo la **huella SHA-256 del código**, nunca el código: quien lea la base no
  puede usarla para entrar como otro. Adivinar un código es imposible en la práctica (60 bits).

Tabla `profiles`: `id` (huella), `data` (JSON de `entries`), `created_at`, `updated_at`, `saves`.

## Estadísticas y perfil

El historial del jugador (partidas, victorias, rachas, daño, derribos, hechizos favoritos,
victorias por modo y en red) vive en `crisol.estadisticas` y, como toda clave `crisol.*`, viaja en
este mismo respaldo: no hizo falta tocar el servidor de perfiles. Se ve en **Perfil**, en la
tarjeta de tu mago del menú (`ui/ProfileScreen.ts`).

Lo que hizo cada mago en una partida lo cuenta el núcleo (`core/match/matchStats.ts`) con los
avisos de cada paso, sin tocar el estado ni lo que viaja en cada paso. Contra la IA lo cuenta el
celular; en red, la Sala, que manda el resumen una sola vez al terminar la serie
(`NetStage.finished`, `PROTOCOL_VERSION` 19). Así el resumen es el mismo para todos, aunque un
rival estuviera escondido o se perdieran estados. Cada partida se suma al historial una sola
vez (se recuerdan las últimas 12), aunque vuelvas a la sala tras un corte. El entrenamiento no
cuenta.

Pendiente para más adelante: las victorias por Linaje y las rivalidades necesitan que la Sala
sepa qué perfil es cada jugador (una identidad del perfil al entrar a la sala). Este respaldo y
el historial son la base, pero no lo hacen todavía.

## Piezas

| Pieza                                 | Qué hace                                                     |
| ------------------------------------- | ------------------------------------------------------------ |
| `packages/protocol/src/backup.ts`     | Código de respaldo (generar, limpiar, mostrar) y topes.      |
| `apps/server/src/profiles.ts`         | Las dos rutas y la tabla en D1.                              |
| `apps/client/src/platform/backup.ts`  | Junta el progreso, lo sube cuando cambia y trae un respaldo. |
| `apps/client/src/ui/BackupSheet.ts`   | La tarjeta del menú y la ventana del código.                 |
| `apps/client/src/game/PlayerStats.ts` | Tu historial de partidas (`crisol.estadisticas`).            |
| `apps/client/src/ui/ProfileScreen.ts` | La ventana Perfil del menú.                                  |
