/**
 * Escribe la tabla de frases de los maestros para `docs/audio-voces.md`: cada frase con el nombre
 * de su archivo. Si cambias una frase en `packages/content/src/masters.ts`, vuelve a correrlo:
 *
 *   npx tsx scripts/voice-lines.ts
 *
 * Lo pega entre las marcas `<!-- frases -->` del documento.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { MASTERS } from '../packages/content/src/masters';

const GROUPS = [
  ['welcome', 'Al tocar su Linaje en la elección'],
  ['win', 'Ganaste'],
  ['closeWin', 'Ganaste en la ronda decisiva'],
  ['loss', 'Perdiste'],
  ['closeLoss', 'Perdiste en la ronda decisiva'],
  ['draw', 'Empate'],
  ['camp', 'En el menú, al tocar su frase'],
  ['challenge', 'Su desafío antes de un duelo contra él mismo'],
] as const;

const out: string[] = [];
for (const master of MASTERS) {
  out.push(`### ${master.name} · \`voice.${master.element}.…\``, '');
  out.push('| Archivo | Cuándo | Texto |', '| --- | --- | --- |');
  for (const [group, when] of GROUPS) {
    const lines =
      group === 'welcome' || group === 'challenge' ? [master.lines[group]] : master.lines[group];
    lines.forEach((text, i) => {
      const file =
        group === 'welcome' || group === 'challenge'
          ? `voice.${master.element}.${group}`
          : `voice.${master.element}.${group}.${i}`;
      out.push(`| \`${file}.mp3\` | ${when} | ${text} |`);
    });
  }
  out.push('');
}

const path = new URL('../docs/audio-voces.md', import.meta.url);
const doc = readFileSync(path, 'utf8');
const start = '<!-- frases -->';
const end = '<!-- /frases -->';
const before = doc.slice(0, doc.indexOf(start) + start.length);
const after = doc.slice(doc.indexOf(end));
writeFileSync(path, `${before}\n\n${out.join('\n')}\n${after}`);
