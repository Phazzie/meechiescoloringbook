// Purpose: Configure Vitest integration test runs.
// Why: Separate integration settings from unit tests.
// Info flow: Vitest reads config -> runs integration suite.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$env/dynamic/private': fileURLToPath(
				new URL('./tests/setup/env-dynamic-private.ts', import.meta.url)
			)
		}
	},
	test: {
		environment: 'node',
		globals: true,
		include: ['tests/integration/**/*.test.ts']
	}
});
