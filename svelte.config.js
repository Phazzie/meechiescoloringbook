// Purpose: Configure SvelteKit adapter and project settings.
// Why: Define how the app is built and deployed.
// Info flow: SvelteKit reads config -> build output.
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			precompress: true,
			runtime: 'nodejs22.x'
		}),
		csp: {
			// 'auto' hashes prerendered pages and nonces dynamically rendered ones;
			// every route here is dynamically rendered, so this resolves to nonce mode
			// and covers SvelteKit's own inline hydration <script>.
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Hand-authored inline `style="..."` attributes (e.g. dynamic verdict
				// color, app.html's hydration wrapper) are not covered by SvelteKit's
				// CSP nonce, so style-src keeps 'unsafe-inline' as a documented tradeoff.
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				'img-src': ['self', 'data:', 'blob:', 'https://placehold.co'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
