# Audio con ElevenLabs: los prompts

La lista para generar en ElevenLabs todo el audio del juego. Cubre las 41 claves que el juego ya
sabe pedir (`apps/client/src/audio/SoundBank.ts`) más un narrador opcional. Mientras un archivo no
exista, esa clave sigue sonando sintetizada, así que se puede avanzar de a poco.

Los prompts van en inglés porque ElevenLabs entiende mejor así; las frases del narrador van en
español porque es lo que oye el jugador. Todo es original: los prompts no nombran juegos, artistas
ni obras.

## Antes de empezar

- **Efectos:** herramienta _Sound Effects_. Escribe la duración a mano (no la dejes en
  automático) y sube _Prompt influence_ a cerca del 70% para que respete el prompt. Genera 3 o 4
  versiones y quédate con la que tenga el ataque más limpio. El mínimo que acepta es 0,5 s: los
  sonidos más cortos se generan a 0,5 s y se recortan después (yo los recorto si quieres).
- **Música:** herramienta _Music_, modo instrumental. 90 s cada pista. Si la versión que elijas no
  empalma bien al repetirse, la ajusto yo al integrarla.
- **Voz:** _Voice Design_ para crear la voz del narrador y luego _Text to Speech_ con esa voz.
- **Formato:** `.mp3` (44,1 kHz, 128 kbps o más). Nombre del archivo = la clave + `.mp3`, por
  ejemplo `note.brasa.mp3`. Tráelos todos juntos o por grupos; yo los copio a
  `apps/client/public/audio/` y los anoto en el manifiesto.
- **Sin silencio al inicio:** cualquier retraso se siente al tejer. Si el archivo trae aire antes
  del golpe, no importa: lo recorto.
- **Loop:** solo la música hace loop. Los efectos suenan una vez.

## El estilo

**Común a todo:** fantasía oscura, estilizada y limpia. **Metal arcano** como hilo conductor:
metal forjado y grabado con runas, cuencos y platillos frotados con arco, campanas de bronce,
cadenas, yunques. La magia suena brillante y con color; el mundo, grave y de piedra.

Cada elemento tiene su identidad y su nota (el tejido suena como un acorde, por eso las notas de
elemento deben quedar afinadas):

| Elemento | Nota     | Identidad sonora                                                                 |
| -------- | -------- | -------------------------------------------------------------------------------- |
| Brasa    | Do (C4)  | Fragua: brasas que crujen, hierro al rojo martillado, fuelle que sopla, cálido   |
| Tormenta | Sol (G4) | Arco eléctrico: estática, chispazo seco, vidrio que vibra, trueno lejano         |
| Marea    | Re (D4)  | Agua profunda: burbuja, ola que se hincha, armónica de cristal, redondo y húmedo |
| Raíz     | La (A3)  | Madera y tierra: tronco hueco golpeado, raíces que crujen, piedra, seco          |
| Umbra    | Mi (E3)  | Vacío: aire al revés, susurros sin palabras, metal frotado grave, frío           |

Para que todo suene a un mismo juego, cada prompt de efecto termina con el sufijo común. **Copia
cada prompt tal cual: el sufijo ya va incluido.**

> Sufijo común: `dark fantasy game sound, stylized and clean, no voice, no music, starts
> instantly with no silence`

## 1. Efectos (37)

### 1.1 Notas de elemento: al tejer

Suenan cada vez que tocas un elemento (y más bajo cuando teje el rival). Son lo que más se oye del
juego: **prioridad alta**. Tienen que ser una sola nota clara y afinada. Si alguna sale desafinada,
dímelo y la afino al integrarla.

**`note.brasa.mp3`** · 0,5 s · sin loop

```text
Single magical tone tuned exactly to C4, warm sawtooth-like glow, crackling ember sparks on the attack, faint hammered hot metal ring, short glowing tail, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`note.tormenta.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop

