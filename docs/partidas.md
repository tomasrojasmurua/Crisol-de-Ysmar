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
