import { defineConfig } from 'vitest/config';

/** Solo para la simulación de red (no corre en CI): ver `simulacion.test.ts`. */
export default defineConfig({
  test: {
    include: ['apps/server/red/*.test.ts'],
    testTimeout: 600_000,
  },
});
