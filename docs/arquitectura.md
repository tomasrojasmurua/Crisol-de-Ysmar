# Arquitectura del código

El plan original está copiado en
[traspaso/referencia/arquitectura-original.md](traspaso/referencia/arquitectura-original.md).

## Mapa de dependencias

```text
apps/client   apps/server   apps/balance
      \             |             /
       packages/content   packages/protocol
                 \             /
                  packages/core   (no depende de nadie)
```

`scripts/check-dependencies.mjs` falla si un archivo importa algo fuera de lo permitido.

## Principios

1. **Núcleo determinista:** 30 pasos por segundo, azar con semilla, sin reloj.
2. **Todo mago recibe intenciones** de un controlador intercambiable: dedo, IA o red.
3. **Los datos mandan:** balancear es editar tablas en `packages/content`.
4. **Cada tejido es un hechizo propio:** su efecto vive en `packages/core/src/spells/kit` y sus números en `packages/content`.
5. **Dibujar no es simular:** el render interpola entre pasos para verse a 60 cuadros por segundo.

## La partida en el núcleo

- `match/step.ts` avanza una ronda; `match/round.ts` tiene las fases, la zona, las caídas,
  los revividos y quién gana la ronda.
- `match/beasts.ts` mueve a las bestias neutrales y reparte Esencia; `match/shrines.ts` maneja
  los santuarios de la Convergencia.
- `mods.ts` combina los modificadores de Glifos y Presagios (`combineMods`) en un `WizardMods` por
  mago; `spells/payload.ts` los aplica al lanzar junto con la Esencia y el estado potenciado.
- La Afinidad viaja en `WizardSetup.affinity` (para dibujarla) y su efecto entra como otro cambio de
  `mods` con `affinityPatch`; los multiplicadores viven en `content/affinity.ts`.
- El mapa vive en `content/map.ts` (se arma con semilla fija) y llega al núcleo como
  `rules.map`. `match/obstacles.ts` empuja a los magos fuera de los obstáculos, corta proyectiles
  y revisa la línea de visión; `ai/navigation.ts` le da a los bots caminos con A* sobre una grilla.
- `match/series.ts` lleva el mejor de 3 y `match/modes.ts` arma duelo, equipos y todos contra todos.
- En el cliente, `render/arena/JungleView.ts` dibuja la jungla con mallas instanciadas (lo que
  queda entre la cámara y tu mago se transparenta), `ui/Minimap.ts` muestra el mapa y
  `content/src/sight.ts` decide qué rivales se ven (lo usan el celular y la Sala).
- En el cliente, `game/LocalMatch.ts` encadena rondas con bots, ofrece Glifos entre rondas y sortea el Presagio y las Afinidades de los bots; la red del Hito 2 reemplazará
  solo a los controladores.

## Red (desde el Hito 2)

La Sala (Durable Object, creada en Sudamérica) corre el núcleo y es la única verdad. Los celulares
envían intenciones numeradas cada 33 ms y reciben el estado en cada paso (30 por segundo): en
binario y solo con lo que cambió. El celular guarda dos pasos de colchón y dibuja interpolando entre
ellos.

- `apps/server/src/duel.ts` (`DuelHost`, puro y con pruebas) lleva la partida de cualquier modo
  con Glifos; `room.ts` conecta los sockets y el reloj. En el cliente,
  `net/NetMatch.ts` cumple la misma interfaz que `LocalMatch` (`game/MatchView.ts`), así que el
  dibujo y el HUD no cambian. Si alguien se corta, la IA juega por él y puede volver en 60 s con su
  token (guardado en la pestaña).
- Predicción: tu mago se mueve en el acto. El servidor dice en cada estado hasta qué mensaje
  tuyo ya jugó (`ack`); el celular parte de tu mago en el estado más nuevo y repite encima lo que
  falta con `walkTarget`, la misma función con que camina el núcleo. Tu tejido también se ve al
  tocar. Los demás se ven un poco en el pasado, interpolados. El colchón se adapta a la red.
- Estado en binario y por diferencias (`packages/protocol/src/stateCodec.ts`): cada conexión tiene
  un codificador en la Sala y un decodificador en el celular. El primer cuadro va completo y los
  siguientes solo con lo que cambió respecto del anterior (el WebSocket entrega en orden y sin
  perder). Las listas con `id` se comparan por id; los decimales viajan a milésimas; los textos
  repetidos, por su número en una tabla. En un duelo entre bots: unos 6 KB por paso en JSON contra
  ~220 B de promedio y < 700 B de máximo. Si un estado no se puede leer, el celular reconecta y
  recibe uno completo. El resto de los mensajes (sala, Glifos, ping) siguen en JSON.
- Rivales ocultos: si no ves a un rival (Velo, Bosque maldito, Sombra prestada o tu Ceguera), la
  Sala no manda dónde está ni qué teje (`DuelHost.frameFor`): llega quieto donde lo viste por
  última vez y en la lista `hidden`, y no se dibuja ni sale en el mapa. La lógica de visión vive en
  `packages/content/src/sight.ts`, compartida por celular y Sala.
