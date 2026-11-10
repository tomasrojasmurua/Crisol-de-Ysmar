import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/**
 * Versión que se ve en una esquina del menú. Cada PR se fusiona con su número al final del
 * título ("… (#42)"), así que "v42" dice qué PR es el último que trae esta copia del juego.
 * Las vistas previas de un PR y el modo de desarrollo muestran solo el commit.
 */
function appVersion(): string {
  try {
    const subject = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim();
    const sha = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
    const pr = /\(#(\d+)\)$/.exec(subject)?.[1];
    return pr ? `v${pr} · ${sha}` : `prueba · ${sha}`;
  } catch {
    return 'desarrollo';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js pesa ~620 kB sin comprimir (~160 kB comprimido). El presupuesto real
    // es la descarga inicial: menos de 5 MB (ver docs/arquitectura.md).
    chunkSizeWarningLimit: 800,
  },
});
