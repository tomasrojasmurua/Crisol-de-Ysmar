# 0001 · Monorepo en TypeScript sobre Cloudflare

- **Estado:** aceptada
- **Fecha:** 2026-11-09

## Contexto

El juego corre en el navegador del celular, en un servidor de salas y en un simulador de balance.
Las tres partes deben aplicar exactamente las mismas reglas.

## Decisión

Un solo repositorio con pnpm workspaces y TypeScript estricto en todas partes. Las reglas viven en
`packages/core`, que es puro y determinista, y lo usan el cliente (Vite + Three.js), el servidor
(Cloudflare Workers + Durable Objects) y el simulador (Node).

## Consecuencias

- Una regla se escribe una vez y se prueba una vez.
- El núcleo no puede usar el DOM, la red ni el reloj; un script lo verifica en CI.
- Biome reemplaza a ESLint y Prettier para tener una sola herramienta de estilo.
