# Crisol de Ysmar · notas para Claude

Juego web de duelo de hechiceros para celular. Todo el texto para el jugador, los comentarios y la
documentación van en español; los identificadores de código en inglés.

- Diseño: `docs/diseno.md`. Arquitectura y reglas: `docs/arquitectura.md` y `CONTRIBUTING.md`.
- Antes de proponer un cambio, corre `pnpm check` (Biome, mapa de dependencias, tipos y Vitest).
- `packages/core` es puro y determinista: nada de imports externos, `Math.random`, `Date` ni DOM.
- Los números de balance van en `packages/content`, nunca en código.
- El juego es 100% original: no usar nombres, cartas, criaturas ni arte de otros juegos.
