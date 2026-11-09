# Crisol de Ysmar — Arquitectura del código

Copia del documento de Claude del 9 de noviembre de 2026 (autor: Tomás Rojas Murúa), escrito antes
del Hito 0. La estructura real de hoy está en `docs/arquitectura.md` y `docs/traspaso/README.md`;
algunas carpetas de este plan (`beasts/`, `net/`, `audio/`, `scenes/`, `assets/`) todavía no existen.

## Tecnologías

Todo el proyecto se escribe en TypeScript, un solo lenguaje para el juego, el servidor y las
herramientas, organizado como un monorepo en un único repositorio de GitHub.

| Pieza                   | Elección                             | Por qué                                                                       |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| Lenguaje                | TypeScript en modo estricto          | Los tipos atrapan errores antes de jugar y hacen seguro cambiar código grande |
| Gráficos 3D             | Three.js                             | Liviano, muy probado en navegadores de celular y con la comunidad más grande  |
| Empaquetado del cliente | Vite                                 | Arranque instantáneo en desarrollo y paquetes chicos para producción          |
| Servidor de salas       | Cloudflare Workers + Durable Objects | Una sala es un objeto con su propio estado y conexión en tiempo real          |
| Base de datos           | Cloudflare D1                        | SQL simple para perfiles, estadísticas y rivalidades                          |
| Archivos pesados        | Cloudflare R2                        | Modelos, texturas y audio fuera del paquete del juego                         |
| Validación de datos     | Zod                                  | Las tablas de conjuros y balance se validan al compilar                       |
| Pruebas                 | Vitest                               | Rápido y del mismo ecosistema que Vite                                        |
| Formato y lint          | Biome                                | Una sola herramienta para estilo y errores comunes                            |
| Paquetes                | pnpm workspaces                      | Monorepo ordenado y rápido de instalar                                        |
| Integración continua    | GitHub Actions                       | Prueba cada cambio y publica en Cloudflare al fusionar                        |

## Principios

Las reglas del juego viven en un núcleo puro que no sabe nada de pantallas, sonido ni red. Todo lo
demás se conecta a él desde afuera.

1. **Núcleo determinista.** La simulación avanza en pasos fijos de 30 por segundo. Usa un generador
   de azar con semilla y nunca lee el reloj, así que con las mismas entradas siempre da el mismo
   resultado. Eso permite predecir en el celular, repetir partidas y simular balance.
2. **Las dependencias van en una sola dirección.** Las apps dependen del núcleo; el núcleo no depende
   de nadie. Una regla lo hace cumplir.
3. **Todo mago recibe intenciones.** Un controlador entrega intenciones como "moverse", "agregar
   Brasa al tejido" o "lanzar hacia aquí". Hay tres controladores intercambiables: el dedo, la IA y
   la red.
4. **Los datos mandan.** Elementos, formas, efectos, Glifos, Presagios, bestias y Afinidades son
   tablas validadas. Balancear es editar datos, no código.
5. **Los conjuros se componen.** (Superado: hoy cada tejido es un hechizo propio en
   `spells/kit`.)
6. **Dibujar no es simular.** El render lee el estado del núcleo e interpola entre pasos para verse
   fluido a 60 cuadros por segundo, pero nunca cambia el juego.
7. **La interfaz no tiene lógica de juego.** Los menús y el HUD solo muestran estado y envían
   intenciones.

## Estructura del repositorio (plan)

```text
crisol/
├─ packages/
│  ├─ core/              Reglas puras del juego, sin pantalla ni red
│  │  ├─ sim/            Bucle de pasos fijos, mundo, entidades, azar con semilla
│  │  ├─ weaving/        Tejido, gramática de conjuros, fatiga por elemento
│  │  ├─ spells/         Formas y efectos que se combinan
│  │  ├─ combat/         Vida, daño, estados e interacciones entre elementos
│  │  ├─ beasts/         Bestias neutrales, Esencia y vínculo
│  │  ├─ match/          Rondas, fases, zona que se cierra, victoria, Espectro y Vidas
│  │  ├─ controllers/    Intenciones y la interfaz común de controladores
│  │  └─ ai/             Hechiceros bot que producen intenciones
│  ├─ content/           Tablas de datos validadas: elementos, conjuros, Glifos, Presagios, Afinidades
│  └─ protocol/          Mensajes entre celular y sala, y su codificación binaria
├─ apps/
│  ├─ client/            Juego web (Vite + Three.js)
│  │  ├─ render/         Escena, modelos, partículas de conjuros, calidad gráfica
│  │  ├─ camera/         Cámaras intercambiables: tercera persona y 3/4
│  │  ├─ input/          Joystick, arco de elementos, gestos, vibración
│  │  ├─ audio/          Acordes del tejido, música por fase, sonido posicional
│  │  ├─ net/            Conexión, predicción, reconciliación, reconexión
│  │  ├─ ui/             Menús, sala, HUD, Grimorio, Vestidor
│  │  └─ scenes/         Pantallas: torre, sala de espera, partida, resumen
│  ├─ server/            Worker de entrada y Durable Object "Sala"
│  └─ balance/           Simulador sin pantalla: miles de partidas bot contra bot
├─ assets/              Fuentes de arte y audio (lo pesado se sube a R2)
├─ docs/                Diseño, decisiones técnicas y guía de estilo visual
└─ .github/workflows/   Pruebas en cada cambio y publicación en Cloudflare
```

