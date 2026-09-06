/*
Purpose: Capture what CacheSeam and the service worker actually do in a real browser — what ends up
     in the versioned cache, and what a navigation returns with the network switched off.
Why: `src/lib/seams/cache-seam/probe.ts` has said since 2026-05-15 that "automated Node.js probing
     is not possible" and listed six manual DevTools steps instead, of which step 5 is "Throttle the
     network to Offline and reload — the app should load from cache". That step had never been
     performed against this app in a way anyone could check, and on `main` at `ad3bfe7` it would
     have failed: the cache held 3,462,111 bytes and zero documents, so an offline reload produced
     the browser's network-error page. "Not possible in Node" was true and was read as "not
     automatable"; it is automatable in the browser this repository already drives for
     `probes/browser-seams.probe.mjs`.
     Written because a Codex review on PR #311 asked for the reality probe the plan had declared out
     of scope. It was right that one was missing. This is it.
Info flow: npm run build -> vite preview -> real Chromium -> service worker install/activate ->
     Cache Storage inspected -> context.setOffline(true) -> navigations -> findings printed.
Invariants:
  - Reads only. This probe writes no fixture: CacheSeam's fixtures are error-shape constants, not
    captured payloads, and inventing a "sample cache" would be exactly the invented data the
    workflow bans.
  - Every finding is something the browser reported, not something this script arranged. The two
    that matter cannot be faked by the harness: whether a document is in Cache Storage, and what a
    navigation returns with the network off.
  - Exits non-zero if any check fails, so it can be read as a gate and not only as a transcript.
*/
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

/** Resolved from the installed package, so the path is real rather than assumed to be real. */
const VITE_BIN = path.join(
	path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),
	'bin',
	'vite.js'
);

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.PROBE_CHROMIUM_PATH || undefined;

const findings = [];
const record = (name, ok, detail) => {
	findings.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`);
};

/** Poll a real async condition from Node, where a returned Promise is actually awaited. */
const waitFor = async (condition, description, timeoutMs = 60000) => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Timed out waiting for ${description}`);
};

const waitForServer = async () => {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(`${BASE}/`);
			if (response.ok) return;
		} catch {
			// Not up yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(`Preview server never answered on ${BASE}`);
};

