# Arquitectura del código

El plan completo vive en Claude:
[Crisol de Ysmar — Arquitectura del código](https://claude.ai/artifact/JqgEVJESRjiuA54rSY5tN2).

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
4. **Los conjuros se componen:** forma + efectos, según la gramática del tejido.
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
- `match/series.ts` lleva el mejor de 3 y `match/modes.ts` arma duelo, equipos y todos contra todos.
- En el cliente, `game/LocalMatch.ts` encadena rondas con bots, ofrece Glifos entre rondas y sortea el Presagio y las Afinidades de los bots; la red del Hito 2 reemplazará
  solo a los controladores.

## Red (desde el Hito 2)

La Sala (Durable Object) corre el núcleo y es la única verdad. Los celulares envían intenciones
numeradas cada 33 ms y reciben el estado unas 20 veces por segundo. Tu mago se predice en local
y se corrige con suavidad; los demás se muestran ~100 ms en el pasado, interpolados.

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

`localStorage` guarda el perfil (`crisol.perfil`: nombre, aspecto y Afinidad), el Grimorio
(`crisol.grimorio`: las claves de los tejidos ya lanzados) y la última elección del menú
(`crisol.menu`). Si el navegador no deja guardar, el juego sigue igual y solo se pierde al cerrar.
