// Purpose: Configure Vite for the SvelteKit application.
// Why: Register SvelteKit plugin and build settings.
// Info flow: Vite reads config -> dev/build pipeline.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/test.ts', 'tests/unit/**/*.test.ts']
	}
});
