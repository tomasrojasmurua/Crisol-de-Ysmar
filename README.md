# Crisol de Ysmar

Duelo de hechiceros para celular. La magia se **teje** en tiempo real combinando cinco elementos
(Brasa, Tormenta, Marea, Raíz y Umbra) y se juega entre amigos que entran a la sala con un enlace
de WhatsApp, sin instalar nada.

> Estado: **versión completa contra la IA, etapa 1.** Partidas al mejor de 3 rondas contra hechiceros
> de la IA en duelo, equipos de 2 o 3 y todos contra todos hasta 6, con zona que se cierra,
> y la opción de 3 Vidas por ronda (en pausa) con aliados que se reviven.
> Se juega en [crisol-de-ysmar.pages.dev](https://crisol-de-ysmar.pages.dev).

## Cómo se juega

- **Menú:** eliges el modo. Al caer quedas fuera de la ronda y miras a quienes siguen en pie.
  **Vidas** (en pausa): 3 por ronda y reapareces en el borde.
- **Ronda:** hasta 3 minutos. Caza (abierta), Convergencia (la zona se cierra) y Duelo final.
  Gana el último equipo en pie, o el que tenga más vida si se acaba el tiempo.
- **Objetivo:** el rival más cercano se fija solo; toca a otro rival o a una bestia para cambiarlo.
- **Bestias:** cinco criaturas neutrales, una por elemento. Si cazas una ganas su **Esencia**:
  tus conjuros de ese elemento pegan más fuerte durante la ronda.
- **Santuarios:** aparecen en la Convergencia. Párate encima sin rivales cerca para tomarlo:
  recuperas vida y tu magia queda potenciada un rato.
- **Glifos:** entre rondas eliges 1 de 3 (4 si perdiste). Te acompañan hasta el final de la partida.
- **Presagio:** cada partida trae uno al azar que cambia las reglas para todos por igual.
- **Tu hechicero:** la primera vez eliges nombre y aspecto en el Vestidor (túnica, adornos, piel,
  cabeza y foco). Todo es cosmético y queda guardado en el celular.
- **Afinidad:** el hilo con que te unes. Ese elemento descansa 25% más rápido y sus dos opuestos 15%
  más lento, y te transforma: Brasa agrieta, Tormenta chisporrotea, Marea escarcha, Raíz brota y
  Umbra se deshace en humo. Los rivales de la IA también tienen una, así que puedes leerla.
- **Grimorio:** hay 155 conjuros con nombre propio. Cada uno que lanzas por primera vez se celebra
  y queda anotado.

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
- [Traspaso: estado actual y qué sigue](docs/traspaso/README.md)
