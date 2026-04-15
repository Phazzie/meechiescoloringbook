// Purpose: Configure SvelteKit adapter and project settings.
// Why: Define how the app is built and deployed.
// Info flow: SvelteKit reads config -> build output.
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
