// Purpose: Force this route to be prerendered so a real HTML file exists at `/offline`.
// Why: The service worker answers an unreachable navigation with this page, and it can only do
//      that if `cache.addAll` had something to store at install time. A route that is rendered on
//      demand produces no such file: `$service-worker`'s `prerendered` list would not contain
//      `/offline`, `planPrecache` would report `fallbackAvailable: false`, and the offline
//      fallback would silently stop existing. This one line is the whole reason it does.
// Info flow: build -> prerendered /offline HTML -> $service-worker `prerendered` ->
//            planPrecache critical set -> cache.addAll -> handleFetch navigation fallback.
// Invariants: Must stay `true`. `OFFLINE_FALLBACK_PATH` in `src/lib/core/offline-cache.ts` names
//             this route by path, and `tests/unit/offline-cache.test.ts` pins what happens when
//             the two come apart.
export const prerender = true;
