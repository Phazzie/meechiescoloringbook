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
		}),
		// Content Security Policy. Declared here rather than in hooks.server.ts so
		// SvelteKit can attach its own nonce to the hydration <script> it injects;
		// hand-writing this header would break hydration the moment Kit changed
		// that markup. 'auto' hashes prerendered pages and nonces dynamic ones.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// The Google Fonts stylesheet is linked from src/routes/+layout.svelte.
				'style-src': ['self', 'https://fonts.googleapis.com'],
				// Four hand-written inline style attributes exist: the verdict colour in
				// rate-his-excuse, a width in StudioPreviewPanel, and the hero background
				// and mode-card CSS variables in StudioHero (the last two use the
				// style={...} expression form). An element attribute cannot carry a nonce,
				// and once SvelteKit puts a nonce on 'style-src' browsers ignore
				// 'unsafe-inline' there — so the allowance is isolated to the attribute
				// directive instead of widening 'style-src' itself.
				'style-src-attr': ['unsafe-inline'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				// data: and blob: carry generated output, not third-party content:
				// coloring pages and wig try-on portraits come back from the provider
				// as base64 and are rendered inline. Every wig catalog image is a
				// packaged same-origin /wigs asset.
				'img-src': ['self', 'data:', 'blob:'],
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
