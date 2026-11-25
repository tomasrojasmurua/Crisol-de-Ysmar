# Registro de partidas

Para que la IA aprenda combinaciones de hechizos, cada partida terminada deja un registro de qué
lanzó cada mago, en qué momento, y qué pasó después. No es para imitar a nadie: es una fuente de
ideas que la IA prueba por su cuenta antes de usarlas.

## Qué se guarda

Por cada partida (la serie entera, todas sus rondas):

- **Modo** (`duel`, `teams2`, `ffa4`…), **dificultad de la IA** y **versión** del juego o de la Sala.
- **Magos por número**, con su equipo y si los jugó una persona (`human`). Nada de nombres, IP,
  celular ni código de respaldo.
- Por cada ronda, en arreglos cortos con el paso (30 por segundo) en que pasó:
  - `casts`: `[paso, mago, hechizo]` cada vez que salió un hechizo.
  - `hits`: `[paso, quien golpea, golpeado, daño]` (la zona va con quien golpea `0`).
  - `blocked`: `[paso, quien ataca, atacado]` cuando un ataque no hizo daño (escudo, Espejo…).
  - `combos`: `[paso, quien la provoca, a quien, reacción]` (vapor, conducción…).
  - `falls`: `[paso, mago]` cada caída.
  - Hasta 2.000 filas por lista y ronda.

Lo arma el núcleo (`core/match/matchLog.ts`) con los avisos de cada paso, sin tocar el estado ni
lo que viaja en la partida. No cambia `PROTOCOL_VERSION`: se manda una sola vez, al final.

## Quién lo manda

- **Contra la IA:** el celular, al mostrar el resultado (`platform/matchLog.ts`). El
  entrenamiento no tiene registro, y las pruebas automáticas (Playwright) no mandan nada.
- **En red:** la Sala, al terminar la serie, solo si alguien jugó en persona. En Cloudflare se
  guarda directo en D1; en Santiago se manda al Worker (`PARTIDAS_URL`, por defecto la misma
  dirección del registro de errores con `/api/partida`).

## Dónde queda

Base D1 `crisol-partidas`, enlace `MATCHES`. Se crea sola al publicar, como las otras. La tabla
`matches` se crea al primer registro:

| Columna     | Qué es                                      |
| ----------- | ------------------------------------------- |
| `at`        | Cuándo llegó                                |
| `source`    | `ia` (celular) o `red` (Sala)               |
| `mode`      | Modo corto                                  |
| `bot_level` | `apprentice`, `duelist` o `master`          |
| `humans`    | Cuántos magos jugó una persona              |
| `version`   | Versión del juego o de la Sala              |
| `data`      | JSON con `wizards`, `rounds` y `winnerTeam` |

Los registros de hace más de 6 meses se borran solos.

`POST /api/partida` recibe el registro en texto plano con JSON (hasta 400 kB) y responde 204, o
400 si no tiene la forma esperada (`protocol/matchLog.ts`, `parseMatchLog`).

## Cómo se usa: combinaciones

`pnpm --filter @crisol/balance combinaciones` busca pares de hechizos de un mismo mago, el
segundo a menos de 3 s del primero, que rinden más que el segundo solo: daño a rivales en los 3 s
siguientes, más 8 por reacción y 40 por caída. Desconfía de lo que se vio pocas veces (al menos 15
veces, y la diferencia se achica cuanto menos se vio).

- `--d1` lee las partidas registradas (solo lo que hicieron personas). Necesita
  `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- `--autojuego N` suma N duelos de un Maestro contra un Maestro que improvisa seguido, para que
  aparezcan combinaciones que nadie ha probado todavía (300 si no se pide `--d1`).
- `--guardar` escribe `packages/content/src/botCombos.ts`.

También se corre desde Actions → **Combinaciones** (deja el archivo como adjunto para subirlo en
un PR).

La IA (Duelista y Maestro) no las sigue como receta: después de lanzar un hechizo, si una
combinación lo sigue y la puede tejer, la suma a las opciones que prueba en su copia del duelo,
con el mismo peso que la mejor de las reglas. Solo la usa si le resulta mejor que lo demás.
