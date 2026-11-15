# Ícono de la app

Arte de Tomás (ChatGPT): los cinco linajes en sus esferas sobre un pentagrama de bronce, con el
cristal al centro y el marco dorado. El original está en `icono-original.webp`.

Para regenerar los íconos después de cambiar el arte: `python3 scripts/icono.py` (necesita
Pillow). Escribe en `apps/client/public/`:

| Archivo                            | Uso                                                            |
| ---------------------------------- | -------------------------------------------------------------- |
| `apple-touch-icon.png`             | iPhone, 180×180, sin transparencia: iOS redondea las esquinas. |
| `icon-192.png`, `icon-512.png`     | Android y PWA, con el marco dorado.                            |
| `icon-maskable-512.png`            | Android con forma propia (círculo, gota): sin el marco.        |
| `favicon-32.png`, `favicon-48.png` | Pestaña del navegador, con esquinas redondeadas.               |

## Por qué se procesa

- **Esquinas negras.** El arte trae el marco redondeado sobre negro. iOS recorta con su propio
  redondeo, que no calza exacto, y quedaría una cuña negra en cada esquina: el script estira el
  dorado del marco hacia afuera para taparla.
- **Android maskable.** El sistema puede recortar un círculo; el marco se vería cortado a pedazos,
  así que esa versión se recorta por dentro del marco. Las esferas quedan dentro del círculo.

Un celular que ya tenía el juego en la pantalla de inicio guarda el ícono viejo: hay que quitarlo
y volver a agregarlo.
