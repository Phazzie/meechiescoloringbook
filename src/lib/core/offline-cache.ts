/*
 * Purpose: The offline layer's entire policy, as pure functions plus two seam-injected
 *          orchestrators — what gets pre-cached and at what priority, which requests the service
 *          worker is allowed to answer, and what a reader is told when the network is gone.
 * Why: `src/service-worker.ts` ran on every page load for every visitor and was the one piece of
 *      this app with no tests at all, because everything it did was tangled with `$service-worker`
 *      and the Web Cache API. Measured on `main` at `ad3bfe7`, what it did was: pre-cache 63 URLs
 *      totalling 3,462,111 bytes — every wig photograph and every piece of Meechie artwork — in a
 *      single all-or-nothing `cache.addAll`, on the first page load, before the reader had asked
 *      for any of it; cache **zero** bytes of HTML, because nothing in `build` or `files` is a
 *      page; and then answer every GET cache-first, falling through to `fetch`, whose rejection
 *      became the browser's own network-error page. The manifest says `display: standalone`, so
 *      that error page *was* the installed app. Splitting the policy out here is what makes each
 *      of those a statement a test can hold.
 * Info flow: `$service-worker` build manifest -> planPrecache -> primePrecache(seam) at install;
 *            fetch event -> chooseStrategy -> handleFetch(seam) -> cached Response, network
 *            Response, the pre-cached offline page, or a synthesized 503.
 * Invariants:
 *   - Nothing here reaches the Cache API directly. Every read and write goes through `CacheSeam`,
 *     which is why these functions can be run against `createMockCacheSeam` in a plain unit test.
 *   - `/api/*`, cross-origin URLs and every non-GET method are never answered from a cache. A
 *     coloring page costs the operator a provider call; serving yesterday's answer for one is
 *     worse than failing.
 *   - A navigation is looked up with its query string removed. `cache.addAll` files a prerendered
 *     page under its bare path, so `/?share=1` would otherwise miss a page that is sitting in the
 *     cache. The seam exposes no `ignoreSearch`, so the key is normalized here instead.
 *   - The fallback is only ever offered when `planPrecache` saw it in the prerendered manifest.
 *     A fallback that is not on disk must degrade to the old behavior, not to a blank frame.
 */

import type { CacheSeam } from '$lib/seams/cache-seam/contract';

/**
 * The route whose prerendered HTML answers a navigation that reached neither the network nor the
 * cache. Must stay in step with `src/routes/offline/+page.svelte`, which is prerendered so that a
 * real file exists at this path for `cache.addAll` to store.
 */
export const OFFLINE_FALLBACK_PATH = '/offline';

/** Only crawlers ever request these, and a crawler is never offline in a way this cache can help. */
const NEVER_PRECACHED = ['/robots.txt'] as const;

/**
 * Small, same on every deploy, and needed the moment the operating system draws the installed app:
 * the manifest it reads and the icons it draws. Kept critical so that an install which succeeds is
 * an install that can actually be launched.
 */
const INSTALL_IDENTITY_FILES = ['/manifest.webmanifest', '/icon.svg'] as const;
const INSTALL_IDENTITY_PREFIXES = ['/icons/'] as const;

export type PrecachePlan = {
	/**
	 * Fails the install if it cannot be stored: the application code, every prerendered page, and
	 * the handful of files the operating system needs to launch the installed app. There is no
	 * useful half of this set.
	 */
	readonly critical: readonly string[];
	/**
	 * Artwork. Cached on a best-effort basis and, if the batch fails, one file at a time. A wig
	 * photograph that did not make it costs the reader a picture; it does not cost them the app,
	 * and it is not a reason to leave them with no offline copy at all.
	 */
	readonly optional: readonly string[];
	/** Listed rather than silently dropped, so the plan accounts for every input URL. */
	readonly skipped: readonly string[];
	/**
	 * Whether `OFFLINE_FALLBACK_PATH` was actually in the prerendered manifest. False means the
	 * route stopped being prerendered — in which case no fallback is offered at all, because
	 * answering a navigation from a path that was never cached would produce a blank frame.
	 */
	readonly fallbackAvailable: boolean;
};

const isInstallIdentity = (url: string): boolean =>
	INSTALL_IDENTITY_FILES.includes(url as (typeof INSTALL_IDENTITY_FILES)[number]) ||
	INSTALL_IDENTITY_PREFIXES.some((prefix) => url.startsWith(prefix));