```text
Single magical tone tuned exactly to G4, bright electric buzz with fast trembling vibrato, crisp static sparkle on the attack, glassy ring, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`note.marea.mp3`** · 0,6 s · sin loop

```text
Single magical tone tuned exactly to D4, round soft sine-like tone like a glass harmonica, small bubble on the attack, gentle swelling wave, wet watery tail, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`note.raiz.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop

```text
Single magical tone tuned exactly to A3, plucked hollow wooden marimba-like knock, earthy and dry, tiny creak of living wood, short tail, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`note.umbra.mp3`** · 0,7 s · sin loop

```text
Single magical tone tuned exactly to E3, dark breathy bowed-metal drone that swells slowly, cold wordless whisper texture underneath, faint reversed air, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`untie.mp3`** · 0,5 s (recortar a 0,2 s) · sin loop · al deshacer el tejido

```text
Soft magical thread snapping loose and unraveling, short descending pluck with a tiny metallic shimmer, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.2 Lanzamiento: cuando el hechizo sale

Suena según el primer elemento del tejido. **Prioridad alta.**

**`release.brasa.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop

```text
Fire spell launching from a hand, fast roaring whoosh of flame like a forge bellows blast, sparks trailing, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`release.tormenta.mp3`** · 0,5 s (recortar a 0,3 s) · sin loop

```text
Lightning spell launching, sharp electric crack like a tesla arc, quick rush of charged air, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`release.marea.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop

```text
Water spell launching, pressurized jet of water surging forward, splashy rushing wave, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`release.raiz.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop

```text
Earth and nature spell launching, thick vines whipping through the air, leaves rustling, gritty pebbles, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`release.umbra.mp3`** · 0,5 s · sin loop

```text
Shadow spell launching, dark hissing whoosh that sounds partly reversed, cold wind, faint wordless ghostly whispers, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.3 Estallido: cuando el hechizo explota o cae una zona

Suena desde donde explota, con distancia. **Prioridad alta.**

**`burst.brasa.mp3`** · 1 s · sin loop

```text
Magical fire explosion, deep punchy thump, burst of crackling flames, hot metal clang ringing out, embers raining down, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`burst.tormenta.mp3`** · 1 s · sin loop

```text
Lightning strike hitting the ground, explosive electric boom, sizzling static tail, short thunder rumble, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`burst.marea.mp3`** · 1 s · sin loop

```text
Magical water geyser erupting, heavy splash and spray, deep underwater whomp, droplets falling, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`burst.raiz.mp3`** · 1 s · sin loop

```text
Giant thorns bursting out of the ground, cracking wood and splitting earth, stones tumbling, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`burst.umbra.mp3`** · 1 s · sin loop

```text
Shadow implosion, deep reversed boom sucking inward, low bowed metal groan, ghostly wordless whispers fading, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.4 Hechizos especiales

**`zap.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop · rayos, cadenas y líneas

```text
Chain lightning zap jumping between targets, bright electric crackle, thin snapping arcs, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`blink.mp3`** · 0,5 s (recortar a 0,3 s) · sin loop · teletransporte

```text
Magical short-range teleport, quick rising air whoosh with a soft glassy pop at the end, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`vine.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop · enredadera que atrapa

```text
Living vine lashing out and wrapping around someone, creaking wood, tight squeeze of leaves and bark, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.5 Golpes y choques

**`hurt.mp3`** · 0,5 s (recortar a 0,2 s) · sin loop · te golpean

```text
Magical hit on a robed wizard, dull cloth thud with a small sharp spark, short and punchy, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`hurtHeavy.mp3`** · 0,5 s (recortar a 0,3 s) · sin loop · te golpean fuerte

```text
Heavy magical hit on a wizard, deep punchy body impact, crunch of armor and a bright crackle, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`confirm.mp3`** · 0,5 s (recortar a 0,1 s) · sin loop · tú le pegaste a alguien

