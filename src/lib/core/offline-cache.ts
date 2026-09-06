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

/**
 * Query parameter carrying the page the reader was actually trying to reach.
 *
 * Without it the offline page's "Try again" reloads the offline page. The reader asked for
 * `/m/receipts`, was redirected here because it is not in the cache, and pressing the only button
 * on screen returns them to the same apology — discarding the destination even after the connection
 * comes back. Exported so the worker that writes it and the page that reads it cannot drift.
 */
export const RETURN_PATH_PARAM = 'from';

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
 * A navigation is canonicalized to the form `cache.addAll` filed the document under: bare path, no
 * query, no fragment, no trailing slash. Two separate ways a perfectly valid URL misses a page
 * that is sitting in the cache:
 *
 * - **The query string.** `/who-fucked-up?from=share` — a shared link. The seam exposes no
 *   `ignoreSearch`, so the key is normalized here instead.
 * - **The trailing slash.** The generated routing table redirects `/meechie/` to `/meechie` with a
 *   308, and the precache holds only the slashless path. That redirect is the *network's* job, and
 *   during an outage there is no network to perform it — so offline, `/meechie/` would have missed
 *   its cached page and landed on the generic offline fallback.
 *
 * The root is the one path whose slash is not trailing decoration, and it keeps it.
 *
 * Subresources are left exactly as they are: a query string on an asset URL is part of which asset
 * it is, and a directory-ish path is not a thing the build produces.
 */
export const cacheKeyFor = (url: string, isNavigation: boolean): string => {
	if (!isNavigation) return url;
	try {
		const parsed = new URL(url);
		parsed.search = '';
		parsed.hash = '';
		parsed.pathname = canonicalPathname(parsed.pathname);
		return parsed.toString();
	} catch {
		return url;
	}
};

const SLASH = 47;

/**
 * Canonicalize a navigation's pathname: exactly one leading slash, no trailing ones, root kept.
 *
 * Scans rather than `replace(/\/+$/, '')`, and not for style. That regular expression has
 * super-linear backtracking: a path of many slashes makes the engine try quadratically many splits
 * before failing. This runs in the service worker on **every navigation**, against a path the
 * person browsing supplies — measured at 3,108 ms for 50,000 slashes, against 0 ms for this. Three
 * seconds of a stranger's CPU per link followed. Flagged by SonarCloud on this pull request.
 *
 * The *leading* slashes matter for a second reason, and it is a security one. This value is used to
 * build a `Location` header, and a path beginning `//evil.example` is a **protocol-relative URL**: a
 * browser reads `Location: //evil.example` as a redirect to another origin entirely. Collapsing to a
 * single leading slash means the header can only ever name a path on this origin. A request for
 * `https://host//evil.example` is same-origin, so it reaches this code; nothing else would have
 * stopped it.
 */
