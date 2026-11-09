# Crisol de Ysmar

Duelo de hechiceros para celular. La magia se **teje** en tiempo real combinando cinco elementos
(Brasa, Tormenta, Marea, Raíz y Umbra) y se juega entre amigos que entran a la sala con un enlace
de WhatsApp, sin instalar nada.

> Estado: **Hito 0, cimientos.** El repositorio, las pruebas y la publicación automática están listos;
> la pantalla actual es una arena de prueba con los orbes de los cinco elementos.

## Empezar

Requisitos: Node 22 y pnpm 10 (`corepack enable` lo instala).

```bash
pnpm install
pnpm dev          # juego web en http://localhost:5173 (también accesible desde tu celular en la misma red)
pnpm dev:server   # Worker y Sala en local con Wrangler
pnpm check        # formato, mapa de dependencias, tipos y pruebas
pnpm balance      # simulador sin pantalla
```

## Estructura

```text
packages/
  core/       Reglas puras y deterministas. No depende de nada.
  content/    Tablas de datos validadas: elementos, Afinidades, conjuros, Glifos, Presagios.
  protocol/   Mensajes entre el celular y la Sala.
apps/
  client/     Juego web (Vite + Three.js).
  server/     Worker de entrada y Durable Object "Sala" en Cloudflare.
  balance/    Simulador de partidas bot contra bot.
docs/         Diseño, arquitectura, publicación y decisiones técnicas.
```

Las dependencias solo apuntan hacia el núcleo; `pnpm check:deps` lo hace cumplir.
Más detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Documentación

- [Diseño del juego](docs/diseno.md)
- [Arquitectura del código](docs/arquitectura.md)
- [Publicación en Cloudflare](docs/publicacion.md)
- [Cómo contribuir](CONTRIBUTING.md)
- [Decisiones técnicas](docs/decisiones/)
