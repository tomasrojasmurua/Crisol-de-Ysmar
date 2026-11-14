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

1. Genera el archivo con su prompt de [audio-elevenlabs.md](audio-elevenlabs.md) y descárgalo en
   `.mp3`.
2. Cópialo a `apps/client/public/audio/` con el nombre de la clave (por ejemplo `note.brasa.mp3`).
3. Anótalo en `apps/client/public/audio/manifest.json`: `{ "note.brasa": "note.brasa.mp3" }`.

Los efectos conviene recortarlos sin silencio al inicio: cualquier retraso se siente al tejer.

## Prompts para ElevenLabs

Están en [audio-elevenlabs.md](audio-elevenlabs.md): las 41 claves (efectos y música) con su
prompt, duración y si hacen loop, el estilo de cada elemento y un narrador opcional.
