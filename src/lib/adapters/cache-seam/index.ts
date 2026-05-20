// Purpose: Implement CacheSeam using the Web Cache API.
// Why: Isolate direct caches.* calls behind the seam contract so the service worker stays testable.
// Info flow: CacheSeam calls -> Web Cache API (available in browser and service worker context) -> Result<>.
import type { CacheError, CacheSeam } from '../../seams/cache-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
	validateCacheName,
	validateCacheUrlList
} from '../../seams/cache-seam/validators';

const errorMessage = (err: unknown, fallback: string): string =>
	err instanceof Error ? err.message : fallback;

export const createCacheSeam = (): CacheSeam => ({
	primeCache: async (
		cacheName,
		urls
	): Promise<Result<undefined, CacheError>> => {
		let cache: Cache;
		try {
			validateCacheName(cacheName);
			cache = await caches.open(cacheName);
		} catch (err) {
			return {
				ok: false,
				error: {
					code: 'CACHE_OPEN_FAILED',
					message: errorMessage(err, 'Failed to open cache.')
				}
			};
		}

		try {
			validateCacheUrlList(urls);
			await cache.addAll(urls);
			return { ok: true, value: undefined };
		} catch (err) {
			return {
				ok: false,
				error: {
					code: 'CACHE_ADD_ALL_FAILED',
					message: errorMessage(err, 'Failed to pre-cache one or more assets.')
				}
			};
		}
	},

	evictStaleCaches: async (
		currentCacheName
	): Promise<Result<string[], CacheError>> => {
		try {
			validateCacheName(currentCacheName);
			const keys = await caches.keys();
			const stale = keys.filter((k) => k !== currentCacheName);
			const results = await Promise.allSettled(
				stale.map((k) => caches.delete(k))
			);
			const failedKeys = results.flatMap((result, index) =>
				result.status === 'rejected' ? [stale[index]] : []
			);
			if (failedKeys.length > 0) {
				return {
					ok: false,
					error: {
						code: 'CACHE_EVICT_FAILED',
						message: `Failed to evict stale caches: ${failedKeys.join(', ')}`
					}
				};
			}
			return { ok: true, value: stale };
		} catch (err) {
			return {
				ok: false,
				error: {
					code: 'CACHE_EVICT_FAILED',
					message: errorMessage(err, 'Failed to evict stale caches.')
				}
			};
		}
	},

	matchRequest: async (
		request
	): Promise<Result<Response | null, CacheError>> => {
		try {
			const response = await caches.match(request);
			return { ok: true, value: response ?? null };
		} catch (err) {
			return {
				ok: false,
				error: {
					code: 'CACHE_MATCH_FAILED',
					message: errorMessage(err, 'Cache match operation failed.')
				}
			};
		}
	}
});
