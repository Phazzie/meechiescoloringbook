// Purpose: Point at the CacheSeam probe and record what it captures.
// Why: This file used to say "automated Node.js probing is not possible" and list six manual
//      DevTools steps instead. The first half is still true — the Web Cache API does not exist in
//      Node — but it had been read as "not automatable", and it is not the same claim: this
//      repository already drives a real browser for `probes/browser-seams.probe.mjs`. The cost of
//      the gap was concrete. Step 5 of the manual list was "Throttle the network to Offline and
//      reload — the app should load from cache", and on `main` at `ad3bfe7` that step would have
//      failed: the cache held 3,462,111 bytes of assets and zero documents, so an offline reload
//      produced the browser's own network-error page. Nobody had run it.
// Info flow: `node probes/cache-seam.probe.mjs` -> vite preview over the production build -> real
//      Chromium -> service worker install/activate -> Cache Storage read -> offline navigations ->
//      PASS/FAIL lines on stdout, non-zero exit if any check fails.
// Invariants:
//   - Not runnable through `npm run probe`, which transpiles a seam's `probe.ts` and imports it in
//     Node. This probe needs a browser, so it lives beside the other browser probe instead. That is
//     why this file exports no `runProbe`.
//   - It writes no fixture. CacheSeam's fixtures are error-shape constants rather than captured
//     payloads, and inventing a "sample cache" would be exactly the invented data the workflow
//     bans.
//
// Run it:
//   npm run build
//   node probes/cache-seam.probe.mjs
//   # PROBE_CHROMIUM_PATH=<chromium> if Playwright's bundled browser is not installed.
//
// What it establishes, all of it read back from the browser rather than arranged by the harness:
//   1. Exactly one versioned cache exists (cb-cache-<version>).
//   2. It holds the app's documents, not only its assets — the fact that was false before.
//   3. The offline fallback document is one of them.
//   4. robots.txt was skipped rather than cached.
//   5. The worker controls the page on the first load, without waiting for a second visit.
//   6. A prerendered route opens with the network off.
//   7. So does its trailing-slash form, which online is a redirect the network performs.
//   8. A path the build never produced lands on the offline page, not the browser's error page.
//   9. An API call is never answered from the cache while offline.
//
// Last run: 2026-09-06, 9/9 — docs/evidence/2026-09-06/probe-cache-seam.txt.
// Three defects were found by running it, each of which every unit test had passed over:
//   - the worker cached all fourteen documents and then controlled nothing, so the next navigation
//     was still ERR_INTERNET_DISCONNECTED (fixed with `clients.claim()` in activate);
//   - the fallback returned the offline page's bytes under the requested URL, and SvelteKit's
//     client router then rendered its 404 over the top (fixed by redirecting to /offline instead);
//   - and the probe's own first version read the cache mid-`addAll`, because it waited on
//     `registration.active.state` rather than on the cache having anything in it.
//
// Manual verification, still valid and still worth doing before a release, since the automated
// probe cannot install the app as a PWA or observe a real deploy's cache eviction:
//   1. `npm run build && npm run preview`.
//   2. Open the app in Chrome/Edge and install it as a PWA.
//   3. DevTools > Application > Cache Storage: confirm cb-cache-<version> holds the pages as well
//      as the assets.
//   4. Set the network to Offline and launch the installed app from its icon.
//   5. Deploy a new version; confirm the old cache is evicted on the next activate event.
export {};
