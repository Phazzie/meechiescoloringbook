/*
Purpose: Provide offline-capable caching for PWA installation.
Why: Enable installability and basic offline navigation.
Info flow: Build assets -> cache -> fetch handler.
*/
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cb-cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE)
					.map((key) => caches.delete(key))
			)
		)
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cached) => cached || fetch(event.request))
	);
});
