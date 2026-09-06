/*
 * Purpose: Wire the browser's service-worker events to the offline policy in
 *          `src/lib/core/offline-cache.ts`, through `CacheSeam`.
 * Why: This file used to hold the policy itself, and because the policy was tangled with
 *      `$service-worker` and the Web Cache API it was the only part of this app with no tests —
 *      while running on every page load for every visitor. It now contains no decisions. It reads
 *      the build manifest, hands it to `planPrecache`, and hands each event to a function that a
 *      unit test can run against `createMockCacheSeam`. Everything this file does is either an
 *      event registration or a value taken from `$service-worker`.
 * Info flow: $service-worker (build, files, prerendered, version) -> planPrecache -> install:
 *            primePrecache(seam) -> activate: evictStaleCaches(seam) -> fetch: chooseStrategy +
 *            handleFetch(seam).
 * Invariants:
 *   - No `caches.*` call appears here. Every cache read and write goes through `createCacheSeam()`.
 *   - No branch here decides anything a test cannot reach. If a rule needs adding, it belongs in
 *     `offline-cache.ts` beside the tests that hold the others.
 *   - `event.respondWith` is called only when `handleFetch` returns a Response. A `null` means the
 *     request is left entirely alone, which is what keeps `/api/*` and cross-origin traffic
 *     behaving exactly as they would with no service worker installed.
 */
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';
import { createCacheSeam } from './lib/adapters/cache-seam/index';
import { chooseStrategy, handleFetch, planPrecache, primePrecache } from './lib/core/offline-cache';

const CACHE = `cb-cache-${version}`;
const cacheSeam = createCacheSeam();
const plan = planPrecache({ build, files, prerendered });

self.addEventListener('install', (event) => {
	event.waitUntil(
		primePrecache(cacheSeam, CACHE, plan).then((result) => {
			// The critical set is the app: its code, its pages, and the files the operating system
			// needs to launch it. Failing the install here is deliberate — a half-cached app that
			// reports itself installed is worse than one that retries on the next load.
			if (!result.ok) {
				throw new Error(result.error.message);
			}
			// Artwork that did not make it is named, not counted, and it is not a failure: the
			// install that stored 61 of 63 files still gives the reader an app that opens.
			if (result.value.optionalFailed.length > 0) {
				console.warn(
					`[offline] cached the app, but not: ${result.value.optionalFailed.join(', ')}`
				);
			}
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		cacheSeam.evictStaleCaches(CACHE).then((result) => {
			if (!result.ok) {
				throw new Error(`Cache activation failed: ${result.error.message}`);
			}
		})
	);
});

self.addEventListener('fetch', (event) => {
	// `mode === 'navigate'` is the browser's own word for "this request is a document" — a typed
	// URL, a reload, a link followed with the page unloading. It is the case the previous fetch
	// handler had no branch for at all, which is why an installed app opened to a browser error
	// page: nothing in the cache was ever HTML, and nothing caught the failing fetch.
	const isNavigation = event.request.mode === 'navigate';

	const strategy = chooseStrategy({
		method: event.request.method,
		url: event.request.url,
		origin: self.location.origin,
		isNavigation
	});

	// The only place a bypass is handled, and the reason `handleFetch` does not accept one: not
	// calling `respondWith` is what makes the request behave as if no worker were installed. There
	// is no Response that means that, so there is no second place this could be got wrong.
	if (strategy === 'bypass') return;

	event.respondWith(
		handleFetch(cacheSeam, {
			request: event.request,
			strategy,
			isNavigation,
			fallbackAvailable: plan.fallbackAvailable,
			fetchFn: (request) => fetch(request)
		})
	);
});
