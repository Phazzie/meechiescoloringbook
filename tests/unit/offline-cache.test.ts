// Purpose: Unit tests for the offline layer's policy — the precache plan, the per-request
//          strategy, the cache key, the fetch orchestration, and the sentence a reader is shown.
// Why: `src/service-worker.ts` had no tests at all while running on every page load for every
//      visitor, because its decisions were tangled with `$service-worker` and the Web Cache API.
//      They now live in `src/lib/core/offline-cache.ts` and run against the seam's own mock, so
//      each rule this run relies on is held by an assertion instead of by a comment. The cases
//      that matter most are the ones the old code got wrong: a navigation, an `/api/` request, an
//      install where one file is missing, and a network that is simply gone.
// Info flow: build-manifest and Request fixtures -> offline-cache functions + createMockCacheSeam
//            -> assertions.
import { describe, expect, it, vi } from 'vitest';
import { createMockCacheSeam } from '../../src/lib/seams/cache-seam/mock';
import type { CacheSeam } from '../../src/lib/seams/cache-seam/contract';
import {
	OFFLINE_FALLBACK_PATH,
	cacheKeyFor,
	chooseStrategy,
	handleFetch,
	offlineNotice,
	planPrecache,
	primePrecache
} from '../../src/lib/core/offline-cache';

const ORIGIN = 'https://meechie.example';

/** The shape `$service-worker` hands the worker, trimmed to one entry of each kind. */
const manifest = (overrides: Partial<Parameters<typeof planPrecache>[0]> = {}) => ({
	build: ['/_app/immutable/entry/app.aaa.js', '/_app/immutable/assets/0.bbb.css'],
	files: [
		'/manifest.webmanifest',
		'/icon.svg',
		'/icons/icon-192.png',
		'/robots.txt',
		'/meechie/meechie-banner.png',
		'/wigs/wig-001-sleek-straight-goddess.jpg'
	],
	prerendered: ['/', '/who-fucked-up', OFFLINE_FALLBACK_PATH],
	...overrides
});

const request = (url: string, init: RequestInit = {}): Request => new Request(url, init);

describe('planPrecache', () => {
	it('puts the app code, every prerendered page and the install identity in the critical set', () => {
		const plan = planPrecache(manifest());

		expect(plan.critical).toEqual([
			'/_app/immutable/entry/app.aaa.js',
			'/_app/immutable/assets/0.bbb.css',
			'/',
			'/who-fucked-up',
			'/offline',
			'/manifest.webmanifest',
			'/icon.svg',
			'/icons/icon-192.png'
		]);
	});

	it('leaves artwork optional, because a missing picture is not a broken app', () => {
		const plan = planPrecache(manifest());

		expect(plan.optional).toEqual([
			'/meechie/meechie-banner.png',
			'/wigs/wig-001-sleek-straight-goddess.jpg'
		]);
	});

	it('skips robots.txt, which only a crawler ever asks for', () => {
		expect(planPrecache(manifest()).skipped).toEqual(['/robots.txt']);
	});

	it('accounts for every input URL exactly once', () => {
		const input = manifest();
		const plan = planPrecache(input);
		const placed = [...plan.critical, ...plan.optional, ...plan.skipped];
		const all = [...input.build, ...input.files, ...input.prerendered];

		expect(placed.slice().sort()).toEqual(all.slice().sort());
		expect(new Set(placed).size).toBe(placed.length);
	});

	// The single fact the navigation fallback rests on. If `/offline` ever stops being prerendered
	// there is no file to cache, and the worker must fall back to failing rather than to serving
	// a path it never stored.
	it('reports the fallback as available only when the offline page was prerendered', () => {
		expect(planPrecache(manifest()).fallbackAvailable).toBe(true);
		expect(planPrecache(manifest({ prerendered: ['/'] })).fallbackAvailable).toBe(false);
	});

	it('handles an empty manifest without inventing entries', () => {
		const plan = planPrecache({ build: [], files: [], prerendered: [] });

		expect(plan.critical).toEqual([]);
		expect(plan.optional).toEqual([]);
		expect(plan.fallbackAvailable).toBe(false);
	});
});

