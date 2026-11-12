# Crisol de Ysmar · notas para Claude

Juego web de duelo de hechiceros para celular. Todo el texto para el jugador, los comentarios y la
documentación van en español; los identificadores de código en inglés.

- Diseño: `docs/diseno.md`. Arquitectura y reglas: `docs/arquitectura.md` y `CONTRIBUTING.md`.
- Antes de proponer un cambio, corre `pnpm check` (Biome, mapa de dependencias, tipos y Vitest).
- `packages/core` es puro y determinista: nada de imports externos, `Math.random`, `Date` ni DOM.
- Los números de balance van en `packages/content`, nunca en código.
- El juego es 100% original: no usar nombres, cartas, criaturas ni arte de otros juegos.

## Si llegas nuevo al proyecto

- Lee primero `docs/traspaso/README.md`: estado actual, decisiones tomadas, qué sigue, pendientes
  y cómo trabaja Tomás. Las copias de los documentos de otras cuentas están en
  `docs/traspaso/referencia/`.
- Un PR por frente; se fusiona apenas el CI está en verde (Tomás ya no escribe "merge").
- Prioridad: la fluidez del multijugador. Frente actual: "Listo para los 5" (prueba en red con
  amigos; contenido nuevo congelado).
- Si cambia la forma del estado, los eventos o los ajustes de sala, sube `PROTOCOL_VERSION`.
- Celular solo en horizontal: nada puede tapar los botones (revisa a 844×390).
