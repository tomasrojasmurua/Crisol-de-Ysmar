# Crisol de Ysmar

Duelo de hechiceros para celular. La magia se **teje** en tiempo real combinando cinco elementos
(Brasa, Tormenta, Marea, Raíz y Umbra) y se juega entre amigos que entran a la sala con un enlace
de WhatsApp, sin instalar nada.

> Estado: **Hito 1, el tejido se siente bien.** Un duelo en el celular contra un hechicero de la IA,
> con los cinco elementos, tejido visible, fatiga, combate y cámara sobre el hombro.
> Se juega en [crisol-de-ysmar.pages.dev](https://crisol-de-ysmar.pages.dev).

## Cómo se juega (Hito 1)

- **Pulgar izquierdo:** toca y arrastra en cualquier parte de la mitad izquierda para moverte.
- **Pulgar derecho:** toca hasta tres elementos para tejer (el orden importa) y luego **✦** para lanzar.
  Tocar ✦ apunta solo al rival; arrastrar desde ✦ elige la dirección. **✕** deshace el tejido.
- **En computador:** WASD para moverte, 1 a 5 para tejer, espacio para lanzar y X para deshacer.

| Primer elemento | Forma     | Qué hace                                    |
| --------------- | --------- | ------------------------------------------- |
| Brasa           | Proyectil | Vuela recto y daña al primer rival que toca |
| Tormenta        | Salto     | Te lleva lejos y golpea al aterrizar        |
| Marea           | Muro      | Bloquea proyectiles y estalla al levantarse |
| Raíz            | Trampa    | Cae a los pies del rival y lo enraíza       |
| Umbra           | Marca     | Maldice al instante y te devuelve vida      |

Los elementos siguientes modifican el conjuro: Brasa quema, Tormenta acelera y alarga,
Marea ralentiza, Raíz enraíza y Umbra maldice. Marea apaga la quemadura y Tormenta golpea
más fuerte a quien está ralentizado. Cada elemento usado descansa 3 segundos.

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
