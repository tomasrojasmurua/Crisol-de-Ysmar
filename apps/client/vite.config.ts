import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js pesa ~620 kB sin comprimir (~160 kB comprimido). El presupuesto real
    // es la descarga inicial: menos de 5 MB (ver docs/arquitectura.md).
    chunkSizeWarningLimit: 800,
  },
});
