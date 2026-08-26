// Purpose: Configure SvelteKit adapter and project settings.
// Why: Define how the app is built and deployed.
// Info flow: SvelteKit reads config -> build output.
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			precompress: true,
			runtime: 'nodejs22.x',
			// grok-imagine-image-2.0 was measured at 71s and 94s for a single coloring page.
			// The image adapter already allows 120s; without a matching function budget the
			// platform default terminates the request first, so a call that actually succeeded
			// upstream still returns a failure to the caller. Keep this at or above the
			// adapter's XAI_IMAGE_TIMEOUT_MS or the two disagree about who gives up first.
			maxDuration: 120
		})
	}
};

export default config;
