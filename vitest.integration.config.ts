// Purpose: Vitest configuration for integration tests.
// Why: Integration tests require a separate config to alias $env/dynamic/private
//      so seam adapters can read env vars from the mock without a live SvelteKit server.
// Info flow: Vitest reads this config → applies alias → test files import the mock env.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    alias: {
      '$env/dynamic/private': fileURLToPath(new URL('./tests/integration/mocks/env.ts', import.meta.url))
    }
  }
});
