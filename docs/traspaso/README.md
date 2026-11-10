# Traspaso del proyecto Crisol de Ysmar

Este documento junta todo lo que una cuenta nueva de Claude necesita para seguir el proyecto sin
volver a preguntar. Estado al 9 de noviembre de 2026, con `main` al día hasta el PR #19 y la tanda 4
de Grandes hechizos en su PR.

**Si eres Claude y estás empezando:** lee este archivo, luego `CLAUDE.md`, `CONTRIBUTING.md`,
`docs/diseno.md` y `docs/arquitectura.md`. Los documentos de diseño originales vivían en otra
cuenta de Claude; sus copias están en [`referencia/`](referencia/).

## En una frase

Duelo de hechiceros para celular, jugado en el navegador desde un enlace de WhatsApp, donde la magia
se **teje** en tiempo real combinando cinco elementos. Hoy se juega completo contra la IA en
[crisol-de-ysmar.pages.dev](https://crisol-de-ysmar.pages.dev). Ya se puede jugar un duelo 1v1 en
red con un amigo (menú → Jugar con un amigo).

## Quién es Tomás y cómo trabaja

- **Tomás Rojas** (GitHub `tomasrojasmurua`) es el dueño y quien decide. Escribe en español de Chile,
  con mensajes cortos. Juega con un grupo de amigos en Chile; el juego es para ellos.
- **Aprueba con "merge".** Cuando un PR está listo, Claude le avisa con el enlace y lo que cambió.
  Tomás responde "merge" y Claude lo fusiona (con el CI en verde). "Si" o "Continuemos" significan
  seguir con la propuesta hecha.
- Le gusta conversar el diseño antes de construir: propuestas con opciones, una recomendación y
  preguntas numeradas al final. Responde por número ("1. Me gustan 2. Si").
- Quiere un juego "indie de nivel mundial", con identidad y lore propios, y un código muy ordenado.
- Tiene acceso a **ChatGPT** (imágenes y texto), **Meshy** (modelos 3D), **Mixamo** (animaciones) y
  **ElevenLabs** (efectos, música y voz). Claude le entrega los prompts exactos y él genera los archivos.
- Prioridad declarada: **la fluidez del multijugador** por sobre todo lo demás.

## Reglas fijas del proyecto

1. **100% original.** Se inspira en Magic: The Gathering, Smite, LoL y MOBAs, pero no se usan nombres,
   cartas, criaturas, mundos ni arte de otros juegos. Todo nombre es inventado para Ysmar.
2. **Idioma.** Textos del juego, comentarios y documentación en español; identificadores en inglés.
   Los nombres propios del juego (`brasa`, `umbra`) se mantienen.
3. **El núcleo es puro.** `packages/core` no importa nada externo, no usa `Math.random`, `Date` ni DOM.
   El azar viene de `SeededRng` y el tiempo de los pasos de simulación (30 por segundo).
4. **Los datos mandan.** Todo número de balance va en `packages/content`, nunca en código.
5. **Antes de proponer un cambio, `pnpm check`** (Biome, mapa de dependencias, tipos y Vitest).
6. Todo entra por PR a `main`, que siempre se puede jugar. Commits convencionales (`feat:`, `fix:`…).
   La plantilla de PR está en `.github/pull_request_template.md`.

## Decisiones de diseño tomadas

| Tema            | Decisión                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilares         | La magia se construye, descubrir es progresar, duelos con estrategia.                                                                                                                                       |
| Plataforma      | Juego web sin instalar, celular solo en horizontal. Se entra por un enlace de WhatsApp.                                                                                                                     |
| Cámara          | Tercera persona sobre el hombro con fijación de objetivo (se probó la 3/4 y se descartó en el Hito 1). Se gira arrastrando el dedo.                                                                         |
| Controles       | Pulgar izquierdo mueve; pulgar derecho toca hasta 3 elementos y ✦ para lanzar; ✕ deshace. En PC: WASD, 1-5, espacio, X.                                                                                     |
| Elementos       | Brasa, Tormenta, Marea, Raíz y Umbra, en un pentágono: vecinos combinan, opuestos chocan.                                                                                                                   |
| Tejido          | 1 a 3 elementos, el orden importa: 155 hechizos (5 básicos, 25 de dos, 125 Grandes hechizos). El tejido es visible para el rival. Fatiga por elemento, sin maná.                                            |
| Hechizos        | Cada tejido es un hechizo propio con su efecto y su visual (se abandonó la gramática forma + modificador). Ninguno sale en menos de 5 pasos (~0,17 s). Dos elementos: 0,3 s; tres: 0,6 s y cansan los tres. |
| Partida         | Mejor de 3 rondas de **3 minutos**: Caza, Convergencia (la zona se cierra) y Duelo final, un minuto cada una.                                                                                               |
| Modos           | 1v1, 2v2, 3v3 y todos contra todos hasta 6. Puestos vacíos los llenan bots con las mismas reglas.                                                                                                           |
| Al caer         | Quedas fuera de la ronda y la cámara sigue a quien siga en pie (aliado primero). El Espectro y las 3 Vidas siguen en el código, en pausa.                                                                   |
| PvE primero     | Primero contra la IA; el PvP reemplaza controladores, no reglas.                                                                                                                                            |
| Mapa            | 40 m de radio: plaza de piedra al centro, jungla en espejo con 10 campamentos de bestias (2 por elemento) que reaparecen a los 45 s, Guardián del Crisol a los 40 s de Caza.                                |
| Variedad        | Esencia de bestias, santuarios, Glifos entre rondas (1 de 3, 4 si perdiste), un Presagio por partida.                                                                                                       |
| Afinidad        | Un elemento descansa 25% más rápido y sus dos opuestos 15% más lento; transforma la apariencia.                                                                                                             |
| Progresión      | Variedad, no poder: Grimorio, maestría, desafíos y rivalidades entre amigos.                                                                                                                                |
| Perfiles        | Sin cuenta: nombre y aspecto en el Vestidor, guardados en el celular. Más adelante, perfil en D1 con código de respaldo.                                                                                    |
| Multijugador    | Solo salas privadas entre amigos en Chile. Servidor con autoridad (Durable Object "Sala"), predicción local, reconexión de 60 s con la IA a cargo.                                                          |
| Arte y audio    | Fantasía oscura estilizada; la magia es lo único con color intenso. Cada elemento es una nota y el tejido suena como un acorde.                                                                             |
| Lore            | Ysmar, sostenido por la Trama de cinco hilos; el Crisol es una arena viva y los vencedores retejen un hilo del mundo.                                                                                       |
| Infraestructura | GitHub + Cloudflare (Pages para el juego, Worker y Durable Objects para las salas, D1 y R2 a futuro).                                                                                                       |

## Estado actual

| Área                                                                   | Estado                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tejido, combate y estados                                              | Listo. 5 básicos y 25 hechizos de dos elementos propios.                                  |
| Grandes hechizos                                                       | **125 de 125** (tandas 1 a 4). La cuarta: ver [tanda-4.md](tanda-4.md).                   |
| Partida, modos, zona, Espectro, Vidas                                  | Listo contra la IA.                                                                       |
| Bestias, santuarios, Glifos, Presagios, Guardián                       | Listo. Los bots no logran vencer al Guardián.                                             |
| Vestidor, Afinidad visible, Grimorio                                   | Listo, guardado en `localStorage`. Vestidor con linajes, ropas y arquetipos.              |
| Jungla viva (Incendio forestal, Brote de árbol)                        | Listo desde la tanda 3.                                                                   |
| Gráficas                                                               | Básico: geometría hecha por código, resplandor, sombras y partículas. Sin modelos reales. |
| **Multijugador**                                                       | **En red de 2 a 6**, predicción local, estado binario por diferencias.                    |
| Audio                                                                  | Sintetizado en código (notas, acordes, efectos, música). Ver [audio.md](../audio.md).     |
| Familiares, rivalidades, maestría, conjuros secretos, lore en el juego | No existen.                                                                               |

Medidas del diagnóstico: un paso de 6 magos cuesta 0,03 ms (límite 2 ms) y el juego descarga 216 KB.
El estado completo pesa unos 8,5 KB en JSON: enviarlo tal cual por red serían ~170 KB/s por
celular, así que el Hito 2 debe mandar solo lo que cambia, en binario.

### Historia de PRs

| PR            | Qué trajo                                                               |
| ------------- | ----------------------------------------------------------------------- |
| #1, #2        | Hito 0: monorepo, CI y publicación en Cloudflare.                       |
| #3, #4        | Hito 1: duelo contra un bot; cámara sobre el hombro como la única.      |
| #5            | Partida completa contra la IA: modos, rondas, zona.                     |
| #6            | Bestias, santuarios, Glifos y Presagios.                                |
| #7            | Vestidor, Afinidad visible y Grimorio.                                  |
| #8, #9        | Mapa grande con jungla, minimapa, campamentos y Guardián.               |
| #10           | Más luz, cámara que se gira con el dedo, aviso de conjuro más chico.    |
| #11, #12      | Rediseño: cada tejido de 1 y 2 elementos es un hechizo propio.          |
| #13, #14, #17 | Grandes hechizos, tandas 1 a 3 (25 + 27 + 18).                          |
| #15           | Rondas de 3 minutos y básicos de 0,17 s.                                |
| #16           | Piso del tejido: nada sale antes que un tejido de 1 elemento.           |
| #19           | 1v1 en la plaza; Guardián y 3 Vidas en pausa.                           |
| #20           | Los 55 Grandes hechizos que faltaban (ver `tanda-4.md`).                |
| #21–#25       | 1v1 en red, predicción local, interfaz para celular, entrenamiento.     |
| #26           | Sonido sintetizado: el tejido suena como acorde (ver `docs/audio.md`).  |
| #27           | Tejido sobre la cabeza, siluetas de familia y reacciones entre estados. |
| #28           | Linajes, ropas, sombreros, máscaras, capas y focos; 13 arquetipos.      |
| #29           | Estado binario por diferencias, rivales ocultos y simulador de lag.     |
| #30           | App de fondo, silencio, conexión colgada y volver con el pase.          |
| Salas grandes | 2v2, 3v3 y libres de 4 y 6 en red; la IA llena los puestos libres.      |

## Lo que sigue

Hay dos frentes abiertos. Pregúntale a Tomás por cuál partir; la recomendación fue la poda primero.

1. **Plan de debilidades (aprobado por Tomás).** Antes de la red:
   - Hecho (PR #19): **1v1 en la plaza** (arena de 17 m, sin jungla, campamentos ni bestias); la
     jungla completa queda para 2v2 en adelante. **Guardián y 3 Vidas en pausa** con interruptores
     en `packages/content/src/features.ts`; Espectro es la única regla de muerte. Los familiares no
     existían, así que no hubo nada que apagar.
   - Hecho antes: rondas de 3 minutos y aviso mínimo de 0,17 s (PR #15 y #16).
   - Hecho: tejido sobre la cabeza, siluetas por familia y reacciones entre estados (ver
     `docs/diseno.md`, Lectura del combate). Queda el choque de tejidos. Antes se propuso: tejido flotando sobre la cabeza como tres orbes; cuatro siluetas por
     familia de hechizo (proyectil, zona, movimiento, invocación); interacciones entre estados al
     estilo sistémico (mojado + Tormenta aturde, Raíz + Brasa arde); **choque de tejidos** (un
     tejido opuesto en el pentágono anula al del rival), a diseñar en papel e implementar con la red.
2. **Tanda 4 de Grandes hechizos (hecha).** Los 55 que faltaban, en un solo PR como pidió Tomás.
   Detalle, adaptaciones al 1v1 y preguntas abiertas en [tanda-4.md](tanda-4.md). Se recomendó
   congelar otro contenido nuevo hasta el Hito 2.
3. **Hito 2, multijugador**, en cuatro entregas (detalle en
   [estado-y-brechas.md](referencia/estado-y-brechas.md)): sala jugable con enlace de WhatsApp;
   fluidez (predicción, interpolación ~100 ms, mensajes binarios < 2 KB, no enviar rivales ocultos,
   repetir las 3 últimas intenciones); robustez en celular (`locationHint` en Sudamérica, reconexión
   de 60 s, pestaña oculta); herramientas para medir lag (150 ms y 5% de pérdida simulados).
4. **En paralelo:** audio con ElevenLabs (unos 40 efectos, 3 pistas por fase, un narrador), luego
   arte 3D con Meshy y Mixamo, y niveles de calidad gráfica automáticos.

Preguntas abiertas que dejó la cuenta anterior: qué teléfonos usan los amigos de Tomás; si los
efectos que cambian la pantalla del rival (Ceguera, Eclipse, Mal de ojo, Ilusión de tejido) quedan;
si 40 m de radio se sienten bien con 2 jugadores.

## Dónde vive cada cosa

```text
packages/core/src/       Reglas puras (no depende de nada)
  sim/                   Bucle de pasos fijos, mundo, azar con semilla
  weaving/               Tejido y fatiga por elemento
  spells/                cast.ts, catalog.ts, payload.ts (Glifos, Esencia, potenciado)
  spells/kit/            Un archivo por familia: brasa.ts…umbra.ts (1-2 elementos),
                         greatBrasa.ts…greatUmbra.ts, greatSummons.ts, greatSupport.ts,
                         greatThird.ts (Grandes hechizos) y sus pruebas
  combat/                Vida, daño y estados
  match/                 step.ts, round.ts (fases, zona, caídas, Lamento, revivir),
                         beasts.ts, shrines.ts, obstacles.ts, series.ts, modes.ts, state.ts
  ai/                    Bots y navigation.ts (A* sobre una grilla)
  controllers/           Intenciones y la interfaz común (dedo, IA, red)
  mods.ts                combineMods: Glifos, Presagios y Afinidad en un WizardMods
packages/content/src/    Números y tablas: spells.ts, rules.ts, glyphs.ts, affinity.ts, map.ts,
                         grimoire.ts (nombres de los 155), appearance.ts, names.ts (bots)
packages/protocol/       Mensajes celular ↔ Sala (casi vacío hasta el Hito 2)
apps/client/src/         Vite + Three.js
  game/LocalMatch.ts     Encadena rondas con bots, Glifos y Presagio (la red lo reemplazará)
  (content) sight.ts     Qué rivales se ven en la jungla
  render/                Vistas de magos, hechizos, invocaciones, bestias; arena/JungleView.ts
  ui/                    Hud, Menu, Minimap, GlyphPicker, GrimoireBook, BlindVeil
  input/ camera/         Controles táctiles y cámara
apps/server/             Worker de entrada y Durable Object "Sala" (wrangler.jsonc)
apps/balance/            Simulador bot contra bot (`pnpm balance`)
scripts/check-dependencies.mjs   Hace cumplir el mapa de dependencias
docs/                    diseno.md, arquitectura.md, publicacion.md, decisiones/, traspaso/
```

La cuarta tanda sumó `spells/kit/greatGround.ts` (terreno, detonadores, movilidad),
`greatMind.ts` (estados, tiempo, copias, contrahechizos), `greatFieldUpdates.ts` (lo que queda en el
campo: la entidad `Field` con sus modos, el Relámpago guiado, Mil pasos, el Rayo de enlace) y
`greatReactions.ts` (lo que pasa antes y después de lanzar y las reacciones a los golpes, que se
resuelven al final de cada paso). Toda curación pasa por `healWizard` en `combat/hit.ts`, para que
la Podredumbre funcione en todas partes.

Al agregar un Gran hechizo, el patrón de las tandas fue: efecto en `spells/kit/great*.ts`, números
en `content/spells.ts`, nombre en `content/grimoire.ts`, visual en `apps/client/src/render/Great*`,
uso por los bots, pruebas en `great*.test.ts`, y 200 duelos de bots con `pnpm balance` buscando
45-55% por lado.

## Publicación y accesos

- GitHub Actions corre `pnpm check` en cada PR y publica en Cloudflare al fusionar a `main`
  (juego en Pages y servidor en Workers). Los secretos `CLOUDFLARE_API_TOKEN` y
  `CLOUDFLARE_ACCOUNT_ID` ya están en el repositorio; no hay que tocarlos. Ver `docs/publicacion.md`.
- **La cuenta nueva de Claude necesita acceso al repositorio en GitHub.** Si usa la misma cuenta de
  GitHub (`tomasrojasmurua`), basta con conectar GitHub en la cuenta nueva. Si es otro usuario de
  GitHub, hay que agregarlo como colaborador del repositorio y que la app de Claude esté instalada
  en él.
- Los documentos de Claude de la cuenta anterior son privados de esa cuenta. Sus copias están en
  `referencia/` y no hace falta abrir los originales.
- Las capturas de pantalla del proyecto (jungla, Guardián, luz y cámara) venían en la carpeta del
  proyecto; Tomás las tiene aparte si hacen falta.

## Documentos de referencia

| Archivo                                                                    | Qué es                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [referencia/diseno-original.md](referencia/diseno-original.md)             | Documento de diseño original (Hito 0). Parte quedó superada; arriba dice qué.              |
| [referencia/arquitectura-original.md](referencia/arquitectura-original.md) | Plan de arquitectura del código e hitos.                                                   |
| [referencia/estado-y-brechas.md](referencia/estado-y-brechas.md)           | Diagnóstico tras el PR #9: qué hay, qué falta, plan del Hito 2 y aportes con herramientas. |
| [referencia/rediseno-hechizos.md](referencia/rediseno-hechizos.md)         | Los 155 hechizos uno por uno, combos, decisiones abiertas y plan por tandas.               |
| [tanda-4.md](tanda-4.md)                                                   | La cuarta tanda: los 55 Grandes hechizos, sus adaptaciones y lo que queda por decidir.     |
| [prompt-inicial.md](prompt-inicial.md)                                     | El mensaje para pegar en la cuenta nueva.                                                  |
