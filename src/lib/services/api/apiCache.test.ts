import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	buildCacheKey,
	cachedFetch,
	getCacheEntry,
	invalidateAll,
	setCacheEntry,
	wrapFetch
} from './apiCache';

const mockStorage = () => {
	const store = new Map<string, string>();
	const localStorage = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, value);
		}
	};

	Object.assign(globalThis, { localStorage, window: { localStorage } });
	return { store, localStorage };
};

describe('apiCache', () => {
	beforeEach(() => {
		mockStorage();
		invalidateAll();
		vi.useRealTimers();
	});

	it('builds cache keys with sorted query params', () => {
		const key = buildCacheKey('GET', '/api/example?b=2&a=1');
		expect(key.endsWith('/api/example?a=1&b=2')).toBe(true);
	});

	it('expires stale entries based on TTL', () => {
		const now = Date.now();
		const key = buildCacheKey('GET', '/api/stale');
		setCacheEntry(key, {
			data: { ok: true },
			createdAt: now - 8 * 24 * 60 * 60 * 1000,
			lastUpdated: now - 8 * 24 * 60 * 60 * 1000
		});

		expect(getCacheEntry(key)).toBeUndefined();
	});

	it('returns cached data when server responds 304', async () => {
		const key = buildCacheKey('GET', '/api/cached');
		setCacheEntry(key, {
			data: { foo: 'bar' },
			createdAt: Date.now() - 1000,
			lastUpdated: Date.now() - 1000,
			etag: 'abc123'
		});

		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(null, {
				status: 304,
				headers: {
					ETag: 'abc123'
				}
			})
		);

		const response = await cachedFetch(fetchSpy as unknown as typeof fetch, '/api/cached');
		const body = await response.json();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(body).toEqual({ foo: 'bar' });
	});

	it('respects explicit cache opt-out', async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await cachedFetch(fetchSpy as unknown as typeof fetch, '/api/skip', {
			cache: false as unknown as RequestCache
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(getCacheEntry(buildCacheKey('GET', '/api/skip'))).toBeUndefined();
	});

	it('derives Last-Modified from updated_at when header missing', async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify([
					{ id: 1, updated_at: '2024-01-01T00:00:00Z' },
					{ id: 2, updated_at: '2024-02-01T00:00:00Z' }
				]),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		await wrapFetch(fetchSpy as unknown as typeof fetch)('/api/derived');
		const entry = getCacheEntry(buildCacheKey('GET', '/api/derived'));

		expect(entry?.lastModified).toBe('2024-02-01T00:00:00Z');
	});

	it('derives Last-Modified from camelCase timestamps and partial arrays', async () => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify([
					{ id: 1, updatedAt: '2024-01-01T00:00:00Z' },
					{ id: 2, name: 'no-updated' },
					{ id: 3, updatedAt: '2024-03-01T00:00:00Z' }
				]),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		await wrapFetch(fetchSpy as unknown as typeof fetch)('/api/camel');
		const entry = getCacheEntry(buildCacheKey('GET', '/api/camel'));

		expect(entry?.lastModified).toBe('2024-03-01T00:00:00Z');
	});

	it('serves fresh cache without hitting the network when no validators exist', async () => {
		const key = buildCacheKey('GET', '/api/fresh');
		setCacheEntry(key, {
			data: { ok: true },
			createdAt: Date.now(),
			lastUpdated: Date.now()
		});

		const fetchSpy = vi.fn();
		const response = await cachedFetch(fetchSpy as unknown as typeof fetch, '/api/fresh');
		const body = await response.json();

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(body).toEqual({ ok: true });
	});

	it('uses derived last-modified to revalidate', async () => {
		const key = buildCacheKey('GET', '/api/derived');
		setCacheEntry(key, {
			data: { ok: true },
			createdAt: Date.now(),
			lastUpdated: Date.now(),
			lastModified: '2024-01-01T00:00:00Z'
		});

		const fetchSpy = vi.fn().mockImplementation((request: Request) => {
			expect(request.headers.get('If-Modified-Since')).toBe('2024-01-01T00:00:00Z');
			return Promise.resolve(
				new Response(null, {
					status: 304,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		});

		const response = await cachedFetch(fetchSpy as unknown as typeof fetch, '/api/derived');
		const body = await response.json();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(body).toEqual({ ok: true });
	});
});
