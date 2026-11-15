# Audio

Todo suena hoy con un sintetizador hecho en código (`apps/client/src/audio`). Cada sonido tiene
una clave; si aparece un archivo para esa clave, el juego lo usa y el sintetizado queda de
respaldo. No hay que tocar código para cambiar un sonido.

## Cómo está armado

| Archivo          | Qué hace                                                                             |
| ---------------- | ------------------------------------------------------------------------------------ |
| `AudioEngine.ts` | El contexto de audio (nace con el primer toque), buses, reverberación, silencio      |
| `voices.ts`      | La nota y el timbre de cada elemento, y la escala del Crisol                         |
| `Synth.ts`       | Los sonidos sintetizados: notas, acordes, explosiones, rayos, campanas, gong         |
| `SoundBank.ts`   | Las claves y los archivos de `public/audio/manifest.json`                            |
| `Music.ts`       | La música de cada momento (portada, Caza, Convergencia, Final), en archivo o en vivo |
| `GameAudio.ts`   | Traduce los eventos del núcleo a sonidos, con distancia y lado                       |
| `VoiceBank.ts`   | Las voces del Crisol y de los maestros, una a la vez                                 |

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
   `.mp3` con el nombre de la clave (por ejemplo `note.brasa.mp3`).
2. Pásalo por `scripts/audio-prepare.sh <carpeta>`: recorta el silencio del inicio (cualquier
   retraso se siente al tejer) y del final, nivela el volumen por tipo de sonido y deja la música
   lista para sonar en bucle sin costura. Escribe en `apps/client/public/audio/`.
3. Anótalo en `apps/client/public/audio/manifest.json`: `{ "note.brasa": "note.brasa.mp3" }`.

Hoy están los 40 efectos y pistas menos `guardianAwake` y `stepDone`, que siguen sintetizados.

La música no se decodifica entera (90 s ocuparían unos 30 MB por pista en el celular): suena desde
un `<audio>` conectado al bus de música. En el primer toque se prende y apaga cada pista, porque
iOS solo deja sonar un `<audio>` que partió durante un toque.

## Voces

El Crisol y los maestros hablan con archivos de clave `voice.…` en el mismo manifiesto
(`VoiceBank.ts`). Sin archivo no suena nada. Suena una frase a la vez; las del Crisol se cargan
al primer toque y las de los maestros cuando hacen falta. La lista está en
[audio-voces.md](audio-voces.md).

## Prompts para ElevenLabs

Están en [audio-elevenlabs.md](audio-elevenlabs.md): las 41 claves (efectos y música) con su
prompt, duración y si hacen loop, el estilo de cada elemento y un narrador opcional.
