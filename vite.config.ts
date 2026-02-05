// Purpose: Configure Vite for the SvelteKit application.
// Why: Register SvelteKit plugin and build settings.
// Info flow: Vite reads config -> dev/build pipeline.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
