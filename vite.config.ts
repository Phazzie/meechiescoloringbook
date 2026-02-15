// Purpose: Configure Vite for the SvelteKit application.
// Why: Register SvelteKit plugin and build settings.
// Info flow: Vite reads config -> dev/build pipeline.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const contractsDir = fileURLToPath(new URL('./contracts', import.meta.url));
const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: [contractsDir, fixturesDir]
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/test.ts', 'tests/**/*.test.ts']
	}
});
