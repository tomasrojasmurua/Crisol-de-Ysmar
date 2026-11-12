# Traspaso del proyecto Crisol de Ysmar

Este documento junta todo lo que una cuenta de Claude necesita para seguir el proyecto sin volver
a preguntar. **Estado al 12 de noviembre de 2026, con `main` al día hasta el PR #78.** Reemplaza al
traspaso del 9 de noviembre.

**Si eres Claude y estás empezando:** lee este archivo entero, luego `CLAUDE.md`,
`CONTRIBUTING.md`, `docs/diseno.md` y `docs/arquitectura.md`. Lo que se decidió en otras cuentas de
Claude está copiado en [`referencia/`](referencia/); no hace falta abrir los originales.

## En una frase

Duelo de hechiceros para celular, jugado en el navegador desde un enlace de WhatsApp, donde la magia
se **teje** en tiempo real combinando cinco elementos. Se juega completo contra la IA y en red con
amigos (de 1v1 a todos contra todos de 6) en
[crisol-de-ysmar.pages.dev](https://crisol-de-ysmar.pages.dev).

## Quién es Tomás y cómo trabaja

- **Tomás Rojas** (GitHub `tomasrojasmurua`) es el dueño y quien decide. Escribe en español de Chile,
  con mensajes cortos. Juega con un grupo de amigos en Chile; el juego es para ellos. Explícale
  los cambios en lenguaje simple, sin jerga de código.
- **Un PR por frente, y Claude lo fusiona apenas el CI está en verde.** Ya no hace falta esperar su
  "merge" (eso era antes). Al terminar, cuéntale qué cambió con enlace al PR y en pocas líneas.
- Le gusta conversar el diseño antes de construir: **opciones con una recomendación y preguntas
  numeradas al final.** Responde por número ("1. Si 2. No, prefiero…"). "Si", "Me parece" o
  "Confirmo" significan seguir con lo propuesto.
- Lo que está claro, hazlo sin preguntar; pregunta solo lo que cambia el resultado. Si decides algo
  por tu cuenta, díselo en una línea al final.
- Quiere un juego "indie de nivel mundial", con identidad y lore propios, y un código muy ordenado.
- Juega en **iPhone**. Varios amigos tienen **Android de gama media**, y uno con mala conexión suele
  crear la sala.
- Tiene **ChatGPT** (imágenes y texto), **Meshy** (3D), **Mixamo** (animaciones) y **ElevenLabs**
  (efectos, música y voz). Claude le escribe los prompts exactos y él trae los archivos. En diseño de
  interfaz deja a criterio de Claude diseñar directo o pedir mockups a ChatGPT, pero quiere que se le
  avise cuando ChatGPT pueda ayudar.
- Prioridad declarada: **la fluidez del multijugador**. Hoy el foco es llegar bien revisado a una
  prueba con unos 5 amigos (ver "Lo que sigue").

## Reglas fijas del proyecto

1. **100% original.** Se inspira en Magic: The Gathering, Smite, LoL y MOBAs, pero no se usan nombres,
   cartas, criaturas, mundos ni arte de otros juegos. Todo nombre es inventado para Ysmar.
2. **Idioma.** Textos del juego, comentarios y documentación en español; identificadores en inglés.
   Los nombres propios del juego (`brasa`, `umbra`) se mantienen.
3. **El núcleo es puro.** `packages/core` no importa nada externo, no usa `Math.random`, `Date` ni DOM.
   El azar viene de `SeededRng` y el tiempo de los pasos de simulación (30 por segundo).
4. **Los datos mandan.** Todo número de balance va en `packages/content`, nunca en código.
5. **Antes de proponer un cambio, `pnpm check`** (Biome, mapa de dependencias, tipos y Vitest).
6. Todo entra por PR a `main`, que siempre se puede jugar. La plantilla está en
   `.github/pull_request_template.md`.
7. **Si cambia la forma del estado, de los eventos o de los ajustes de sala, sube
   `PROTOCOL_VERSION`** en `packages/protocol/src/messages.ts` (va en 16). Cliente y Sala deben
   coincidir; quien tenga el juego abierto debe recargar.
8. **Celular en horizontal y nada tapa los botones.** Toda pieza nueva de interfaz se revisa a
   844×390 (iPhone) y en pantallas más angostas.

## Decisiones de diseño tomadas

| Tema              | Decisión                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilares           | La magia se construye, descubrir es progresar, duelos con estrategia (atacar y defender).                                                                                                                                                                                                                            |
| Plataforma        | Juego web sin instalar, **solo en horizontal**. Se entra por un enlace de WhatsApp.                                                                                                                                                                                                                                  |
| Cámara            | Tercera persona sobre el hombro. **No gira sola.** Tocar a un rival, una bestia o una invocación rival entra en **duelo**: la cámara lo mantiene al frente y un anillo lo marca en el suelo (sin esquinas). Arrastrar para mirar suelta el duelo; un botón con símbolo pasa al siguiente rival. Sin modos de prueba. |
| Controles         | Pulgar izquierdo mueve; pulgar derecho toca hasta 3 elementos y ✦ lanza; ✕ deshace. Arrastrar ✦ elige dirección; mantener ✦ y arrastrar elige dónde cae un hechizo de suelo. En PC: WASD, 1-5, espacio, X.                                                                                                           |
| Elementos         | Brasa, Tormenta, Marea, Raíz y Umbra en un pentágono: vecinos combinan, opuestos chocan (Brasa ↔ Marea y Raíz; Umbra ↔ Tormenta y Marea…).                                                                                                                                                                           |
| Tejido            | 1 a 3 elementos, el orden importa: 155 hechizos (5 básicos, 25 de dos, 125 Grandes). Visible para el rival. Fatiga por elemento (3 s), sin maná. Nada sale en menos de 0,17 s.                                                                                                                                       |
| Partida           | Mejor de 3 rondas **sin reloj**: Caza, Convergencia y Duelo final (un minuto cada una) y después **muerte súbita** (la zona se cierra del todo en 20 s y quema cada vez más). Gana el último en pie.                                                                                                                 |
| Al caer           | Quedas fuera de la ronda y miras a quien siga. **El Espectro se eliminó.** **Vidas** (3 por ronda) es opcional, apagada por defecto y no existe en 1v1 (el mejor de 3 ya es la segunda oportunidad).                                                                                                                 |
| Modos             | 1v1 (en la plaza de 17 m, sin jungla), 2v2, 3v3 y todos contra todos de 4 y 6 (mapa de 40 m con jungla). Puestos vacíos los llena la IA.                                                                                                                                                                             |
| IA                | Mismas reglas que un jugador. **Aprendiz / Duelista / Maestro.** Menú contra la IA: se elige (Duelista por defecto). Sala: se elige para los bots que llenan puestos. Entrenamiento y examen: Aprendiz.                                                                                                              |
| Invocaciones      | Ven con ojos propios: la ceguera de su dueño no las afecta (el Velo del rival sí). Tienen vida, atajan proyectiles y se pueden fijar tocándolas.                                                                                                                                                                     |
| Choque de tejidos | Ver `docs/diseno.md`. Solo se desarman **proyectiles**; el Meteoro se esquiva. Los desarma un hechizo tuyo de elemento opuesto que los toque, **solo a mano**. Empate se anulan; el más fuerte sigue debilitado. No es reacción.                                                                                     |
| Combos            | Sección del Grimorio. Guía, no recompensa: sin efecto extra. 84 (6 reacciones + 78 seguidillas). Detalle en [referencia/combos-grimorio.md](referencia/combos-grimorio.md).                                                                                                                                          |
| Tutorial          | 12 capítulos repetibles, del objetivo al examen contra el Aprendiz. Entrega 3 combos al terminar el capítulo Combos.                                                                                                                                                                                                 |
| Diagnóstico       | FPS y datos de conexión **nunca visibles por defecto**: solo se encienden desde Pausa y vuelven a apagarse al reabrir.                                                                                                                                                                                               |
| Grimorio          | No dice qué hechizo contrarresta cada estado, ni etiqueta combos "para varios rivales": descubrirlo es mérito del jugador.                                                                                                                                                                                           |
| Variedad          | Esencia de bestias, santuarios, Glifos entre rondas (1 de 3, 4 si perdiste), un Presagio por partida. Guardián del Crisol en pausa.                                                                                                                                                                                  |
| Afinidad          | Un elemento descansa 25% más rápido y sus dos opuestos 15% más lento; transforma la apariencia.                                                                                                                                                                                                                      |
| Progresión        | Variedad, no poder: Grimorio, combos, maestría, desafíos y rivalidades (estas tres últimas no existen aún).                                                                                                                                                                                                          |
| Perfiles          | Sin cuenta: nombre y aspecto en el Vestidor, guardados en el celular. A futuro, perfil en D1 con código de respaldo.                                                                                                                                                                                                 |
| Multijugador      | Salas privadas entre amigos en Chile. Servidor con autoridad (Durable Object "Sala", `locationHint: 'sam'`), predicción local, estado binario por diferencias, reconexión de 60 s con la IA a cargo.                                                                                                                 |
| Arte              | Fantasía oscura estilizada; la magia es lo único con color intenso. **Dirección C: metal arcano y vidrio ahumado.** El mockup de ChatGPT (arena oscura con velas, cristales violeta, HUD de metal) es la meta.                                                                                                       |
| Orden del arte    | Primero HUD (hecho), luego ambiente de la arena (empezado), al final personajes. Le tienta el 3D con Meshy/Mixamo solo si no afecta la fluidez en red.                                                                                                                                                               |
| Audio             | Sintetizado en código por ahora (cada elemento es una nota, el tejido un acorde). Se reemplazará con ElevenLabs.                                                                                                                                                                                                     |
| Lore              | Ysmar, sostenido por la Trama de cinco hilos; el Crisol es una arena viva y los vencedores retejen un hilo del mundo.                                                                                                                                                                                                |

## Estado actual

| Área                                        | Estado                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Tejido, combate, estados y reacciones       | Listo. 155 hechizos propios, 6 reacciones, choque de tejidos.                                            |
| Partida y modos                             | Listo contra la IA y en red: sin reloj, muerte súbita, Vidas opcional.                                   |
| Multijugador                                | En red de 2 a 6, predicción local, rivales ocultos, reconexión, quien llega tarde toma un mago de la IA. |
| IA                                          | Tres dificultades; ciega no se congela; esquiva proyectiles y avisos de suelo; lee Grandes hechizos.     |
| Combos y Grimorio                           | 84 combos detectados en partida; desbloqueo por aciertos; Mis combos.                                    |
| Tutorial y Entrenamiento                    | 12 capítulos, muñeco que ataca, examen; práctica libre sin cansancio.                                    |
| Interfaz                                    | HUD, menú, sala, Glifos, resultado, Grimorio y Pausa en metal arcano.                                    |
| Gráficas                                    | Geometría hecha por código con resplandor, estelas y ambiente de velas y cristales. Sin modelos reales.  |
| Audio                                       | Sintetizado en código ([docs/audio.md](../audio.md)).                                                    |
| Guardián, familiares, maestría, rivalidades | Guardián en pausa (los bots no logran vencerlo); el resto no existe.                                     |

Simulador (`pnpm balance`, 200 duelos de Duelistas): sur 47% / norte 53%, unos 34 s por serie al
mejor de 3. Cruces: Maestro le gana a Duelista 76%, Duelista a Aprendiz 76% y Maestro a Aprendiz 96%.
Hay 476 pruebas.

### Historia de PRs

| PR      | Qué trajo                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------- |
| #1–#20  | Monorepo y publicación, duelo contra la IA, modos, bestias, Vestidor, Grimorio, los 155 hechizos.     |
| #21–#32 | Red: 1v1, predicción, estado binario, celular robusto, salas de 2 a 6 y sus ajustes.                  |
| #33–#45 | Interfaz y arena según el mockup (metal arcano), Pausa con ajustes, rendimiento.                      |
| #46–#57 | Cámara de duelo, apuntado automático, prueba con amigos, `main.ts` dividido en 4, diagnóstico oculto. |
| #58–#59 | Glifos, resultado y Grimorio de vidrio y bronce.                                                      |
| #60–#67 | Combos: catálogo, detector, tutorial con 3 combos, Apuntar (mantener y arrastrar ✦).                  |
| #68–#70 | Botón "Jugar con amigos", círculo rúnico, red: llegar tarde y aviso de Sala reiniciada.               |
| #71     | Invocaciones con ojos propios (la ceguera del dueño no las toca).                                     |
| #72     | Se elimina el Espectro.                                                                               |
| #73     | Ronda sin reloj y muerte súbita.                                                                      |
| #74     | Vidas opcional, fuera del 1v1.                                                                        |
| #75     | Fijar invocaciones rivales tocándolas.                                                                |
| #76     | IA: no se congela, esquiva avisos de suelo, tres dificultades.                                        |
| #77     | Choque de tejidos.                                                                                    |
| #78     | Tutorial completo de 12 capítulos; el choque intercepta lo que viene en camino.                       |

## Lo que sigue: frente "Listo para los 5"

Tomás quiere hacer una **prueba en red con unos 5 amigos** (2 o 3 con Android de gama media, uno con
mala conexión que suele crear la sala) y llegar con una versión tan revisada que el feedback sea
"acá podría ser mejor" y no "se cayó", "no se puede jugar" o "no me pude reconectar". **Aceptó
congelar contenido nuevo** y afinar lo que hay. Propuesta de entregas (confirmar el orden con él):

1. **Registro remoto de errores.** Hoy no existe nada: si a un amigo se le cae el juego, solo se
   sabrá "se me cayó". Capturar `error` y `unhandledrejection` en el cliente (y desconexiones raras)
   y mandarlos a la Sala o a un Worker que los guarde (D1 o Workers Analytics Engine), con versión,
   modelo de celular, sala y partida. Sin datos personales. Una pantalla o un comando para leerlos.
2. **Que el progreso no se pierda en iPhone.** Grimorio, combos desbloqueados, capítulos del
   tutorial y Vestidor viven solo en `localStorage`. Safari puede borrarlo tras unos días sin abrir
   el sitio si no está en la pantalla de inicio. Opciones: invitar a "Agregar a inicio" (el
   `manifest.webmanifest` ya existe), y/o el perfil en D1 con un código de respaldo (decisión ya
   tomada a futuro). Pedirle a Tomás que elija.
3. **Prueba de estrés de la red con 6.** Ya existe un simulador de lag (`apps/client/src/net/LagSimulator.ts`,
   `apps/server/red/`). Correr salas de 6 con 150-300 ms y 5% de pérdida, quien crea la sala con mala
   conexión, reconexiones a mitad de ronda y la app en segundo plano. Arreglar lo que salga.
4. **Rendimiento en Android de gama media.** Medir con el informe por partida (`MatchPerfLog`) y los
   gráficos livianos de Pausa; revisar que la resolución adaptativa baje a tiempo en 3v3 y libre de 6.
5. **Revisión en celular real** de lo nuevo: el tutorial (sobre todo "Mirar" con la cámara y
   mantener y arrastrar ✦), la fila de IA en el menú, el choque de tejidos (si el margen de 0,5 m y la
   intercepción de 0,2 s se sienten justos) y la muerte súbita.
6. **Lista para la prueba:** un mensaje para los amigos con el enlace, qué probar y cómo reportar.

Tomás también aceptó, para después de la prueba: decidir con datos si las rondas son cortas (en el
simulador una serie dura ~34 s; a él en 1v1 se le sintió bien).

## Cosas pendientes o en pausa (no olvidarlas)

- **Guardián del Crisol** en pausa (`FEATURES.guardian`); los bots no logran vencerlo.
- **Familiares, maestría por elemento, desafíos, rivalidades, hechizos secretos, lore dentro del
  juego:** no existen. Esperan a después de la prueba con amigos.
- **Audio con ElevenLabs** (unos 40 efectos, una pista por fase, quizás un narrador): no partió.
- **Personajes 3D** (Meshy + Mixamo): tercer paso del orden de arte, sin empezar.
- **Apuntar:** a la guía visual de los hechizos de dirección le ha faltado cariño (lo dijo Tomás).
- **Glifo de Brasa:** subir un poco la llama interior para despejar la base (ver
  [referencia/ui-glifos.md](referencia/ui-glifos.md)).
- **IA:** el Maestro todavía no hace choques de tejidos ni combos del catálogo; podría ser el
  siguiente escalón.
- **Golpes de cono** (Zarpa…) no apuntan a invocaciones fijadas; solo proyectiles, explosiones y
  hechizos de suelo les pegan.
- Preguntas abiertas de antes: si los efectos que cambian la pantalla del rival (Ceguera, Eclipse,
  Mal de ojo, Ilusión de tejido) se quedan; si 40 m de radio se sienten bien con pocos jugadores.

## Dónde vive cada cosa

```text
packages/core/src/       Reglas puras (no depende de nada)
  sim/                   Bucle de pasos fijos, azar con semilla
  weaving/               Tejido y fatiga por elemento
  spells/                cast.ts, catalog.ts, payload.ts, clash.ts (choque de tejidos), update.ts
  spells/kit/            Un archivo por familia (brasa.ts…umbra.ts, great*.ts) y sus pruebas
  combat/                Vida, daño y estados (toda curación pasa por healWizard)
  match/                 step.ts, round.ts (fases, zona, muerte súbita, caídas, revivir),
                         queries.ts (visión, objetivo automático), beasts.ts, shrines.ts,
                         obstacles.ts, series.ts, modes.ts, state.ts
  ai/                    bot.ts (BotController, BotProfile, BotLevel), spellPlans.ts, navigation.ts
  controllers/           Intenciones y la interfaz común (dedo, IA, red)
packages/content/src/    Números y tablas: spells.ts, rules.ts, bots.ts (dificultades), combos.ts,
                         features.ts (piezas en pausa), glyphs.ts, affinity.ts, map.ts,
                         grimoire.ts (nombres), appearance.ts, names.ts
packages/protocol/src/   messages.ts (PROTOCOL_VERSION), settings.ts (ajustes de sala), stateCodec.ts
apps/client/src/
  main.ts                Arma todo y conecta pantallas, partida y entrenamiento
  game/                  LocalMatch, TrainingMatch (muñeco y examen), Tutorial (+ TutorialProgress),
                         ComboDetector, ComboLog, MatchFlow, MatchRenderer, Grimoire, Profile
  net/                   NetMatch (predicción), LagSimulator, openRoom
  render/                Escena, magos, hechizos, invocaciones, arena/, postprocesado, calidad adaptativa
  ui/                    Hud, Menu, Lobby, PauseMenu, GrimoireBook, TutorialCard, TrainingChooser,
                         ComboCallouts, WorldLabels, Minimap, Wardrobe, UiObstacles…
  input/ camera/         Controles táctiles, TapToLock, lockTargets, CameraDrag, CameraRig
  audio/                 Sintetizador, música y banco de sonidos
apps/server/src/         Worker de entrada y Durable Object "Sala" (duel.ts); red/ tiene la simulación
apps/balance/            Simulador bot contra bot (`pnpm balance`), con cruces de dificultades
scripts/check-dependencies.mjs   Hace cumplir el mapa de dependencias
docs/                    diseno.md, arquitectura.md, audio.md, publicacion.md, decisiones/, traspaso/
```

Al agregar o cambiar un hechizo: efecto en `spells/kit/`, números en `content/spells.ts`, nombre
en `content/grimoire.ts`, visual en `apps/client/src/render/`, uso por los bots en
`ai/spellPlans.ts`, pruebas junto al archivo, y `pnpm balance` buscando 45-55% por lado.

## Publicación y accesos

- GitHub Actions corre `pnpm check` en cada PR y publica en Cloudflare al fusionar a `main` (juego
  en Pages y servidor en Workers). Los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` ya
  están en el repositorio. Ver `docs/publicacion.md`.
- **La cuenta de Claude necesita acceso de escritura al repositorio en GitHub** (conectar GitHub con
  el usuario `tomasrojasmurua` basta).
- En las sesiones de Claude en la nube, la API GraphQL de GitHub puede estar bloqueada: abrir y
  fusionar PRs con la API REST funciona (`gh api repos/tomasrojasmurua/crisol-de-ysmar/pulls …` y
  `gh api -X PUT …/pulls/N/merge -f merge_method=squash`).
- Para revisar la interfaz sin celular: `pnpm --filter @crisol/client build`, servir con
  `vite preview` y sacar capturas a 844×390 con Chrome sin pantalla (puppeteer-core).

## Documentos de referencia

| Archivo                                                                    | Qué es                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [prompt-inicial.md](prompt-inicial.md)                                     | El mensaje para pegar al empezar en otra cuenta.                                        |
| [referencia/combos-grimorio.md](referencia/combos-grimorio.md)             | Combos: decisiones, cómo se detectan, reglas que dan forma al catálogo, lista completa. |
| [referencia/ui-glifos.md](referencia/ui-glifos.md)                         | Los glifos SVG aprobados de los 5 elementos (dirección C).                              |
| [referencia/diseno-original.md](referencia/diseno-original.md)             | Documento de diseño original (Hito 0). Parte quedó superada; `docs/diseno.md` manda.    |
| [referencia/arquitectura-original.md](referencia/arquitectura-original.md) | Plan de arquitectura del código e hitos.                                                |
| [referencia/estado-y-brechas.md](referencia/estado-y-brechas.md)           | Diagnóstico tras el PR #9 (histórico: el multijugador ya existe).                       |
| [referencia/rediseno-hechizos.md](referencia/rediseno-hechizos.md)         | Los 155 hechizos uno por uno y el plan por tandas.                                      |
| [tanda-4.md](tanda-4.md)                                                   | La cuarta tanda de Grandes hechizos y sus adaptaciones.                                 |