- Medir: `?lag=150&perdida=5` en la dirección simula 150 ms de ida y vuelta y un 5% de mensajes
  atrasados (`net/LagSimulator.ts`). El indicador de red muestra ping, colchón, cortes, kB/s y el
  estado más grande del último rato.
- Prueba de estrés (no corre en CI; necesita `pnpm dev:server`):
  - `apps/server/red/simulacion.test.ts`: 6 clientes simples contra la Sala, con lag y cortes.
  - `apps/client/red/celulares.test.ts`: 6 celulares sin pantalla, cada uno en su proceso con el
    código de red real (`NetMatch`), simulan una noche con amigos: quien crea la sala con 750 ms y
    15% de pérdida, túneles, WhatsApp con la conexión cortada por iOS, recargas y señal
    intermitente. Falla si alguno no vuelve a jugar su mago en 12 s tras cada problema.
- Celular robusto:
  - **App de fondo:** al ocultarse la pestaña el celular manda `away`; la IA juega por ti y la Sala
    deja de mandarte el estado (ahorra batería y datos). Al volver, se descarta lo viejo y llega
    un estado completo. Antes, tu mago seguía caminando en la última dirección.
  - **Silencio:** jugando, si un jugador conectado no manda nada en 2 s (túnel, cambio de wifi a
    4G), la IA lo cubre hasta que vuelva a hablar. Los demás ven el aviso.
  - **Conexión colgada:** si con la app a la vista no llega nada en 6 s, el celular corta y
    reconecta. Un intento de conexión que no contesta en 8 s se abandona y se repite (sin señal,
    el celular puede dejarlo colgado más de un minuto). Con el evento `online` reintenta en el
    acto, también si había un intento colgado.
  - **Sala de espera:** manda quien llegó primero entre los que siguen respondiendo (cualquier
    mensaje, también el ping). Si de quien manda no llega nada en 20 s, manda el siguiente; al
    volver recupera el mando.
  - **Rondas y revancha:** al empezar cada ronda se cuenta el silencio desde cero (antes todos
    parecían callados y la IA los tomaba un instante). Quien está fuera de la app no frena la
    revancha.
  - **Volver:** el pase para recuperar tu mago dura 3 horas en `localStorage`, así sirve aunque
    el sistema cierre la pestaña o entres de nuevo por el enlace. Al volver a la misma partida
    (`start` con `resume`), se sigue sin rearmar la escena. Se reintenta por 5 minutos.
- Salas de 2 a 6 y sus ajustes (`packages/protocol/src/settings.ts`): en la sala de espera, quien
  la creó elige el modo (duelo, 2v2, 3v3, libre de 4 o de 6), los minutos por ronda (2 a 5), las
  rondas (a 1, mejor de 3 o de 5) y si hay Glifos y Presagio; todos lo ven al instante (mensaje
  `settings`, que vuelve en `players`). `rulesForRoom` (content) estira o acorta las tres fases y
  el despertar del Guardián en proporción. Un modo con menos puestos que la gente que ya está no
  se acepta; si cambia el modo, los puestos se reparten de nuevo por orden de llegada y a quien
  cambió de número se le manda otro `welcome`. En equipos los puestos se alternan (1, 4, 2, 5…).
  Nada empieza solo: quien creó la sala toca "Empezar" y la IA ocupa los puestos libres. Con la
  partida empezada no entra nadie nuevo (sí vuelve quien se cortó, con su pase).

## Sonido

`apps/client/src/audio` sintetiza todo en vivo con Web Audio y escucha los mismos eventos que los
efectos. Cada sonido tiene una clave que puede reemplazarse por un archivo (ver [audio.md](audio.md)).

## Presupuestos de rendimiento

| Presupuesto                   | Límite    |
| ----------------------------- | --------- |
| Llamadas de dibujo por cuadro | < 150     |
| Triángulos en pantalla        | < 150.000 |
| Descarga inicial              | < 5 MB    |
| Paso de simulación (6 magos)  | < 2 ms    |
| Memoria de texturas           | < 128 MB  |

## Hitos

0. Cimientos: repositorio, pruebas y publicación.
1. El tejido se siente bien: un mago contra un bot, local, dos cámaras.
2. Jugar con amigos: Sala, enlace de WhatsApp, predicción y reconexión.
3. La partida completa: rondas, bestias, Glifos, Presagios y modos.
4. Identidad del jugador: perfiles, Vestidor, Afinidad, Grimorio y rivalidades.
5. Se ve y suena como Ysmar: arte y audio.
6. Balance y pulido: simulador bot contra bot.

## Lo que se guarda en el celular

`localStorage` guarda el perfil (`crisol.perfil`: nombre, aspecto y Afinidad; `cleanLook` completa lo que falte), el Grimorio
(`crisol.grimorio`: las claves de los tejidos ya lanzados) y la última elección del menú
(`crisol.menu`). Si el navegador no deja guardar, el juego sigue igual y solo se pierde al cerrar.
