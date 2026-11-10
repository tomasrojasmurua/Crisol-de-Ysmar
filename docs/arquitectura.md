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
  el Lamento de los espectros, los revividos y quién gana la ronda.
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
  `game/Sight.ts` decide qué rivales se ven.
- En el cliente, `game/LocalMatch.ts` encadena rondas con bots, ofrece Glifos entre rondas y sortea el Presagio y las Afinidades de los bots; la red del Hito 2 reemplazará
  solo a los controladores.

## Red (desde el Hito 2)

La Sala (Durable Object, creada en Sudamérica) corre el núcleo y es la única verdad. Los celulares
envían intenciones numeradas cada 33 ms y reciben el estado completo en cada paso (30 por segundo,
unos 5 KB en JSON, comprimido por el WebSocket). El celular guarda dos pasos de colchón y dibuja
interpolando entre ellos.

- Primera versión (1v1): `apps/server/src/duel.ts` (`DuelHost`, puro y con pruebas) lleva la partida
  al mejor de 3 con Glifos; `room.ts` conecta los sockets y el reloj. En el cliente,
  `net/NetMatch.ts` cumple la misma interfaz que `LocalMatch` (`game/MatchView.ts`), así que el
  dibujo y el HUD no cambian. Si alguien se corta, la IA juega por él y puede volver en 60 s con su
  token (guardado en la pestaña).
- Predicción: tu mago se mueve en el acto. El servidor dice en cada estado hasta qué mensaje
  tuyo ya jugó (`ack`); el celular parte de tu mago en el estado más nuevo y repite encima lo que
  falta con `walkTarget`, la misma función con que camina el núcleo. Tu tejido también se ve al
  tocar. Los demás se ven un poco en el pasado, interpolados. El colchón se adapta a la red.
- Pendiente: mandar solo lo que cambia y en binario, y salas de más de dos.

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