const canonicalPathname = (pathname: string): string => {
	let end = pathname.length;
	while (end > 1 && pathname.charCodeAt(end - 1) === SLASH) end -= 1;

	let start = 0;
	while (start + 1 < end && pathname.charCodeAt(start) === SLASH) start += 1;

	const trimmed = pathname.slice(start, end);
	return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

/**
 * The canonical path+query to send a navigation to, or `null` when it is already canonical.
 *
 * Serving the cached document under the requested URL is not enough when the requested URL has a
 * trailing slash, and the reason is the same one that broke the offline fallback: SvelteKit emits
 * **depth-relative** asset paths — `./_app/…` at `/meechie`, `../_app/…` at `/m/clapback`. Answer
 * `/meechie/` with `/meechie`'s document and the browser resolves those against `/meechie/`,
 * fetching `/meechie/_app/…`, which is in no cache and on no server. The page arrives, titled and
 * styled by nothing, and never hydrates.
 *
 * Online the routing table 308s the trailing slash away and none of this arises. Offline there is no
 * network to perform that redirect, so the worker performs it — which is also why this returns a
 * path and not a document: the address bar has to change, or the assets stay wrong.
 *
 * The query string is preserved and is *not* a reason to redirect on its own. `?from=share` does not
 * move the document's directory, so relative assets already resolve correctly under it.
 */
export const canonicalNavigationTarget = (url: string): string | null => {
	try {
		const parsed = new URL(url);
		const canonical = canonicalPathname(parsed.pathname);
		return canonical === parsed.pathname ? null : `${canonical}${parsed.search}`;
	} catch {
		return null;
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

/**
 * Send an unreachable navigation to the offline page.
 *
 * The `Location` is the bare constant `/offline`, not a URL built from the request. HTTP allows a
 * relative `Location` and the browser resolves it against the request itself, so this reaches the
 * same page while containing no attacker-influenced data at all — where the first version read
 * `new URL(OFFLINE_FALLBACK_PATH, request.url)`. That was same-origin by construction, because
 * `chooseStrategy` bypasses every cross-origin request before this can be reached, but "safe
 * because of a guarantee three functions away" is the shape of an open redirect even when it is not
 * one, and SonarCloud's security rating on this pull request dropped to B when it appeared. A
 * constant cannot be redirected anywhere.
 *
 * `302`, not `301`: being offline is the most temporary condition there is, and a permanent
 * redirect is the one kind a browser is entitled to remember after the network comes back.
 */
const redirectToOfflinePage = (attemptedPath: string | null): Response =>
	redirectTo(
		attemptedPath
			? `${OFFLINE_FALLBACK_PATH}?${RETURN_PATH_PARAM}=${encodeURIComponent(attemptedPath)}`
			: OFFLINE_FALLBACK_PATH
	);

/**
 * A redirect whose `Location` is a path on this origin and cannot be anything else.
 *
 * Every caller passes a value that starts with `/` and, thanks to `canonicalPathname`, never `//`.
 * The assertion is repeated here rather than trusted from the caller because this is the one
 * function in the file that can send a reader somewhere: a `Location` is the only output here that
 * a browser will act on without the page's involvement.
 */
const redirectTo = (location: string): Response =>
	new Response(null, {
		status: 302,
		headers: { location: location.startsWith('//') ? OFFLINE_FALLBACK_PATH : location }
	});

export type FetchLike = (request: Request) => Promise<Response>;

/**
 * "The cache had it" as one question with one answer.
 *
 * `matchRequest` reports two different kinds of nothing — the seam failed (`ok: false`) and the
 * seam succeeded and the entry is absent (`value: null`) — and every caller here treats them the
 * same way, because neither is a reason to fail a request the network can still serve. Written out
 * three times, that identical `ok && value !== null` was three chances to get one of them wrong.
 */
const cachedResponse = async (seam: CacheSeam, key: string): Promise<Response | null> => {
	const result = await seam.matchRequest(key);
	return result.ok ? result.value : null;
};

/** Versioned, immutable bytes: the cache is authoritative, the network is the miss path. */
const cacheFirst = async (
	seam: CacheSeam,
	request: Request,
	key: string,
	fetchFn: FetchLike
): Promise<Response> => {
	const cached = await cachedResponse(seam, key);
	if (cached) return cached;
	try {
		return await fetchFn(request);
	} catch {
		return unavailableResponse();
	}
};

/**
 * A document or its route data. Freshness wins while there is a network, because a cached document
 * is a whole deploy behind and this app ships fixes to what it *says*, not only to how it looks.
 *
 * The fallback is offered to navigations only. A `__data.json` request answered with the offline
 * page would have SvelteKit's client parse an HTML document as JSON.
 *
 * And it is offered as a **redirect**, not as the cached document's bytes. Handing `/offline`'s
 * HTML back under some other URL is the obvious implementation and it does not work in this app:
 * the document hydrates, SvelteKit's client router resolves the address bar's path, finds no route
 * for it, and client-renders the 404 page over the top. The browser probe caught precisely that —
 * `title "404 — Meechie's Coloring Book"`, with the offline page's own text nowhere on screen.
 * Redirecting moves the URL to `/offline`, so the document that arrives is the route it claims to
 * be, and the worker answers that second navigation from the same cache.
 */
const networkFirst = async (
	seam: CacheSeam,
	request: Request,
	key: string,
	options: { fetchFn: FetchLike; isNavigation: boolean; fallbackAvailable: boolean }
): Promise<Response> => {
	try {
		return await options.fetchFn(request);
	} catch {
		const cached = await cachedResponse(seam, key);
		if (cached) {
			// The document is in the cache, but the address bar may still be wrong. Answering
			// `/meechie/` with `/meechie`'s bytes leaves the browser resolving `./_app/…` against
			// `/meechie/`, so nothing loads and nothing hydrates — the same defect that broke the
			// fallback, one case over. Online the routing table's 308 prevents it; offline there is
			// no network to perform that redirect, so it is performed here.
			const canonical = options.isNavigation ? canonicalNavigationTarget(request.url) : null;
			return canonical ? redirectTo(canonical) : cached;
		}

		if (options.isNavigation && options.fallbackAvailable) {
			// Checked, not assumed: `fallbackAvailable` says the build produced the page, and this
			// says this device actually stored it. Redirecting to a path with nothing behind it
			// would turn one failed navigation into two.
			const fallback = await cachedResponse(seam, OFFLINE_FALLBACK_PATH);
			if (fallback) return redirectToOfflinePage(attemptedPathOf(request.url));
		}

		return unavailableResponse();
	}
};

/** The path the reader asked for, canonical and origin-free, or null if it cannot be read. */
const attemptedPathOf = (url: string): string | null => {
	try {
		const parsed = new URL(url);
		return `${canonicalPathname(parsed.pathname)}${parsed.search}`;
	} catch {
		return null;
	}
};

/**
 * A strategy that produces an answer. `bypass` is deliberately not one of them.
 *
 * A bypassed request is not answered *badly* — it is not answered at all: the worker never calls
 * `respondWith`, and the browser does exactly what it would with no service worker installed.
 * There is no Response to return for that case, so the type does not offer one, and the caller
 * cannot reach `handleFetch` without having already dealt with it.
 */
export type AnsweredStrategy = Exclude<RequestStrategy, 'bypass'>;

/**
 * Answer one request, given a strategy and the plan that says whether a fallback exists.
 *
 * Always returns a Response — the cache's, the network's, the offline page, or a synthesized 503.
 */
export const handleFetch = async (
	seam: CacheSeam,
	input: {
		readonly request: Request;
		readonly strategy: AnsweredStrategy;
		readonly isNavigation: boolean;
		readonly fallbackAvailable: boolean;
		readonly fetchFn: FetchLike;
	}
): Promise<Response> => {
	const key = cacheKeyFor(input.request.url, input.isNavigation);

	return input.strategy === 'cache-first'
		? cacheFirst(seam, input.request, key, input.fetchFn)
		: networkFirst(seam, input.request, key, {
				fetchFn: input.fetchFn,
				isNavigation: input.isNavigation,
				fallbackAvailable: input.fallbackAvailable
			});
};

/**
 * The destination to send a reader back to, read out of the offline page's own query string.
 *
 * This is the one place in the offline layer where a value from the URL bar becomes somewhere the
 * app will *navigate*, so it is parsed rather than trusted, in core, with tests:
 *
 * - It must begin with a single `/`. `//evil.example` is a protocol-relative URL and
 *   `https://evil.example` is an absolute one; both would leave this origin.
 * - It must not begin with `/\` — some browsers normalize a backslash to a slash, which turns
 *   `/\evil.example` back into the protocol-relative case.
 * - Anything else — absent, empty, unparseable, or pointing at the offline page itself — yields
 *   `null`, and the caller falls back to reloading.
 *
 * `null` is a perfectly good answer. The button still works; it just has nowhere better to go.
 */
export const safeReturnPath = (raw: string | null): string | null => {
	if (!raw || raw.length < 1) return null;
	if (!raw.startsWith('/')) return null;
	if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
	if (raw === OFFLINE_FALLBACK_PATH || raw.startsWith(`${OFFLINE_FALLBACK_PATH}?`)) return null;
	return raw;
};

/**
 * Whether this device can actually open the app with no network — measured, not inferred.
 *
 * The tempting signal is `navigator.serviceWorker.ready`. It is wrong, and wrong in the direction
 * that matters: on an upgrade it resolves immediately with the **previous** active registration,
 * while the newly registered worker is still installing or waiting. On the deploy that ships this
 * change, that previous registration is precisely the version that cached no HTML — so `ready`
 * would report an offline copy at the one moment there certainly is not one.
 *
 * Three conditions, each closing a different hole:
 *
 * - `fallbackCached` — the offline document is really in a cache on this device, read back through
 *   `CacheSeam` rather than deduced from the fact that an install was requested.
 * - `hasController` — a worker is controlling *this page*. A freshly installed worker does not,
 *   until the next load, and a page no worker controls gets no cached response whatever is stored.
 * - `!hasPendingWorker` — no worker of this registration is installing or waiting. That is exactly
 *   the upgrade window: the new worker has filled the new cache, the old one is still answering
 *   from the old, and the two disagree about what offline means.
 *
 * The bias is deliberate. Saying "no offline copy" when there is one costs the reader a sentence;
 * saying "your saved pages still open" when they do not is the defect this whole run is about.
 */
export const offlineCopyIsReady = (input: {
	readonly fallbackCached: boolean;
	readonly hasController: boolean;
	readonly hasPendingWorker: boolean;
}): boolean => input.fallbackCached && input.hasController && !input.hasPendingWorker;

/**
 * The one sentence the app shows about its own connection, worded from what is actually known
 * rather than from `navigator.onLine` alone.
 *
 * `isOnline` is `null` before anything has read `navigator.onLine` — on the server, and in the
 * prerendered HTML the service worker replays during an outage. That case says **nothing**, and it
 * is a separate value rather than a default of `true` because "not asked yet" and "asked, and the
 * connection is up" are different facts that happen to render the same way today. A default that
 * is right by coincidence is the failure this run exists to fix, one file over.
 *
 * When it is known: whether being offline is survivable depends entirely on whether this device
 * finished caching the app, which the old `.catch(() => {})` discarded. The two cases read
 * differently because they are different — one is an inconvenience, the other ends the session.
 */
export const offlineNotice = (input: {
	readonly isOnline: boolean | null;
	readonly offlineCopyReady: boolean;
}): string => {
	if (input.isOnline === null || input.isOnline) return '';
	if (input.offlineCopyReady) {
		return 'Offline. Your saved pages and everything already on this device still open — a new verdict or coloring page needs a connection.';
	}
	return 'Offline, and this device has not finished saving an offline copy of the app yet. Reconnect to keep going.';
};