```text
Tiny bright crystalline tick, satisfying confirmation of a hit, very short, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`clang.mp3`** · 0,6 s · sin loop · un escudo bloquea un hechizo

```text
Spell blocked by a magic shield, metallic ring of rune-etched steel, bright shimmering resonance, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`combo.mp3`** · 0,6 s · sin loop · reacción entre estados o choque de hechizos

```text
Two magic threads colliding, bright rising sparkle with an electric snap, metallic chime burst, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`fizzle.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop · el hechizo falla

```text
Failed spell fizzling out, sputtering hiss like water on hot metal, weak deflating crackle, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`summonGone.mp3`** · 0,5 s (recortar a 0,4 s) · sin loop · una invocación desaparece

```text
Summoned magical creature dissolving into smoke, soft whoosh and fading sparkle, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.6 Mapa, bestias y momentos de la ronda

**`beastSlain.mp3`** · 1,5 s · sin loop · cae una bestia

```text
Jungle beast defeated, short dying growl dissolving into a mystical bronze chime reward, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`guardianAwake.mp3`** · 1,5 s · sin loop · despierta el Guardián (prioridad baja: está en pausa)

```text
Huge ancient stone guardian awakening, deep grinding roar, heavy rumble of moving rock, chains of rune-etched metal snapping, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`shrinesAppear.mp3`** · 2 s · sin loop · aparecen los santuarios

```text
Ancient stone shrines rising from the ground, resonant bronze bell tolling once, stone grinding, magical hum, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`shrineClaimed.mp3`** · 2 s · sin loop · alguien toma un santuario

```text
Shrine captured, bright sacred bell ringing with a shimmering magical swell, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`defeated.mp3`** · 3 s · sin loop · cae un mago

```text
Wizard falls in an arena, deep low gong strike, magic draining away with a fading shimmer, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`phase.convergence.mp3`** · 2,5 s · sin loop · empieza la Convergencia (la zona se cierra)

```text
Arena walls closing in, low bronze gong strike, rumbling stone grinding inward, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`phase.final.mp3`** · 4 s · sin loop · empieza el Duelo final (también la muerte súbita)

```text
Final duel begins, massive low gong strike, tension rising with bowed metal screech and deep rumble, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

### 1.7 Final de partida e interfaz

**`victory.mp3`** · 4 s · sin loop · ganaste

```text
Short triumphant magical fanfare, ascending notes in A minor pentatonic, bronze bells and bright shimmer, ending on a resolved chord, dark fantasy game sound, stylized and clean, no voice, starts instantly with no silence
```

**`defeat.mp3`** · 4 s · sin loop · perdiste

```text
Short somber magical sting, descending notes in A minor pentatonic, low bowed metal and a fading gong, dark fantasy game sound, stylized and clean, no voice, starts instantly with no silence
```

**`discover.mp3`** · 2 s · sin loop · descubres un hechizo nuevo

```text
New spell discovered, shimmering crystalline bell with a magical sparkle swell, wondrous and rewarding, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

**`click.mp3`** · 0,5 s (recortar a 0,1 s) · sin loop · botones del menú

```text
Soft UI click, tap on old parchment over dark wood with a tiny metallic tick, very short, dark fantasy game sound, stylized and clean, no voice, no music, starts instantly with no silence
```

## 2. Música (4)

Una pista por momento. Todas **en loop**, 90 s, instrumentales y en **La menor pentatónica**
(La, Do, Re, Mi, Sol: las mismas notas de los elementos, así el tejido suena dentro de la música).
Que no tengan un final marcado ni un inicio con silencio: deben poder repetirse sin que se note.

**`music.menu.mp3`** · 90 s · **loop** · portada y menús

```text
Instrumental dark fantasy ambient loop, 56 bpm, A minor pentatonic. Slow low drone, sparse harp-like plucks, distant bronze bells, soft bowed metal shimmer. Mysterious and inviting, like an ancient arena at rest. No vocals. No intro and no ending, constant energy so it loops seamlessly.
```

