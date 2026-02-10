// Purpose: Configure Vitest integration test runs.
// Why: Separate integration settings from unit tests.
// Info flow: Vitest reads config -> runs integration suite.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts']
  }
});