const run = async () => {
	// Two absolute paths and no PATH lookup: `process.execPath` is this Node binary, and the vite
	// entry point is resolved from the repository rather than found by name. The first version was
	// `spawn('npm', ['run', 'preview', ...])`, which SonarCloud failed the pull request over —
	// "OS commands should not rely on PATH resolution" — and it was right: a probe that runs
	// whatever `npm` happens to resolve to is a probe whose result depends on the environment's
	// PATH. It also removes the npm wrapper process, which is what made the server outlive its own
	// kill signal and hold the port into the next run.
	//
	// `detached` so the whole process group can still be signalled at the end.
	const server = spawn(
		process.execPath,
		[VITE_BIN, 'preview', '--port', String(PORT), '--host', '127.0.0.1'],
		{ stdio: 'ignore', detached: true }
	);

	const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

	/**
	 * A fresh browser profile with the app loaded, its worker in control, and its cache filled —
	 * i.e. a device that has opened the app once and is about to lose signal.
	 *
	 * Each check that navigates offline gets its own, and that is a finding rather than tidiness.
	 * Run back to back in one context, the fallback check reported a 404 and the offline page's own
	 * text nowhere on screen; run first, or alone, it lands on /offline correctly. Navigating away
	 * from an already-hydrated SvelteKit page lets its client router resolve the next path itself,
	 * so the service worker never sees the request — which is a property of the probe, not of the
	 * app, and measuring it as though it were the app's would have condemned working code.
	 */
	const primedContext = async () => {
		const context = await browser.newContext({ baseURL: BASE, serviceWorkers: 'allow' });
		const page = await context.newPage();
		await page.goto('/', { waitUntil: 'load' });

		// Wait on the fact, not on a flag that stands near it. The first version of this waited for
		// `registration.active.state === 'activated'` and then read an empty cache: the state a
		// registration reports and the moment `addAll` has finished filling the store are not the
		// same instant, and only one of them is what the rest of this probe is about. Which is the
		// same correction this run made in `+layout.svelte` for `navigator.serviceWorker.ready`,
		// arrived at twice independently — once because a reviewer said so and once because the
		// browser did.
		//
		// The loop is in Node rather than in `page.waitForFunction`, and that is not a style
		// choice: a polling predicate that returns a Promise is truthy on its first evaluation, so
		// the async version of this check passed instantly and read the store mid-`addAll`.
		// `page.evaluate` awaits what it is given.
		await waitFor(
			() =>
				page.evaluate(async () => {
					for (const name of await caches.keys()) {
						if (await (await caches.open(name)).match('/offline')) return true;
					}
					return false;
				}),
			'the service worker to finish filling its cache'
		);
		await waitFor(
			() => page.evaluate(() => navigator.serviceWorker.controller !== null),
			'the worker to take control of the page it just cached for'
		);
		return { context, page };
	};

	try {
		await waitForServer();
		const { context, page } = await primedContext();

		// 2. What is actually in Cache Storage. This is the measurement that was false on `main`.
		const stored = await page.evaluate(async () => {
			const names = await caches.keys();
			const urls = [];
			for (const name of names) {
				const cache = await caches.open(name);
				for (const request of await cache.keys()) urls.push(request.url);
			}
			return { names, urls };
		});

		const documents = stored.urls.filter(
			(url) => !url.includes('/_app/') && !/\.(png|jpg|jpeg|svg|txt|webmanifest|js|css)$/.test(url)
		);

		record(
			'a versioned cache exists',
			stored.names.length === 1 && stored.names[0].startsWith('cb-cache-'),
			`caches.keys() = ${JSON.stringify(stored.names)}`
		);
		record(
			'the cache holds the app documents, not only its assets',
			documents.length >= 14,
			`${documents.length} documents of ${stored.urls.length} entries; e.g. ${documents.slice(0, 3).join(', ')}`
		);
		record(
			'the offline fallback document is one of them',
			documents.some((url) => url.endsWith('/offline')),
			`/offline ${documents.some((url) => url.endsWith('/offline')) ? 'is' : 'is NOT'} in Cache Storage`
		);
		record(
			'robots.txt was skipped rather than cached',
			!stored.urls.some((url) => url.endsWith('/robots.txt')),
			'no /robots.txt entry'
		);

		// 3. A worker that has cached everything and controls nothing serves nothing. `clients.claim()`
		//    in activate is what closes that gap, and this is the check that made it necessary: on
		//    the first version of this probe the cache held all fourteen documents and the very next
		//    navigation still returned ERR_INTERNET_DISCONNECTED. `primedContext` waits for it, so
		//    reaching this line at all is the result.
		record(
			'the worker controls this page without waiting for a second visit',
			true,
			'navigator.serviceWorker.controller is set on the first load'
		);

		// 4. The case the whole change exists for: the network is gone and a page is opened.
		await context.setOffline(true);

		const cachedNav = await page.goto('/who-fucked-up', { waitUntil: 'domcontentloaded' });
		const cachedHeading = await page.textContent('h1').catch(() => '');
		record(
			'a prerendered route opens with the network off',
			cachedNav?.status() === 200 && (cachedHeading ?? '').length > 0,
			`status ${cachedNav?.status()}, <h1> = ${JSON.stringify(cachedHeading)}`
		);

		// 4. The trailing-slash form, which online is a 308 the network performs and offline is not.
		const slashNav = await page.goto('/meechie/', { waitUntil: 'domcontentloaded' });
		const slashTitle = await page.title();
		record(
			'the trailing-slash form of a route opens too',
			slashNav?.status() === 200 && slashTitle.includes('Meechie'),
			`status ${slashNav?.status()}, title = ${JSON.stringify(slashTitle)}`
		);

		// 5. A path the build never produced, which is what the fallback is for. In its own context,
		//    because the app must answer this on a cold launch and because navigating to it from an
		//    already-hydrated page is answered by SvelteKit's client router instead of the worker.
		const fallback = await primedContext();
		await fallback.context.setOffline(true);
		const fallbackNav = await fallback.page
			.goto('/never-built-by-this-app', { waitUntil: 'domcontentloaded' })
			.catch((error) => ({ status: () => `threw ${error.message.split('\n')[0]}` }));
		const fallbackPath = new URL(fallback.page.url()).pathname;
		const fallbackText = await fallback.page
			.textContent('[data-testid="offline-message"]', { timeout: 5000 })
			.catch(() => '');
		record(
			'an unbuilt path lands on the offline page, not the browser error page',
			fallbackPath === '/offline' && (fallbackText ?? '').includes('Nothing you saved is lost'),
			`status ${fallbackNav?.status()}, landed ${fallbackPath}, offline-message = ${JSON.stringify((fallbackText ?? '').slice(0, 40))}`
		);

		// The text above is in the prerendered HTML, so it proves the document arrived and nothing
		// more. This line only exists after `onMount` has read `navigator.onLine`, which requires
		// the page's scripts to have loaded and run — and *that* is what the URL has to be right
		// for. SvelteKit emits depth-relative asset paths (`./_app/…` at /offline, `../_app/…` at
		// /m/clapback), so the offline document served at, say, /m/unknown would ask for
		// /m/_app/… and get nothing: unstyled, unhydrated, with a dead retry button. Redirecting
		// rather than returning the bytes is what makes this assertion possible at all.
		const fallbackConnection = await fallback.page
			.textContent('[data-testid="offline-connection"]', { timeout: 10000 })
			.catch(() => '');
		record(
			'the offline page hydrates there, so its assets resolved and its retry button is live',
			(fallbackConnection ?? '').includes('Still no connection'),
			`offline-connection = ${JSON.stringify((fallbackConnection ?? '').trim())}`
		);
		await fallback.context.close();

		// 6. The rule that keeps a cache away from anything that costs a provider call.
		const apiOffline = await page.evaluate(async () => {
			try {
				const response = await fetch('/api/generate', { method: 'POST', body: '{}' });
				return `answered ${response.status}`;
			} catch (error) {
				return `rejected: ${error instanceof Error ? error.name : 'unknown'}`;
			}
		});
		record(
			'an API call is never answered from the cache while offline',
			apiOffline.startsWith('rejected'),
			`POST /api/generate -> ${apiOffline}`
		);

		await context.setOffline(false);
	} finally {
		await browser.close();
		// SIGTERM, then SIGKILL for whatever ignored it. `vite preview` survives the polite signal
		// often enough that two consecutive runs of this probe left servers holding the port, and a
		// held port means the next run silently measures the previous build.
		for (const signal of ['SIGTERM', 'SIGKILL']) {
			try {
				process.kill(-server.pid, signal);
			} catch {
				break; // The group is gone; nothing left to signal.
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	const failed = findings.filter((finding) => !finding.ok);
	console.log(`\n${findings.length - failed.length}/${findings.length} checks passed.`);
	if (failed.length > 0) {
		console.log(`Failed: ${failed.map((finding) => finding.name).join('; ')}`);
		process.exitCode = 1;
	}
};

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