describe('primePrecache', () => {
	it('stores the critical set in one call and the optional set in one more', async () => {
		const seam = createMockCacheSeam();
		const primeCache = vi.spyOn(seam, 'primeCache');

		const result = await primePrecache(seam, 'cb-cache-1', planPrecache(manifest()));

		expect(result.ok).toBe(true);
		expect(primeCache).toHaveBeenCalledTimes(2);
		if (result.ok) {
			expect(result.value.criticalCached).toBe(8);
			expect(result.value.optionalCached).toBe(2);
			expect(result.value.optionalFailed).toEqual([]);
		}
	});

	// The behaviour the old `addAll` had for everything: all or nothing. Kept, but now only for the
	// files where nothing is the honest answer.
	it('fails the install when the critical set cannot be stored, and does not go on to the artwork', async () => {
		const seam = createMockCacheSeam('addAllFault');
		const primeCache = vi.spyOn(seam, 'primeCache');

		const result = await primePrecache(seam, 'cb-cache-1', planPrecache(manifest()));

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('CRITICAL_PRECACHE_FAILED');
			expect(result.error.message).toContain('8 files');
		}
		expect(primeCache).toHaveBeenCalledTimes(1);
	});

	// The defect this whole bucket exists for: one unreachable picture used to mean the install
	// rejected and *nothing* was cached.
	it('retries the artwork one file at a time and names the ones that failed', async () => {
		const failing = new Set(['/wigs/wig-001-sleek-straight-goddess.jpg']);
		const inner = createMockCacheSeam();
		const seam: CacheSeam = {
			...inner,
			primeCache: async (cacheName, urls) => {
				if (urls.some((url) => failing.has(url))) {
					return {
						ok: false,
						error: { code: 'CACHE_ADD_ALL_FAILED', message: 'not found' }
					};
				}
				return inner.primeCache(cacheName, urls);
			}
		};

		const result = await primePrecache(seam, 'cb-cache-1', planPrecache(manifest()));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.optionalFailed).toEqual(['/wigs/wig-001-sleek-straight-goddess.jpg']);
			expect(result.value.optionalCached).toBe(1);
		}
	});

	it('does not call the seam for an empty optional set', async () => {
		const seam = createMockCacheSeam();
		const primeCache = vi.spyOn(seam, 'primeCache');

		const result = await primePrecache(
			seam,
			'cb-cache-1',
			planPrecache({ build: ['/_app/a.js'], files: [], prerendered: [] })
		);

		expect(result.ok).toBe(true);
		expect(primeCache).toHaveBeenCalledTimes(1);
	});
});

