// Purpose: Mock CacheSeam behavior using an in-memory Map.
// Why: Allow service-worker logic to be unit-tested without the Web Cache API.
// Info flow: tests -> mock -> fixtures.
import type { CacheError, CacheSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
  cacheOpenFailedFixture,
  cacheAddAllFailedFixture,
  cacheEvictFailedFixture,
  cacheMatchFailedFixture
} from './fixtures';
import { validateCacheName, validateCacheUrlList } from './validators';

type CacheScenario = 'sample' | 'fault' | 'addAllFault';

const validationError = (code: CacheError['code'], err: unknown): CacheError => ({
  code,
  message: err instanceof Error ? err.message : 'Cache input validation failed.'
});

export const createMockCacheSeam = (scenario: CacheScenario = 'sample'): CacheSeam => {
  const store = new Map<string, Response>();

  return {
    primeCache: async (cacheName, urls): Promise<Result<undefined, CacheError>> => {
      try {
        validateCacheName(cacheName);
      } catch (err) {
        return { ok: false, error: validationError('CACHE_OPEN_FAILED', err) };
      }
      try {
        validateCacheUrlList(urls);
      } catch (err) {
        return { ok: false, error: validationError('CACHE_ADD_ALL_FAILED', err) };
      }
      if (scenario === 'fault') return { ok: false, error: cacheOpenFailedFixture };
      if (scenario === 'addAllFault') return { ok: false, error: cacheAddAllFailedFixture };
      for (const url of urls) {
        store.set(url, new Response(null, { status: 200 }));
      }
      return { ok: true, value: undefined };
    },

    evictStaleCaches: async (currentCacheName): Promise<Result<string[], CacheError>> => {
      try {
        validateCacheName(currentCacheName);
      } catch (err) {
        return { ok: false, error: validationError('CACHE_EVICT_FAILED', err) };
      }
      if (scenario === 'fault') return { ok: false, error: cacheEvictFailedFixture };
      // Mock maintains a single in-memory store — no stale caches to evict.
      return { ok: true, value: [] };
    },

    matchRequest: async (request): Promise<Result<Response | null, CacheError>> => {
      if (scenario === 'fault') return { ok: false, error: cacheMatchFailedFixture };
      const url = typeof request === 'string' ? request : request.url;
      const response = store.get(url) ?? null;
      return { ok: true, value: response };
    }
  };
};
