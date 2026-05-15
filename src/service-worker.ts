/*
Purpose: Provide offline-capable caching for PWA installation via CacheSeam.
Why: Route all Web Cache API access through an approved seam adapter so the caching strategy is contract-tested and swappable.
Info flow: Build assets -> CacheSeam.primeCache (install) -> CacheSeam.matchRequest (fetch) -> CacheSeam.evictStaleCaches (activate).
*/
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { createCacheSeam } from './lib/adapters/cache-seam/index';

const CACHE = `cb-cache-${version}`;
const ASSETS = [...build, ...files];
const cacheSeam = createCacheSeam();

self.addEventListener('install', (event) => {
	event.waitUntil(cacheSeam.primeCache(CACHE, ASSETS));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(cacheSeam.evictStaleCaches(CACHE));
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	event.respondWith(
		cacheSeam.matchRequest(event.request).then((result) => {
			if (result.ok && result.value !== null) return result.value;
			return fetch(event.request);
		})
	);
});
