# Cómo contribuir

`main` siempre se puede jugar. Todo cambio entra por un pull request que pasa CI.

## Flujo

1. Crea una rama corta por funcionalidad: `feat/tejido-fatiga`, `fix/reconexion`.
2. Usa commits con formato convencional: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
3. Corre `pnpm check` antes de abrir el pull request.
4. Cada pull request publica una vista previa jugable (cuando Cloudflare está configurado).

## Reglas del código

- **TypeScript estricto.** Sin `any` y sin `!` para silenciar nulos.
- **El núcleo es puro.** `packages/core` no importa nada externo, no usa `Math.random`, `Date` ni
  el DOM. El azar viene de `SeededRng` y el tiempo de los pasos de simulación.
- **Las dependencias apuntan al núcleo.** Ninguna app importa otra; nadie importa archivos
  internos de otro paquete, solo su `index.ts`.
- **Los datos mandan.** Números de balance (daño, tiempos, fatiga) viven en `packages/content`.
- **Dibujar no es simular.** El cliente lee el estado y lo interpola; nunca cambia reglas.
- **La interfaz no tiene lógica de juego.** Muestra estado y envía intenciones.
- **Archivos pequeños.** Un concepto por archivo, idealmente menos de 300 líneas, carpetas por
  funcionalidad.
- **Idioma.** Identificadores de código en inglés; textos del juego, comentarios y documentación
  en español. Los nombres propios del juego (`brasa`, `umbra`) se mantienen tal cual.

## Pruebas

- Todo lo que entra al núcleo trae pruebas (`*.test.ts` junto al archivo).
- Desde el Hito 1 habrá pruebas de repetición: una partida grabada debe dar el mismo resultado.
