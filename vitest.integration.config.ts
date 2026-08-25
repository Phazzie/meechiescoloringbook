// Purpose: Configure Vitest integration test runs.
// Why: Separate integration settings from unit tests, and resolve the SvelteKit
//      `$env` and `$lib` aliases that real adapters import. Without those aliases the
//      suite fails at import before any test runs.
// Info flow: Vitest reads config -> resolves aliases -> runs integration suite.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '$env/dynamic/private': path.resolve('tests/setup/env-dynamic-private.ts'),
      $lib: path.resolve('src/lib')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts']
  }
});
