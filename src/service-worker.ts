/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `takkei-cache-${version}`;
const ASSET_URLS = [...build, ...files];
const OFFLINE_FALLBACK = '/';
const APP_SHELL = [...ASSET_URLS, OFFLINE_FALLBACK];
const ASSET_SET = new Set(ASSET_URLS);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET' || request.headers.has('range')) {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== sw.location.origin) {
		return;
	}

	if (url.pathname.startsWith('/api')) {
		return;
	}

	if (ASSET_SET.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(request));
		return;
	}
});

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	if (cached) {
		return cached;
	}

	const response = await fetch(request);
	if (response && response.ok) {
		cache.put(request, response.clone());
	}
	return response;
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);

	try {
		const response = await fetch(request);
		if (response && response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}

		if (request.mode === 'navigate') {
			const fallback = await cache.match(OFFLINE_FALLBACK);
			if (fallback) {
				return fallback;
			}
		}

		throw error;
	}
}
