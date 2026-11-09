// Hace cumplir el mapa de dependencias: las flechas solo apuntan hacia el núcleo.
// packages/core no importa nada externo; los paquetes solo usan lo permitido; ninguna app importa otra.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** Imports externos permitidos en código de producción (las pruebas pueden usar vitest). */
const ALLOWED = {
  'packages/core': [],
  'packages/content': ['@crisol/core', 'zod'],
  'packages/protocol': ['@crisol/core'],
  'apps/client': ['@crisol/core', '@crisol/content', '@crisol/protocol', 'three'],
  'apps/server': ['@crisol/core', '@crisol/content', '@crisol/protocol', 'cloudflare:workers'],
  'apps/balance': ['@crisol/core', '@crisol/content', 'node:'],
};

const IMPORT_PATTERN =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield path;
    }
  }
}

const allowedBy = (allowed, specifier) =>
  allowed.some((name) =>
    name.endsWith(':')
      ? specifier.startsWith(name)
      : specifier === name || specifier.startsWith(`${name}/`),
  );

const violations = [];
for (const [workspace, allowed] of Object.entries(ALLOWED)) {
  for (const file of sourceFiles(join(ROOT, workspace, 'src'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (specifier && !specifier.startsWith('.') && !allowedBy(allowed, specifier)) {
        violations.push(`${relative(ROOT, file)} importa "${specifier}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Dependencias no permitidas (ver docs/arquitectura.md):');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log('Mapa de dependencias correcto.');
