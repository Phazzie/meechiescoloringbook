import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    alias: {
      '$env/dynamic/private': path.resolve(__dirname, './tests/integration/mocks/env.ts')
    }
  }
});