/**
 * Sort the build manifest into what an install must have, what it would like, and what it should
 * not bother with.
 *
 * The old service worker had one bucket — `[...build, ...files]` — handed to a single `addAll`,
 * which is atomic: one 404 among 63 URLs and nothing was cached at all, the install rejected, and
 * the rejection was visible only in a DevTools pane nobody had open. Three buckets is what lets the
 * common failure (one missing picture) cost a picture.
 */
export const planPrecache = (input: {
	readonly build: readonly string[];
	readonly files: readonly string[];
	readonly prerendered: readonly string[];
}): PrecachePlan => {
	const critical: string[] = [];
	const optional: string[] = [];
	const skipped: string[] = [];

	// Content-hashed application code and styles. Without these the app does not boot, cached
	// pages or not, so there is nothing to be gained by treating any of them as optional.
	critical.push(...input.build);

	// The change that makes the feature exist. Every route in this app is prerendered as of this
	// run, so these are the HTML documents that let an installed app open without a network — the
	// thing the previous cache never held a single byte of.
	critical.push(...input.prerendered);

	for (const file of input.files) {
		if (NEVER_PRECACHED.includes(file as (typeof NEVER_PRECACHED)[number])) {
			skipped.push(file);
		} else if (isInstallIdentity(file)) {
			critical.push(file);
		} else {
			optional.push(file);
		}
	}

	return {
		critical,
		optional,
		skipped,
		fallbackAvailable: input.prerendered.includes(OFFLINE_FALLBACK_PATH)
	};
};

export type PrecacheOutcome = {
	/** How many URLs the critical batch stored. */
	readonly criticalCached: number;
	/** Optional URLs that are now in the cache. */
	readonly optionalCached: number;
	/**
	 * Optional URLs that could not be cached, named rather than counted, so a diagnosis does not
	 * start with "some artwork".
	 */
	readonly optionalFailed: readonly string[];
};

export type PrecacheFailure = {
	readonly code: 'CRITICAL_PRECACHE_FAILED';
	readonly message: string;
};

/**
 * Run a plan against the cache seam at install time.
 *
 * Optional assets are attempted as one batch first — 15 files, one `caches.open` — and only if
 * that batch fails are they retried individually. That keeps the happy path to two seam calls
 * while still ensuring a single bad URL cannot take the artwork down with it.
 */
export const primePrecache = async (
	seam: CacheSeam,
	cacheName: string,
	plan: PrecachePlan
): Promise<{ ok: true; value: PrecacheOutcome } | { ok: false; error: PrecacheFailure }> => {
	if (plan.critical.length > 0) {
		const criticalResult = await seam.primeCache(cacheName, [...plan.critical]);
		if (!criticalResult.ok) {
			return {
				ok: false,
				error: {
					code: 'CRITICAL_PRECACHE_FAILED',
					message: `Could not cache the ${plan.critical.length} files the app needs to open offline: ${criticalResult.error.message}`
				}
			};
		}
	}

	if (plan.optional.length === 0) {
		return {
			ok: true,
			value: { criticalCached: plan.critical.length, optionalCached: 0, optionalFailed: [] }
		};
	}

	const batch = await seam.primeCache(cacheName, [...plan.optional]);
	if (batch.ok) {
		return {
			ok: true,
			value: {
				criticalCached: plan.critical.length,
				optionalCached: plan.optional.length,
				optionalFailed: []
			}
		};
	}

	const optionalFailed: string[] = [];
	for (const url of plan.optional) {
		const single = await seam.primeCache(cacheName, [url]);
		if (!single.ok) optionalFailed.push(url);
	}

	return {
		ok: true,
		value: {
			criticalCached: plan.critical.length,
			optionalCached: plan.optional.length - optionalFailed.length,
			optionalFailed
		}
	};
};

/**
 * `bypass` — the service worker does not answer at all, and the browser does exactly what it would
 * do with no service worker installed.
 * `cache-first` — versioned, immutable bytes. Answer from the cache, go to the network on a miss.
 * `network-first` — documents and route data. Always ask the network, fall back to the cache, then
 * to the offline page.
 */
export type RequestStrategy = 'bypass' | 'cache-first' | 'network-first';

/** SvelteKit fetches this beside a client-side navigation; it carries the route's `load` data. */
const ROUTE_DATA_SUFFIX = '/__data.json';

/**
 * Decide how a single request is answered.
 *
 * Three of these branches did not exist before. Every GET went cache-first, which meant the
 * service worker inserted itself between the page and Google Fonts, between the page and any
 * future GET endpoint, and — had anything ever put one in the cache — between the page and its own
 * API. `bypass` is not an optimization here; it is the rule that keeps a cache out of the path of
 * answers that cost money and must be current.
 */