describe('chooseStrategy', () => {
	const choose = (
		url: string,
		options: { method?: string; isNavigation?: boolean } = {}
	) =>
		chooseStrategy({
			method: options.method ?? 'GET',
			url,
			origin: ORIGIN,
			isNavigation: options.isNavigation ?? false
		});

	it('never answers a non-GET', () => {
		expect(choose(`${ORIGIN}/`, { method: 'POST' })).toBe('bypass');
		expect(choose(`${ORIGIN}/`, { method: 'delete' })).toBe('bypass');
	});

	// The rule that keeps a cache away from anything that costs a provider call. Every one of these
	// is a POST today; the rule is what makes that safe to change.
	it('never answers an API request, whatever its method', () => {
		expect(choose(`${ORIGIN}/api/generate`)).toBe('bypass');
		expect(choose(`${ORIGIN}/api/meechie-studio-text`)).toBe('bypass');
		expect(choose(`${ORIGIN}/api`)).toBe('bypass');
	});

	it('does not mistake a route that merely starts with the letters api for an endpoint', () => {
		expect(choose(`${ORIGIN}/apiary`)).toBe('cache-first');
	});

	it('leaves cross-origin requests entirely alone', () => {
		expect(choose('https://fonts.googleapis.com/css2?family=Fraunces')).toBe('bypass');
		expect(choose('https://fonts.gstatic.com/s/fraunces/x.woff2')).toBe('bypass');
	});

	it('bypasses a URL it cannot parse rather than guessing', () => {
		expect(choose('not a url')).toBe('bypass');
	});

	it('goes to the network first for a document', () => {
		expect(choose(`${ORIGIN}/who-fucked-up`, { isNavigation: true })).toBe('network-first');
	});

	// Route data is a document's other half. Serving it from a versioned cache while the document
	// came from the network is how a page ends up rendering last deploy's data.
	it('goes to the network first for route data', () => {
		expect(choose(`${ORIGIN}/who-fucked-up/__data.json`)).toBe('network-first');
	});

	it('serves versioned assets from the cache first', () => {
		expect(choose(`${ORIGIN}/_app/immutable/entry/app.aaa.js`)).toBe('cache-first');
		expect(choose(`${ORIGIN}/wigs/wig-001-sleek-straight-goddess.jpg`)).toBe('cache-first');
	});
});

describe('cacheKeyFor', () => {
	// `cache.addAll` files a prerendered page under its bare path, and the seam exposes no
	// `ignoreSearch`, so without this a shared link misses a page sitting in the cache.
	it('drops the query and the fragment from a navigation', () => {
		expect(cacheKeyFor(`${ORIGIN}/who-fucked-up?from=share#top`, true)).toBe(
			`${ORIGIN}/who-fucked-up`
		);
	});

	it('keeps the query on a subresource, where it is part of which file this is', () => {
		expect(cacheKeyFor(`${ORIGIN}/_app/x.js?v=2`, false)).toBe(`${ORIGIN}/_app/x.js?v=2`);
	});

	it('returns an unparseable URL untouched', () => {
		expect(cacheKeyFor('not a url', true)).toBe('not a url');
	});
});

