// Purpose: Document CacheSeam probe strategy.
// Why: The Web Cache API is only available in browser and service worker contexts; automated Node.js probing is not possible.
// Info flow: N/A — no automated probe; manual verification via browser DevTools.
//
// Manual verification steps:
//   1. Run `npm run build && npm run preview` to serve the production build.
//   2. Open the app in Chrome/Edge and install it as a PWA.
//   3. Open DevTools > Application > Cache Storage.
//   4. Confirm the version-stamped cache (cb-cache-<version>) contains all build assets.
//   5. Throttle the network to Offline and reload — the app should load from cache.
//   6. Deploy a new version; confirm the old cache is evicted on the next activate event.
//
// No fixture refresh is needed: the adapter is a thin pass-through over a stable browser API.