export const chooseStrategy = (input: {
	readonly method: string;
	/** Absolute request URL. */
	readonly url: string;
	/** The origin the service worker is registered on. */
	readonly origin: string;
	/** True for a document request — a full page load or a reload, not a subresource. */
	readonly isNavigation: boolean;
}): RequestStrategy => {
	if (input.method.toUpperCase() !== 'GET') return 'bypass';

	let parsed: URL;
	try {
		parsed = new URL(input.url);
	} catch {
		// An unparseable URL is not something to guess about. Hand it back to the browser.
		return 'bypass';
	}

	// Google Fonts, and anything else off this origin. A cross-origin response is frequently
	// opaque, which makes it useless to cache and impossible to inspect.
	if (parsed.origin !== input.origin) return 'bypass';

	// Verdicts, coloring pages, wig try-ons and the quota headers that come back with them. These
	// are POSTs today, so this rule is belt and braces — and it is the rule that keeps it that way
	// if a GET endpoint is ever added.
	if (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/')) return 'bypass';

	if (input.isNavigation) return 'network-first';
	if (parsed.pathname.endsWith(ROUTE_DATA_SUFFIX)) return 'network-first';

	return 'cache-first';
};

/**
 * The cache key for a request.
 *
 * A navigation drops its query string, because `cache.addAll('/who-fucked-up')` files the document
 * under the bare path and a reader arriving at `/who-fucked-up?from=share` would otherwise miss a
 * page that is sitting right there. Subresources keep theirs: a query string on an asset URL is
 * part of which asset it is.
 */
export const cacheKeyFor = (url: string, isNavigation: boolean): string => {
	if (!isNavigation) return url;
	try {
		const parsed = new URL(url);
		parsed.search = '';
		parsed.hash = '';
		return parsed.toString();
	} catch {
		return url;
	}
};

/**
 * What the browser gets when neither the cache nor the network could answer a subresource.
 *
 * A rejected `respondWith` promise gives the browser's generic failure; this at least says which
 * layer gave up, and — because it is a real Response — it does not surface as an unhandled
 * rejection in the service worker.
 */
const unavailableResponse = (): Response =>
	new Response('Offline, and this file is not in the offline copy of the app.', {
		status: 503,
		statusText: 'Offline',
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});

export type FetchLike = (request: Request) => Promise<Response>;

/**
 * Answer one request, given a strategy and the plan that says whether a fallback exists.
 *
 * Returns `null` for `bypass`, which the service worker reads as "do not call `respondWith`" — the
 * request then behaves exactly as it would with no service worker registered.
 */
export const handleFetch = async (
	seam: CacheSeam,
	input: {
		readonly request: Request;
		readonly strategy: RequestStrategy;
		readonly isNavigation: boolean;
		readonly fallbackAvailable: boolean;
		readonly fetchFn: FetchLike;
	}
): Promise<Response | null> => {
	if (input.strategy === 'bypass') return null;

	const key = cacheKeyFor(input.request.url, input.isNavigation);

	if (input.strategy === 'cache-first') {
		const cached = await seam.matchRequest(key);
		if (cached.ok && cached.value !== null) return cached.value;
		try {
			return await input.fetchFn(input.request);
		} catch {
			return unavailableResponse();
		}
	}

	// network-first: a document or its route data. Freshness wins while there is a network,
	// because a cached document is a whole deploy behind and this app ships fixes to what it
	// *says*, not only to how it looks.
	try {
		return await input.fetchFn(input.request);
	} catch {
		const cached = await seam.matchRequest(key);
		if (cached.ok && cached.value !== null) return cached.value;

		if (input.isNavigation && input.fallbackAvailable) {
			const fallback = await seam.matchRequest(OFFLINE_FALLBACK_PATH);
			if (fallback.ok && fallback.value !== null) return fallback.value;
		}

		return unavailableResponse();
	}
};

/**
 * The one sentence the app shows about its own connection, worded from what is actually known
 * rather than from `navigator.onLine` alone.
 *
 * `onLine` false means the device has no network. Whether that is survivable depends entirely on
 * whether this device ever finished caching the app, which only the service worker registration
 * knows — and which the old code discarded inside `.catch(() => {})`. The two cases read
 * differently because they are different: one is an inconvenience, the other is the end of the
 * session.
 */
export const offlineNotice = (input: {
	readonly isOnline: boolean;
	readonly offlineCopyReady: boolean;
}): string => {
	if (input.isOnline) return '';
	if (input.offlineCopyReady) {
		return 'Offline. Your saved pages and everything already on this device still open — a new verdict or coloring page needs a connection.';
	}
	return 'Offline, and this device has not finished saving an offline copy of the app yet. Reconnect to keep going.';
};
