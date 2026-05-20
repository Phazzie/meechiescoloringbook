// Purpose: Contract tests for CacheSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail before adapter work.
// Info flow: tests -> mock -> contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCacheSeam } from '../../adapters/cache-seam';
import {
	sampleCacheName,
	sampleCachedUrls,
	cacheOpenFailedFixture,
	cacheAddAllFailedFixture,
	cacheEvictFailedFixture,
	cacheMatchFailedFixture
} from './fixtures';
import { createMockCacheSeam } from './mock';
import { validateCacheName, validateCacheUrlList } from './validators';

afterEach(() => {
	vi.unstubAllGlobals();
});

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

	it('primeCache addAll fault fixture returns CACHE_ADD_ALL_FAILED', async () => {
		const seam = createMockCacheSeam('addAllFault');
		const result = await seam.primeCache(sampleCacheName, sampleCachedUrls);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(cacheAddAllFailedFixture.code);
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

	it('validators reject empty cache names and empty url lists', () => {
		expect(() => validateCacheName('')).toThrow();
		expect(() => validateCacheName(42)).toThrow();
		expect(() => validateCacheUrlList([])).toThrow();
		expect(() => validateCacheUrlList([''])).toThrow();
	});

	it('adapter rejects an invalid cache name before opening Cache Storage', async () => {
		const open = vi.fn();
		vi.stubGlobal('caches', {
			open,
			keys: vi.fn(),
			delete: vi.fn(),
			match: vi.fn()
		});

		const seam = createCacheSeam();
		const result = await seam.primeCache('', sampleCachedUrls);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('CACHE_OPEN_FAILED');
		expect(open).not.toHaveBeenCalled();
	});

	it('adapter reports addAll failures after a successful cache open', async () => {
		const addAll = vi.fn(async () => {
			throw new DOMException('pre-cache aborted', 'AbortError');
		});
		vi.stubGlobal('caches', {
			open: vi.fn(async () => ({ addAll })),
			keys: vi.fn(),
			delete: vi.fn(),
			match: vi.fn()
		});

		const seam = createCacheSeam();
		const result = await seam.primeCache(sampleCacheName, sampleCachedUrls);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('CACHE_ADD_ALL_FAILED');
		expect(addAll).toHaveBeenCalledWith(sampleCachedUrls);
	});

	it('adapter reports which stale cache deletions failed', async () => {
		vi.stubGlobal('caches', {
			open: vi.fn(),
			keys: vi.fn(async () => [sampleCacheName, 'old-a', 'old-b']),
			delete: vi.fn(async (key: string) => {
				if (key === 'old-b') throw new Error('delete failed');
				return true;
			}),
			match: vi.fn()
		});

		const seam = createCacheSeam();
		const result = await seam.evictStaleCaches(sampleCacheName);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('CACHE_EVICT_FAILED');
		expect(result.error.message).toContain('old-b');
	});
});
