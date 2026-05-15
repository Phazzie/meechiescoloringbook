// Purpose: Mock CacheSeam behavior using an in-memory Map.
// Why: Allow service-worker logic to be unit-tested without the Web Cache API.
// Info flow: tests -> mock -> fixtures.
import type { CacheError, CacheSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
  cacheOpenFailedFixture,
  cacheEvictFailedFixture,
  cacheMatchFailedFixture
} from './fixtures';

export const createMockCacheSeam = (scenario: 'sample' | 'fault' = 'sample'): CacheSeam => {
  const store = new Map<string, Response>();

  return {
    primeCache: async (cacheName, urls): Promise<Result<undefined, CacheError>> => {
      if (scenario === 'fault') return { ok: false, error: cacheOpenFailedFixture };
      void cacheName;
      for (const url of urls) {
        store.set(url, new Response(null, { status: 200 }));
      }
      return { ok: true, value: undefined };
    },

    evictStaleCaches: async (currentCacheName): Promise<Result<string[], CacheError>> => {
      if (scenario === 'fault') return { ok: false, error: cacheEvictFailedFixture };
      void currentCacheName;
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
