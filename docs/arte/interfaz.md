# Interfaz: letras y acabado de los cuadros

## Letras

- **Cinzel** para títulos, botones y etiquetas en mayúscula (calza con el logo).
- **Spectral** para todo el texto (serif de libro hecha para pantalla, se lee bien chica).
- Se sirven desde `apps/client/public/fonts/` (solo el subconjunto latino, ~93 KB en total), sin
  depender de Google. Licencia SIL OFL en esa misma carpeta.
- En CSS: `var(--display)` y `var(--text)`. No usar la letra del sistema.

## Piezas de los cuadros

Generadas con ChatGPT y pasadas a WebP en `apps/client/public/ui/` (~50 KB en total):

| Archivo          | Dónde va                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `boton.webp`     | Placa de todo botón `.primary` (con `border-image`, 9 cortes).                                  |
| `marco.webp`     | Marco de los cuadros grandes: tus esquinas y su línea son el borde (`border-image`, `--frame`). |
| `separador.webp` | Bajo los títulos `h2` de los cuadros.                                                           |
| `textura.webp`   | Piedra oscura de fondo, repetida.                                                               |

Son imágenes fijas: no agregan efectos ni trabajo por cuadro. Al montar una pieza nueva, revisar
que las esquinas no pisen botones ni texto a 844×390 y 667×375.

## Prompts para ChatGPT

### Cómo generarlos

1. En ChatGPT, pega primero la **guía de estilo** y después el prompt de la pieza, en el mismo
   mensaje. Pide **fondo transparente (PNG)** en las piezas que lo dicen.
2. Genera 2 o 3 versiones de cada una y quédate con la más **limpia y simétrica**. Que no traiga
   letras, sombras raras ni perspectiva (tiene que verse de frente, plana).
3. Tráelas con estos nombres: `esquina.png`, `separador.png`, `textura.png`, `boton.png`.
   Si quieres ver una dirección general primero, parte por el **mockup** (punto 0).

### Guía de estilo (va antes de cada prompt)

```text
Game UI asset for a mobile dark fantasy game set in an original world of five elemental lineages (ember, storm, tide, root, shadow). Style: solemn, ancient and handcrafted, like engraved antique gold and bronze inlaid on dark stone. Restrained ornament: thin elegant linework, small rune-like notches, a tiny diamond or four-pointed star as the recurring motif. Colors: warm muted gold #d8bf8a with brighter highlights #f3dfb0, on near-black #07070c / deep violet-black #0e0c14. Flat front view, perfectly symmetrical, crisp clean edges, no perspective, no text, no letters, no logos, no characters. Original design, not based on any existing game or franchise.
```

### 0 · Mockup de dirección (opcional, para decidir el estilo)

Sirve solo para mirar y elegir. No se usa dentro del juego.

```text
A landscape (wide 19.5:9) mockup of the main menu of a mobile game, dark fantasy. Left: a tall card with a hooded wizard portrait and a name plate below. Center: a large title logo area at the top, three hexagon-shaped mode buttons in a row, one wide primary hexagon button below them, and two secondary buttons at the bottom. Right: two small panels stacked. All panels are dark translucent stone with thin engraved gold borders and small ornate corner pieces; headings in elegant Roman capital letters, body text in a readable book serif. Show only placeholder text, keep it calm and legible, lots of breathing room.
```

### 1 · Esquina labrada (`esquina.png`) · la pieza más importante

Con una sola esquina armo las cuatro (la espejo) y el borde recto lo dibuja el CSS. Así cualquier
cuadro del menú, del Grimorio o de la sala queda "enmarcado" sin pesar casi nada.

```text
A single ornate corner piece for a UI panel frame, shown as the TOP-LEFT corner only. Two thin gold lines meet at a right angle, with a small engraved flourish and a tiny four-pointed star at the corner point. The two arms extend about 40% across the image and end cleanly so they can connect to a plain 2-pixel straight line. Square image 1024x1024, transparent background (PNG), no shadow, nothing else in the image.
```

### 2 · Separador de título (`separador.png`)

Va bajo los títulos como "Elige tu linaje", "Jugar con amigos" o "Grimorio".

```text
A horizontal ornamental divider line for a game UI title. A thin gold line that fades out at both ends, with a small central ornament: a diamond flanked by two tiny curled flourishes. Very thin and delicate, symmetrical left to right. Wide image 1536x256, the divider centered, transparent background (PNG), no shadow.
```

### 3 · Textura de fondo de los cuadros (`textura.png`)

Reemplaza el fondo liso de los cuadros. Muy oscura, para que el texto se siga leyendo.

```text
A seamless tileable texture of very dark polished stone with an extremely subtle violet tint and faint fine grain, like obsidian or slate. Low contrast, almost black (#0e0c14 average), no cracks, no bright spots, no pattern that repeats visibly. Square 1024x1024, must tile seamlessly on all edges.
```

### 4 · Placa del botón principal (`boton.png`) · solo si te gusta el mockup

La placa de "Entrar al Crisol". Hoy es un degradado; esto le daría metal de verdad.

```text
A wide hexagon-shaped button plate for a game UI (pointed left and right ends, flat top and bottom), seen from the front. Dark bronze-brown brushed metal face with a thin raised bright-gold bevel along the edge and a very subtle inner glow. Empty center for text, no text. Wide image 1536x384, transparent background (PNG), no drop shadow.
```