**`music.hunt.mp3`** · 90 s · **loop** · la Caza (primer minuto de la ronda)

```text
Instrumental dark fantasy exploration loop, 72 bpm, A minor pentatonic. Low drone, plucked harp and wooden mallets, light hand percussion, quiet tension like stalking prey in a dark jungle. Calm but alert. No vocals. No intro and no ending, constant energy so it loops seamlessly.
```

**`music.convergence.mp3`** · 90 s · **loop** · la Convergencia (la zona se cierra)

```text
Instrumental dark fantasy battle loop, 84 bpm, A minor pentatonic. Heartbeat war drums, anvil and metal percussion hits, pulsing low strings, bowed metal swells, tension building as the walls close in. No vocals. No intro and no ending, constant energy so it loops seamlessly.
```

**`music.final.mp3`** · 90 s · **loop** · el Duelo final y la muerte súbita

```text
Instrumental dark fantasy final duel loop, 108 bpm, A minor pentatonic. Driving war drums and anvil hits, urgent staccato strings, heavy distorted low cello riff with an arcane metal edge, ritual choir pads without words. Intense and urgent, life or death. No vocals. No intro and no ending, constant energy so it loops seamlessly.
```

## 3. Voz: el narrador (opcional)

Un anunciador que canta los momentos de la partida. **Hoy el juego no tiene dónde usarlo**: si te
gusta cómo queda, lo conecto en un cambio chico. Por eso va al final.

**Crear la voz** en _Voice Design_ con esta descripción:

```text
Deep, aged male narrator voice, calm and solemn, speaks Spanish with a neutral Latin American accent. Sounds like the ancient keeper of a magical arena: grave, measured, slightly echoing, with quiet authority. Not theatrical, not cartoonish.
```

**Generar cada frase** en _Text to Speech_ con esa voz (estabilidad media, unos 50%). Un archivo
por frase, `.mp3`, sin silencio al inicio ni al final.

| Archivo                  | Cuándo suena                   | Texto                             |
| ------------------------ | ------------------------------ | --------------------------------- |
| `voice.round1.mp3`       | Empieza la ronda 1             | Primera ronda.                    |
| `voice.round2.mp3`       | Empieza la ronda 2             | Segunda ronda.                    |
| `voice.round3.mp3`       | Empieza la ronda 3             | Ronda decisiva.                   |
| `voice.hunt.mp3`         | Empieza la Caza                | Que comience la caza.             |
| `voice.convergence.mp3`  | Empieza la Convergencia        | El Crisol se cierra.              |
| `voice.final.mp3`        | Empieza el Duelo final         | Duelo final.                      |
| `voice.sudden.mp3`       | Empieza la muerte súbita       | Muerte súbita. Solo uno saldrá.   |
| `voice.firstBlood.mp3`   | Cae el primer mago de la ronda | La Trama se cobra el primer hilo. |
| `voice.lastStanding.mp3` | Gana la ronda                  | Último en pie.                    |
| `voice.victory.mp3`      | Ganas la partida               | Victoria. La Trama es tuya.       |
| `voice.defeat.mp3`       | Pierdes la partida             | Derrota. Tu hilo se ha cortado.   |
| `voice.draw.mp3`         | Empate                         | Empate. Ningún hilo prevalece.    |
| `voice.guardian.mp3`     | Despierta el Guardián          | El Guardián del Crisol despierta. |
| `voice.discover.mp3`     | Descubres un hechizo nuevo     | Un nuevo tejido.                  |

## Orden sugerido

1. Las 5 notas, `untie` y los 5 lanzamientos: es lo que se oye a cada segundo.
2. Los 5 estallidos y los golpes (`hurt`, `hurtHeavy`, `confirm`, `clang`, `combo`, `fizzle`).
3. La música de la Caza y del Duelo final.
4. Todo lo demás. El narrador, al final y solo si te convence la idea.
