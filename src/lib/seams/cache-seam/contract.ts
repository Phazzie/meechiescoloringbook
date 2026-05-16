// Purpose: Define CacheSeam contract types.
// Why: Isolate Web Cache API access behind a contract so the service worker can be swapped for a mock in tests.
// Info flow: contract types -> adapter (real caches.*) / mock (in-memory Map) -> service-worker.ts.
import type { Result } from '../../../../contracts/shared.contract';

// CACHE_OPEN_FAILED: caches.open() rejected (e.g. QuotaExceededError).
// CACHE_ADD_ALL_FAILED: cache.addAll() rejected (e.g. network error during asset pre-caching).
// CACHE_EVICT_FAILED: caches.keys() or caches.delete() rejected during stale-cache cleanup.
// CACHE_MATCH_FAILED: caches.match() rejected unexpectedly.
export type CacheError =
  | { code: 'CACHE_OPEN_FAILED'; message: string }
  | { code: 'CACHE_ADD_ALL_FAILED'; message: string }
  | { code: 'CACHE_EVICT_FAILED'; message: string }
  | { code: 'CACHE_MATCH_FAILED'; message: string };

export type CacheSeam = {
  /** Open a named cache and pre-populate it with all given URLs. Used in the service worker install event. */
  primeCache: (cacheName: string, urls: string[]) => Promise<Result<undefined, CacheError>>;
  /** Delete every cache whose name does not match currentCacheName. Used in the service worker activate event. Returns the list of evicted cache names. */
  evictStaleCaches: (currentCacheName: string) => Promise<Result<string[], CacheError>>;
  /** Return the cached Response for a request, or null if not cached. Used in the service worker fetch event. */
  matchRequest: (request: Request | string) => Promise<Result<Response | null, CacheError>>;
};