describe('handleFetch', () => {
	const neverCalled: () => Promise<Response> = () => {
		throw new Error('the network should not have been reached');
	};
	const offline = () => Promise.reject(new TypeError('Failed to fetch'));

	it('returns null for a bypass, so the worker leaves the request alone', async () => {
		const response = await handleFetch(createMockCacheSeam(), {
			request: request(`${ORIGIN}/api/generate`, { method: 'POST' }),
			strategy: 'bypass',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn: neverCalled
		});

		expect(response).toBeNull();
	});

	it('serves a cached asset without touching the network', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [`${ORIGIN}/_app/app.js`]);

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/_app/app.js`),
			strategy: 'cache-first',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn: neverCalled
		});

		expect(response?.status).toBe(200);
	});

	it('falls through to the network when an asset is not cached', async () => {
		const fetchFn = vi.fn(async () => new Response('fresh', { status: 200 }));

		const response = await handleFetch(createMockCacheSeam(), {
			request: request(`${ORIGIN}/_app/app.js`),
			strategy: 'cache-first',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn
		});

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(await response?.text()).toBe('fresh');
	});

	it('answers a missing asset with a 503 rather than a rejected promise', async () => {
		const response = await handleFetch(createMockCacheSeam(), {
			request: request(`${ORIGIN}/wigs/missing.jpg`),
			strategy: 'cache-first',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn: offline
		});

		expect(response?.status).toBe(503);
	});

	// A cache that errors is not a cache that is empty, and neither is a reason to fail the
	// request: the network is still there.
	it('goes to the network when the cache itself errors', async () => {
		const fetchFn = vi.fn(async () => new Response('fresh', { status: 200 }));

		const response = await handleFetch(createMockCacheSeam('fault'), {
			request: request(`${ORIGIN}/_app/app.js`),
			strategy: 'cache-first',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn
		});

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(response?.status).toBe(200);
	});

	it('prefers the network for a document, even when one is cached', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [`${ORIGIN}/who-fucked-up`]);
		const fetchFn = vi.fn(async () => new Response('fresh document', { status: 200 }));

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/who-fucked-up`),
			strategy: 'network-first',
			isNavigation: true,
			fallbackAvailable: true,
			fetchFn
		});

		expect(await response?.text()).toBe('fresh document');
	});

	// The case the whole run exists for: an installed app, launched with no network.
	it('serves the cached document when the network is gone', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [`${ORIGIN}/who-fucked-up`]);

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/who-fucked-up`),
			strategy: 'network-first',
			isNavigation: true,
			fallbackAvailable: true,
			fetchFn: offline
		});

		expect(response?.status).toBe(200);
	});

	it('finds a cached document for a shared link that carries a query string', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [`${ORIGIN}/who-fucked-up`]);

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/who-fucked-up?from=share`),
			strategy: 'network-first',
			isNavigation: true,
			fallbackAvailable: true,
			fetchFn: offline
		});

		expect(response?.status).toBe(200);
	});

	it('falls back to the offline page for an uncached document with no network', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [OFFLINE_FALLBACK_PATH]);
		const fallback = new Response('the offline page', { status: 200 });
		vi.spyOn(seam, 'matchRequest').mockImplementation(async (req) =>
			req === OFFLINE_FALLBACK_PATH ? { ok: true, value: fallback } : { ok: true, value: null }
		);

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/never-built`),
			strategy: 'network-first',
			isNavigation: true,
			fallbackAvailable: true,
			fetchFn: offline
		});

		expect(await response?.text()).toBe('the offline page');
	});

	// Without this the worker would answer a navigation from a path it never stored, which renders
	// as a blank frame — strictly worse than the browser saying it could not connect.
	it('does not reach for a fallback the plan says was never cached', async () => {
		const seam = createMockCacheSeam();
		const matchRequest = vi.spyOn(seam, 'matchRequest');

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/never-built`),
			strategy: 'network-first',
			isNavigation: true,
			fallbackAvailable: false,
			fetchFn: offline
		});

		expect(response?.status).toBe(503);
		expect(matchRequest).toHaveBeenCalledTimes(1);
	});

	// The offline page is HTML. Handing it back for a `__data.json` request would have SvelteKit's
	// client parse a document as JSON.
	it('never answers route data with the offline page', async () => {
		const seam = createMockCacheSeam();
		await seam.primeCache('c', [OFFLINE_FALLBACK_PATH]);

		const response = await handleFetch(seam, {
			request: request(`${ORIGIN}/who-fucked-up/__data.json`),
			strategy: 'network-first',
			isNavigation: false,
			fallbackAvailable: true,
			fetchFn: offline
		});

		expect(response?.status).toBe(503);
	});
});

describe('offlineNotice', () => {
	it('says nothing at all while the connection is up', () => {
		expect(offlineNotice({ isOnline: true, offlineCopyReady: true })).toBe('');
		expect(offlineNotice({ isOnline: true, offlineCopyReady: false })).toBe('');
	});

	it('scopes the offline sentence to what still works on this device', () => {
		const notice = offlineNotice({ isOnline: false, offlineCopyReady: true });

		expect(notice).toContain('saved pages');
		expect(notice).toContain('needs a connection');
	});

	// The distinction the old `.catch(() => {})` threw away. These two devices behave completely
	// differently and must not be told the same thing.
	it('says something different when this device has no offline copy', () => {
		const ready = offlineNotice({ isOnline: false, offlineCopyReady: true });
		const notReady = offlineNotice({ isOnline: false, offlineCopyReady: false });

		expect(notReady).not.toBe(ready);
		expect(notReady).toContain('has not finished saving an offline copy');
	});
});
