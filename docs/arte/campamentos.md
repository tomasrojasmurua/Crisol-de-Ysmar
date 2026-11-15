# Fondos del menú: los campamentos de los Linajes

Un fondo ilustrado por Linaje para el menú: el campamento de tu Linaje a las puertas del Crisol
(ver [lore.md](../lore.md)). Se generan con ChatGPT y el juego los usa apenas existe el archivo;
mientras no exista, el menú muestra el Crisol 3D de siempre.

## Cómo generarlos

1. En ChatGPT, pide la imagen **en formato horizontal (apaisado)**. Copia primero la guía de
   estilo y después el prompt del Linaje, en el mismo mensaje.
2. Genera 2 o 3 versiones y quédate con la que tenga **el centro más tranquilo**: el menú pone
   el logo, los botones y las tarjetas encima, así que lo interesante tiene que estar en el
   horizonte y en los bordes de arriba y abajo.
3. Tráelas como `brasa.png`, `tormenta.png`, `marea.png`, `raiz.png` y `umbra.png`. Yo las
   recorto a 16:9, las paso a `.webp` livianas (unos 200 KB) y las dejo en
   `apps/client/public/campamento/`.

Las de mayor impacto primero: la de tu Linaje y la del Linaje que más juegan tus amigos.

## Guía de estilo (va antes de cada prompt)

```text
Wide landscape background illustration for the main menu of a mobile dark fantasy game. Stylized painterly dark fantasy, muted desaturated colors (stone, ash, fog), dramatic low-key lighting; the only intense colors are magical lights. Night scene. In the far distance on the horizon, a colossal ancient circular stone arena carved with faintly glowing runes, the Crucible, with five threads of light rising from it into the sky. The middle of the image must be calm, dark and low in detail, because menu buttons will be placed on top of it; put the interesting details near the horizon line and along the left and right edges. No characters in the foreground, no text, no logos, no UI, no frames. Original world, not based on any existing game or franchise.
```

## Un prompt por Linaje

**Brasa · Cenizal** (`brasa.png`)

```text
The war camp of a volcanic people at the edge of a black basalt plateau. Iron braziers full of glowing embers, forge anvils, tents of soot-stained red leather, banners with a flame sigil, rivers of cooling lava far away, embers drifting in the air. Warm orange and deep red light against charcoal stone.
```

**Tormenta · Velgar** (`tormenta.png`)

```text
The camp of a free mountain people on a high windswept cliff ledge. Long cloth banners and ribbons whipped by the wind, light tents anchored with ropes to the rock, wind chimes, metal lightning rods on poles, a storm swirling in the clouds with silent pale-blue lightning. Cold white and electric blue light against grey granite.
```

**Marea · Hondamar** (`marea.png`)

```text
The camp of a melancholic sea people on a frozen shore. An old wooden pier coated in ice, small boats trapped in frozen water, rows of candles in glass jars along the shore, stone stelae engraved with countless names, mist over a dark calm sea. Teal and deep blue light, cold and quiet.
```

**Raíz · el bosque de Anvel** (`raiz.png`)

```text
The camp of a forest people among colossal ancient trees with enormous roots. Tents woven from branches and moss, hanging lanterns made of glowing seeds, mushrooms and ferns, a communal fire, roots arching like bridges. Soft green and warm amber light in a humid, protective forest.
```

**Umbra · la grieta de Ossel** (`umbra.png`)

```text
The hidden camp of a secretive people at the lip of a bottomless ravine. Dark hooded tents half lost in violet mist, veils of black cloth floating in the air, narrow stone stairs descending into darkness, a few eyes of faint light watching from the abyss. Deep violet and cold purple light, almost everything in shadow.
```

## Cómo los usa el juego

`Menu.ts` pide `campamento/<elemento>.webp` según tu Linaje. Si carga, tapa el Crisol 3D con la
ilustración, salvo una ventana donde se dibuja tu mago (el lienzo 3D sigue detrás). Encima va el
velo oscuro del menú y el resplandor del color de tu Linaje, así que la imagen puede ser un poco
más clara de lo que se verá.