## Mapa de dependencias

Las apps (`client`, `server`, `balance`) usan `content` y `protocol`, y todo termina en `core`. Las
tres apps también usan el núcleo directamente. Ninguna flecha sube: si el núcleo necesitara algo de
una app, el diseño está mal y se corrige.

## Red en una partida

La Sala corre el núcleo y es la única verdad. Los celulares envían intenciones y reciben fotos del
estado.

1. **Celular a Sala:** cada 33 ms el celular envía sus intenciones numeradas, en mensajes binarios
   pequeños por WebSocket.
2. **Sala:** avanza la simulación a 30 pasos por segundo con las intenciones de humanos y bots.
3. **Sala a celulares:** unas 20 veces por segundo envía una foto del estado, solo con lo que cambió.
4. **Tu mago:** el celular corre el mismo núcleo y predice tu movimiento al instante. Cuando llega la
   foto, corrige con suavidad si se desvió.
5. **Los demás:** se muestran unos 100 ms en el pasado, interpolados entre fotos, para que se vean
   fluidos.
6. **Tejidos visibles:** los orbes del rival viajan en cada foto, así que todos ven y oyen lo que se
   teje.
7. **Desconexión:** la Sala cambia el controlador de ese mago a la IA durante 60 segundos y lo
   devuelve si vuelve a conectarse.

Con jugadores en Chile y la Sala en Sudamérica, el retraso esperado es bajo; se medirá en el Hito 2.

## Rendimiento en el celular

La meta es 60 cuadros por segundo en un Android de gama media. Estos límites se revisan en cada hito
y, si se pasan, el cambio no entra.

| Presupuesto                     | Límite inicial                             |
| ------------------------------- | ------------------------------------------ |
| Llamadas de dibujo por cuadro   | Menos de 150                               |
| Triángulos en pantalla          | Menos de 150.000                           |
| Descarga inicial del juego      | Menos de 5 MB antes de la primera pantalla |
| Tiempo de un paso de simulación | Menos de 2 ms con 6 magos y sus bestias    |
| Memoria de texturas             | Menos de 128 MB                            |

- **Reutilizar objetos:** conjuros, partículas y proyectiles salen de piscinas preasignadas, para
  evitar pausas por limpieza de memoria.
- **Texturas comprimidas** (KTX2) y atlas compartidos.
- **Niveles de calidad** (bajo, medio y alto) que ajustan sombras, partículas y resolución. El juego
  elige uno al inicio según el teléfono.
- **Carga por partes:** lo pesado de cada arena se descarga mientras esperas en la sala.

## Convenciones y flujo de trabajo

Cada cambio entra por un pull request que pasa las pruebas automáticas antes de fusionarse a `main`,
y `main` siempre se puede jugar.

**Código**

- Nombres de código en inglés (`weaving`, `castSpell`); textos del juego en español.
- Un archivo por concepto, idealmente menos de 300 líneas. Carpetas por funcionalidad, no por tipo
  de archivo.
- Sin `any`, sin estado global mutable y sin `Math.random` ni el reloj dentro del núcleo.
- Cada paquete expone una API pública en su `index.ts`; nadie importa archivos internos de otro
  paquete.

**Pruebas**

- El núcleo tiene pruebas unitarias para el tejido, la fatiga, los hechizos y el daño.
- Pruebas de repetición: una partida grabada debe dar exactamente el mismo resultado al volver a
  correrla.
- El simulador de balance mide tasas de victoria (meta 45-55%).

**GitHub**

- Ramas cortas por funcionalidad y commits con formato convencional (`feat:`, `fix:`, `refactor:`).
- GitHub Actions corre formato, tipos y pruebas. Al fusionar a `main` publica en Cloudflare.
- Cada pull request tiene una vista previa jugable en su propio enlace.
- Las decisiones técnicas importantes quedan registradas en `docs/decisiones/`.

## Hitos de construcción

Cada hito termina en algo jugable que se puede probar desde un enlace.

0. **Cimientos:** repositorio, monorepo, formato, pruebas y publicación automática. _Hecho._
1. **El tejido se siente bien:** un mago contra un bot en una arena gris, con las dos cámaras para
   comparar. _Hecho._
2. **Jugar con amigos:** Sala en Cloudflare, enlace para WhatsApp, predicción, reconexión y bots que
   llenan los puestos vacíos. Duelo 1v1 en línea. _Pendiente: es lo siguiente grande._
3. **La partida completa:** mejor de 3, fases, zona, bestias, Glifos, Presagios, Espectro, Vidas y
   todos los modos. _Hecho contra la IA._
4. **Identidad del jugador:** perfiles sin cuenta, código de respaldo, Vestidor, Afinidad con
   transformación, Grimorio y rivalidades. _En parte: falta perfil en servidor y rivalidades._
5. **Se ve y suena como Ysmar:** guía de estilo, arte, modelos finales, acordes del tejido y música.
   _Pendiente._
6. **Balance y pulido:** simulador bot contra bot, ajuste de tablas y pruebas con amigos. _El
   simulador existe._
