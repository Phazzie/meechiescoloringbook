// Purpose: Contract tests for CacheSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail before adapter work.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  sampleCacheName,
  sampleCachedUrls,
  cacheOpenFailedFixture,
  cacheEvictFailedFixture,
  cacheMatchFailedFixture
} from './fixtures';
import { createMockCacheSeam } from './mock';

describe('CacheSeam mock contract', () => {
  it('primeCache succeeds and stores urls in sample scenario', async () => {
    const seam = createMockCacheSeam('sample');
    const result = await seam.primeCache(sampleCacheName, sampleCachedUrls);

    expect(result.ok).toBe(true);
  });

  it('primeCache fault fixture returns CACHE_OPEN_FAILED', async () => {
    const seam = createMockCacheSeam('fault');
    const result = await seam.primeCache(sampleCacheName, sampleCachedUrls);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(cacheOpenFailedFixture.code);
  });

  it('matchRequest returns a Response for a primed url', async () => {
    const seam = createMockCacheSeam('sample');
    await seam.primeCache(sampleCacheName, sampleCachedUrls);
    const result = await seam.matchRequest(sampleCachedUrls[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Response);
  });

  it('matchRequest returns null for an unprimed url', async () => {
    const seam = createMockCacheSeam('sample');
    const result = await seam.matchRequest('/not-cached.js');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('matchRequest accepts a Request object with absolute url', async () => {
    const seam = createMockCacheSeam('sample');
    // Request requires an absolute URL in browser/jsdom contexts.
    const absoluteUrl = 'http://localhost/_app/immutable/app.js';
    await seam.primeCache(sampleCacheName, [absoluteUrl]);
    const request = new Request(absoluteUrl);
    const result = await seam.matchRequest(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Response);
  });

  it('matchRequest fault fixture returns CACHE_MATCH_FAILED', async () => {
    const seam = createMockCacheSeam('fault');
    const result = await seam.matchRequest(sampleCachedUrls[0]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(cacheMatchFailedFixture.code);
  });

  it('evictStaleCaches succeeds and returns an array in sample scenario', async () => {
    const seam = createMockCacheSeam('sample');
    const result = await seam.evictStaleCaches(sampleCacheName);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.value)).toBe(true);
  });

  it('evictStaleCaches fault fixture returns CACHE_EVICT_FAILED', async () => {
    const seam = createMockCacheSeam('fault');
    const result = await seam.evictStaleCaches(sampleCacheName);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(cacheEvictFailedFixture.code);
  });

  it('primed urls are isolated per mock instance', async () => {
    const seam1 = createMockCacheSeam('sample');
    const seam2 = createMockCacheSeam('sample');
    await seam1.primeCache(sampleCacheName, sampleCachedUrls);

    const result1 = await seam1.matchRequest(sampleCachedUrls[0]);
    const result2 = await seam2.matchRequest(sampleCachedUrls[0]);

    expect(result1.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;
    expect(result1.value).toBeInstanceOf(Response);
    expect(result2.value).toBeNull();
  });
});
