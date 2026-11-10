# Audio

Todo suena hoy con un sintetizador hecho en código (`apps/client/src/audio`). Cada sonido tiene
una clave; si aparece un archivo para esa clave, el juego lo usa y el sintetizado queda de
respaldo. No hay que tocar código para cambiar un sonido.

## Cómo está armado

| Archivo          | Qué hace                                                                        |
| ---------------- | ------------------------------------------------------------------------------- |
| `AudioEngine.ts` | El contexto de audio (nace con el primer toque), buses, reverberación, silencio |
| `voices.ts`      | La nota y el timbre de cada elemento, y la escala del Crisol                    |
| `Synth.ts`       | Los sonidos sintetizados: notas, acordes, explosiones, rayos, campanas, gong    |
| `SoundBank.ts`   | Las claves y los archivos de `public/audio/manifest.json`                       |
| `Music.ts`       | Música generada en vivo según el momento (portada, Caza, Convergencia, Final)   |
| `GameAudio.ts`   | Traduce los eventos del núcleo a sonidos, con distancia y lado                  |

- **Cada elemento es una nota** del círculo de quintas en el orden del pentágono: Brasa Do,
  Tormenta Sol, Marea Re, Raíz La, Umbra Mi. Vecinos suenan a quinta (se funden) y opuestos a un
  tono (rozan), así que **el tejido suena como un acorde** y un tejido de opuestos suena tenso.
- Tus notas suenan al tocar (sin esperar al servidor). El tejido del rival también se oye, más
  bajo y desde donde está: leer al rival también es escucharlo.
- Los sonidos lejanos bajan de volumen (a la mitad a 9 m) y se escuchan del lado en que están
  respecto de la cámara.
- El botón **Sonido** del menú pasa por: música y efectos → solo efectos → silencio. Se guarda en
  `crisol.sonido`.

## Cómo agregar los sonidos de ElevenLabs

1. Genera el archivo con el prompt de la tabla y descárgalo en `.mp3`.
2. Cópialo a `apps/client/public/audio/` con el nombre de la clave (por ejemplo `note.brasa.mp3`).
3. Anótalo en `apps/client/public/audio/manifest.json`: `{ "note.brasa": "note.brasa.mp3" }`.

Los efectos conviene recortarlos sin silencio al inicio: cualquier retraso se siente al tejer.

## Prompts para ElevenLabs

Estilo común para todos los efectos: _dark fantasy, stylized, clean, no voice, no music, dry
start with no silence._ Las notas de elemento deben quedar afinadas en su nota para que el acorde
siga funcionando.

| Clave                       | Duración | Prompt                                                                                           |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `note.brasa`                | 0,5 s    | Single warm magical tone tuned to C4, crackling embers on the attack, short glowing tail         |
| `note.tormenta`             | 0,4 s    | Single bright electric magical tone tuned to G4, crisp static sparkle, trembling vibrato         |
| `note.marea`                | 0,6 s    | Single round watery magical tone tuned to D4, soft bubble and wave swell, gentle tail            |
| `note.raiz`                 | 0,4 s    | Single woody plucked magical tone tuned to A3, hollow wooden knock, earthy                       |
| `note.umbra`                | 0,7 s    | Single dark breathy magical tone tuned to E3, slow swell, whispering shadow texture              |
| `untie`                     | 0,2 s    | Soft magical thread snapping loose, short descending pluck                                       |
| `release.brasa`             | 0,4 s    | Fire spell launching, fast whoosh of flame                                                       |
| `release.tormenta`          | 0,3 s    | Lightning spell launching, sharp electric crack and air rush                                     |
| `release.marea`             | 0,4 s    | Water spell launching, splashy rushing wave                                                      |
| `release.raiz`              | 0,4 s    | Nature spell launching, vines whipping and leaves rustling                                       |
| `release.umbra`             | 0,5 s    | Shadow spell launching, dark hissing whoosh with whispers                                        |
| `burst.brasa`               | 1 s      | Magical fire explosion, deep thump and crackling flames                                          |
| `burst.tormenta`            | 1 s      | Thunder strike explosion, electric boom with sizzling tail                                       |
| `burst.marea`               | 1 s      | Water geyser burst, heavy splash and spray                                                       |
| `burst.raiz`                | 1 s      | Thorns bursting from the ground, cracking wood and earth                                         |
| `burst.umbra`               | 1 s      | Shadow implosion, deep reversed boom with ghostly whispers                                       |
| `zap`                       | 0,4 s    | Chain lightning zap, bright crackle                                                              |
| `blink`                     | 0,3 s    | Magical teleport, quick rising air whoosh                                                        |
| `vine`                      | 0,4 s    | Living vine lashing out and grabbing                                                             |
| `hurt`                      | 0,2 s    | Magical hit on a robed wizard, dull thud with a small spark                                      |
| `hurtHeavy`                 | 0,3 s    | Heavy magical hit, deep punchy impact                                                            |
| `confirm`                   | 0,1 s    | Tiny bright crystalline tick confirming a hit                                                    |
| `clang`                     | 0,6 s    | Spell blocked by a magic shield, metallic ring                                                   |
| `fizzle`                    | 0,4 s    | Failed spell fizzling out, sputtering hiss                                                       |
| `summonGone`                | 0,4 s    | Summoned creature dissolving into smoke                                                          |
| `beastSlain`                | 1,5 s    | Beast defeated, mystical chime reward                                                            |
| `guardianAwake`             | 1,5 s    | Huge ancient stone guardian awakening, deep roar and rumble                                      |
| `shrinesAppear`             | 2 s      | Ancient shrines rising, resonant bell and stone grinding                                         |
| `shrineClaimed`             | 2 s      | Shrine captured, bright sacred bell                                                              |
| `defeated`                  | 3 s      | Wizard falls in an arena, deep gong with fading magic                                            |
| `phase.convergence`         | 2,5 s    | Arena walls closing in, low gong and rumbling stone                                              |
| `phase.final`               | 4 s      | Final duel begins, massive low gong with rising tension                                          |
| `victory`                   | 4 s      | Short triumphant magical fanfare, ascending pentatonic notes                                     |
| `defeat`                    | 4 s      | Short somber magical sting, descending notes                                                     |
| `discover`                  | 2 s      | New spell discovered, shimmering crystalline bell                                                |
| `click`                     | 0,1 s    | Soft UI click, parchment and wood                                                                |
| `music.menu` (Music)        | 90 s     | Dark fantasy ambient loop, slow drone, sparse pentatonic plucks, mysterious, seamless loop       |
| `music.hunt` (Music)        | 90 s     | Dark fantasy exploration loop, 72 bpm, low drone, pentatonic harp, tense but calm, seamless loop |
| `music.convergence` (Music) | 90 s     | Dark fantasy battle loop, 84 bpm, heartbeat drums, building tension, pentatonic, seamless loop   |
| `music.final` (Music)       | 90 s     | Dark fantasy final duel loop, 108 bpm, driving drums, urgent strings, pentatonic, seamless loop  |
