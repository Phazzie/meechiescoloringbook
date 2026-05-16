// Purpose: Provide fixture data for CacheSeam tests.
// Why: Ensure deterministic mock and test inputs without live Cache API access.
// Info flow: fixtures -> mock/tests.

export const sampleCacheName = 'cb-cache-v1';
export const sampleCachedUrls = ['/_app/immutable/app.js', '/_app/immutable/styles.css', '/'];
export const staleCacheNames = ['cb-cache-v0', 'cb-cache-old'];

export const cacheOpenFailedFixture = {
  code: 'CACHE_OPEN_FAILED' as const,
  message: 'Failed to open cache: storage quota may be exceeded.'
};

export const cacheAddAllFailedFixture = {
  code: 'CACHE_ADD_ALL_FAILED' as const,
  message: 'Failed to pre-cache one or more assets.'
};

export const cacheEvictFailedFixture = {
  code: 'CACHE_EVICT_FAILED' as const,
  message: 'Failed to evict stale cache entries.'
};

export const cacheMatchFailedFixture = {
  code: 'CACHE_MATCH_FAILED' as const,
  message: 'Cache match operation failed unexpectedly.'
};
