// Purpose: Implement CacheSeam using the Web Cache API.
// Why: Isolate direct caches.* calls behind the seam contract so the service worker stays testable.
// Info flow: CacheSeam calls -> Web Cache API (available in browser and service worker context) -> Result<>.
import type { CacheError, CacheSeam } from '../../seams/cache-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

export const createCacheSeam = (): CacheSeam => ({
  primeCache: async (cacheName, urls): Promise<Result<undefined, CacheError>> => {
    try {
      const cache = await caches.open(cacheName);
      await cache.addAll(urls);
      return { ok: true, value: undefined };
    } catch (err) {
      if (err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'AbortError')) {
        return { ok: false, error: { code: 'CACHE_OPEN_FAILED', message: err.message } };
      }
      return {
        ok: false,
        error: {
          code: 'CACHE_ADD_ALL_FAILED',
          message: err instanceof Error ? err.message : 'Failed to pre-cache one or more assets.'
        }
      };
    }
  },

  evictStaleCaches: async (currentCacheName): Promise<Result<string[], CacheError>> => {
    try {
      const keys = await caches.keys();
      const stale = keys.filter((k) => k !== currentCacheName);
      await Promise.all(stale.map((k) => caches.delete(k)));
      return { ok: true, value: stale };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'CACHE_EVICT_FAILED',
          message: err instanceof Error ? err.message : 'Failed to evict stale caches.'
        }
      };
    }
  },

  matchRequest: async (request): Promise<Result<Response | null, CacheError>> => {
    try {
      const response = await caches.match(request);
      return { ok: true, value: response ?? null };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'CACHE_MATCH_FAILED',
          message: err instanceof Error ? err.message : 'Cache match operation failed.'
        }
      };
    }
  }
});
