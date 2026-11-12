import { defineConfig } from 'vitest/config';

/** Solo para la prueba de los 6 celulares (no corre en CI): ver `celulares.test.ts`. */
export default defineConfig({
  test: {
    include: ['apps/client/red/*.test.ts'],
    testTimeout: 900_000,
  },
});
