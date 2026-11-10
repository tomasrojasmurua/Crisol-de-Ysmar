import type { ElementId } from '@crisol/core';

/**
 * La voz de cada elemento. El pentágono sigue el círculo de quintas (Do, Sol, Re, La, Mi):
 * dos vecinos suenan a quinta y se funden; dos opuestos quedan a un tono y rozan.
 * Por eso un tejido de vecinos suena a acorde y uno de opuestos suena tenso.
 */
export interface ElementVoice {
  /** Frecuencia de la nota, en Hz. */
  readonly freq: number;
  readonly wave: OscillatorType;
  /** Filtro pasa bajos donde empieza la nota y donde termina. */
  readonly brightFrom: number;
  readonly brightTo: number;
  readonly attack: number;
  readonly decay: number;
  /** Segunda voz desafinada, en cents, para engrosar. 0 la apaga. */
  readonly detune: number;
  /** Vibrato: frecuencia en Hz y profundidad en cents. */
  readonly vibratoHz: number;
  readonly vibratoCents: number;
  /** Ruido mezclado al ataque (chisporroteo, lluvia, viento). */
  readonly noise: number;
  readonly noiseFreq: number;
  /** Cuánto va a la reverberación. */
  readonly wet: number;
}

export const ELEMENT_VOICES: Readonly<Record<ElementId, ElementVoice>> = {
  // Brasa: Do. Diente de sierra cálido con chisporroteo.
  brasa: {
    freq: 261.63,
    wave: 'sawtooth',
    brightFrom: 3200,
    brightTo: 700,
    attack: 0.005,
    decay: 0.38,
    detune: 9,
    vibratoHz: 0,
    vibratoCents: 0,
    noise: 0.22,
    noiseFreq: 2600,
    wet: 0.5,
  },
  // Tormenta: Sol. Cuadrada brillante que tiembla.
  tormenta: {
    freq: 392,
    wave: 'square',
    brightFrom: 5200,
    brightTo: 1600,
    attack: 0.003,
    decay: 0.3,
    detune: 0,
    vibratoHz: 11,
    vibratoCents: 22,
    noise: 0.14,
    noiseFreq: 6000,
    wet: 0.7,
  },
  // Marea: Re. Seno doble, redondo, que llega como ola.
  marea: {
    freq: 293.66,
    wave: 'sine',
    brightFrom: 1400,
    brightTo: 2400,
    attack: 0.04,
    decay: 0.5,
    detune: 14,
    vibratoHz: 4.5,
    vibratoCents: 10,
    noise: 0.08,
    noiseFreq: 900,
    wet: 0.9,
  },
  // Raíz: La grave. Triángulo pulsado, como madera.
  raiz: {
    freq: 220,
    wave: 'triangle',
    brightFrom: 2600,
    brightTo: 500,
    attack: 0.002,
    decay: 0.34,
    detune: 0,
    vibratoHz: 0,
    vibratoCents: 0,
    noise: 0.1,
    noiseFreq: 420,
    wet: 0.35,
  },
  // Umbra: Mi grave. Dos sierras oscuras que se hinchan despacio.
  umbra: {
    freq: 164.81,
    wave: 'sawtooth',
    brightFrom: 500,
    brightTo: 1100,
    attack: 0.07,
    decay: 0.55,
    detune: 22,
    vibratoHz: 0.8,
    vibratoCents: 14,
    noise: 0.05,
    noiseFreq: 300,
    wet: 1,
  },
};

/** Escala pentatónica del Crisol (las cinco notas, en varias octavas) para la música. */
export const CRISOL_SCALE: readonly number[] = [
  110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392, 440,
];
