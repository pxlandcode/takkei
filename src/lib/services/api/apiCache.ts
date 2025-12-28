const CACHE_NAMESPACE = 'TAKKEI_API_CACHE_V1';
const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_DEBUG_ENABLED =
	typeof console !== 'undefined' &&
	(Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_LOG_API_CACHE === 'true');

type CacheEntry<T = unknown> = {
	data: T;
	createdAt: number;
	lastUpdated: number;
	etag?: string;
	lastModified?: string;
};

type FetchLike = typeof fetch;
type CachedFetchInit = RequestInit & {
	/**
	 * Explicit cache opt-out. Also respected when `nocache` is present in the query string.
	 */
	cache?: RequestCache | boolean;
};

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function cacheDisabledExplicitly(options?: CachedFetchInit) {
	return typeof options?.cache === 'boolean' ? options.cache === false : false;
}

function logCache(message: string, meta?: Record<string, unknown>) {
	if (!CACHE_DEBUG_ENABLED) return;
	if (meta) {
		console.info('[apiCache]', message, meta);
	} else {
		console.info('[apiCache]', message);
	}
}

function cacheBypassReason(url: string, options?: CachedFetchInit): string | undefined {
	if (import.meta.env?.VITE_DISABLE_API_CACHE) return 'env-disabled';
	if (cacheDisabledExplicitly(options)) return 'cache-false';

	try {
		const parsed = new URL(url, 'http://localhost');
		if (parsed.searchParams.has('nocache')) return 'query-nocache';
	} catch {
		// ignore
	}

	return undefined;
}

function shouldBypassCache(url: string, options?: CachedFetchInit) {
	return Boolean(cacheBypassReason(url, options));
}

function normalizeUrl(rawUrl: string) {
	const parsed = new URL(rawUrl, 'http://localhost');
	const entries = Array.from(parsed.searchParams.entries()).sort(([aKey, aVal], [bKey, bVal]) => {
		if (aKey === bKey) return aVal.localeCompare(bVal);
		return aKey.localeCompare(bKey);
	});
	const normalizedParams = new URLSearchParams();
	entries.forEach(([k, v]) => normalizedParams.append(k, v));
	const qs = normalizedParams.toString();
	return `${parsed.pathname}${qs ? `?${qs}` : ''}`;
}

export function buildCacheKey(method: string, url: string) {
	const normalizedUrl = normalizeUrl(url);
	return `${CACHE_NAMESPACE}:${method.toUpperCase()}:${normalizedUrl}`;
}

function listCacheKeys(): string[] {
	if (!isBrowser()) return [];
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_NAMESPACE)) {
			keys.push(key);
		}
	}
	return keys;
}

function removeExpiredEntries(now: number) {
	for (const key of listCacheKeys()) {
		const value = localStorage.getItem(key);
		if (!value) continue;
		try {
			const parsed = JSON.parse(value) as CacheEntry;
			if (now - parsed.lastUpdated > CACHE_TTL_MS) {
				localStorage.removeItem(key);
			}
		} catch {
			localStorage.removeItem(key);
		}
	}
}

function enforceLimit() {
	const keys = listCacheKeys();
	if (keys.length <= MAX_CACHE_ENTRIES) return;

	const entries: Array<{ key: string; lastUpdated: number }> = [];
	for (const key of keys) {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			const parsed = JSON.parse(raw) as CacheEntry;
			entries.push({ key, lastUpdated: parsed.lastUpdated ?? 0 });
		} catch {
			localStorage.removeItem(key);
		}
	}

	entries
		.sort((a, b) => a.lastUpdated - b.lastUpdated)
		.slice(0, Math.max(0, entries.length - MAX_CACHE_ENTRIES))
		.forEach((entry) => localStorage.removeItem(entry.key));
}

export function getCacheEntry<T = unknown>(key: string): CacheEntry<T> | undefined {
	if (!isBrowser()) return undefined;
	const now = Date.now();
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as CacheEntry<T>;
		if (now - parsed.lastUpdated > CACHE_TTL_MS) {
			localStorage.removeItem(key);
			return undefined;
		}
		return parsed;
	} catch {
		localStorage.removeItem(key);
		return undefined;
	}
}

export function setCacheEntry(key: string, entry: CacheEntry) {
	if (!isBrowser()) return;
	const now = Date.now();
	removeExpiredEntries(now);
	try {
		localStorage.setItem(key, JSON.stringify(entry));
		enforceLimit();
	} catch {
		// If storage is full, try to evict oldest and retry once
		enforceLimit();
		try {
			localStorage.setItem(key, JSON.stringify(entry));
		} catch {
			// give up silently
		}
	}
}

export function removeCacheEntry(key: string) {
	if (!isBrowser()) return;
	localStorage.removeItem(key);
}

export function invalidateAll() {
	if (!isBrowser()) return;
	listCacheKeys().forEach((key) => localStorage.removeItem(key));
}

export function invalidateByPrefix(prefix: string) {
	if (!isBrowser()) return;
	listCacheKeys()
		.filter((key) => key.includes(`:${prefix}`))
		.forEach((key) => localStorage.removeItem(key));
}

export function invalidateMatch(predicate: (key: string) => boolean) {
	if (!isBrowser()) return;
	listCacheKeys()
		.filter(predicate)
		.forEach((key) => localStorage.removeItem(key));
}

function deriveLastModified(data: any): string | undefined {
	if (!data) return undefined;

	const toTimestampString = (candidate: any): string | undefined => {
		if (typeof candidate === 'string') return candidate;
		if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) return candidate.toISOString();
		return undefined;
	};

	const extractTimestamp = (value: any): string | undefined => {
		if (!value || typeof value !== 'object') return undefined;
		const candidate = toTimestampString(
			value.updated_at ??
				value.updatedAt ??
				value.last_modified ??
				value.lastModified ??
				value.created_at ??
				value.createdAt
		);
		return candidate;
	};

	if (Array.isArray(data) && data.length > 0) {
		const timestamps = data.map(extractTimestamp).filter((v): v is string => Boolean(v));
		if (timestamps.length > 0) {
			return timestamps.sort().at(-1);
		}
	}

	if (data && typeof data === 'object') {
		const ts = extractTimestamp(data);
		if (ts) return ts;
	}

	return undefined;
}

function buildResponseFromCache(entry: CacheEntry) {
	return new Response(JSON.stringify(entry.data), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			...(entry.etag ? { ETag: entry.etag } : {}),
			...(entry.lastModified ? { 'Last-Modified': entry.lastModified } : {})
		}
	});
}

function resolveRequestInfo(
	input: RequestInfo | URL,
	init?: CachedFetchInit
): { url: string; method: string; init: CachedFetchInit; headers: Headers } {
	if (input instanceof Request) {
		const headers = new Headers(input.headers);
		if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
		return {
			url: input.url,
			method: init?.method ?? input.method ?? 'GET',
			init: { ...init, headers },
			headers
		};
	}

	const headers = new Headers(init?.headers);
	return {
		url: typeof input === 'string' ? input : input.toString(),
		method: init?.method ?? 'GET',
		init: { ...init, headers },
		headers
	};
}

function cacheableMethod(method: string) {
	return method.toUpperCase() === 'GET';
}

export async function cachedFetch(
	fetchLike: FetchLike,
	input: RequestInfo | URL,
	options?: CachedFetchInit
): Promise<Response> {
	const { url, method, init, headers } = resolveRequestInfo(input, options);

	const normalizedUrl = normalizeUrl(url);

	if (!cacheableMethod(method)) {
		logCache('skip (non-cacheable method)', { method, url: normalizedUrl });
		return fetchLike(input as any, options);
	}

	if (!isBrowser()) {
		logCache('skip (non-browser)', { method, url: normalizedUrl });
		return fetchLike(input as any, options);
	}

	const bypassReason = cacheBypassReason(url, options);
	if (bypassReason) {
		logCache('bypass cache', { method, url: normalizedUrl, reason: bypassReason });
		return fetchLike(input as any, options);
	}

	const key = buildCacheKey(method, url);
	const cached = getCacheEntry(key);

	if (cached) {
		// If we lack validators, serve from cache within TTL; otherwise revalidate with conditional GET
		const hasValidators = Boolean(cached.etag || cached.lastModified);
		if (!hasValidators) {
			return buildResponseFromCache(cached);
		}
		logCache('cache revalidate', {
			method,
			url: normalizedUrl,
			etag: cached.etag,
			lastModified: cached.lastModified
		});
	} else {
		logCache('cache miss', { method, url: normalizedUrl });
	}

	if (cached?.etag) {
		headers.set('If-None-Match', cached.etag);
	} else if (cached?.lastModified) {
		headers.set('If-Modified-Since', cached.lastModified);
	}

	const resolvedUrl = (() => {
		try {
			return new URL(url, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost').toString();
		} catch {
			return url;
		}
	})();

	const request =
		input instanceof Request
			? new Request(input, { ...init, method, headers })
			: new Request(typeof input === 'string' || input instanceof URL ? resolvedUrl : input, {
					...init,
					method,
					headers
				});

	const response = await fetchLike(request);

	if (response.status === 304 && cached) {
		setCacheEntry(key, { ...cached, lastUpdated: Date.now() });
		logCache('served from cache (304)', { method, url: normalizedUrl });
		return buildResponseFromCache({ ...cached, lastUpdated: Date.now() });
	}

	if (!response.ok) {
		logCache('skip caching (non-ok response)', { method, url: normalizedUrl, status: response.status });
		return response;
	}

	let data: unknown;
	try {
		const cloned = response.clone();
		data = await cloned.json();
	} catch {
		logCache('skip caching (unparsable json)', { method, url: normalizedUrl });
		return response;
	}

	const etag = response.headers.get('etag') ?? undefined;
	const lastModifiedFromHeader = response.headers.get('last-modified') ?? undefined;
	const derivedLastModified = lastModifiedFromHeader ?? deriveLastModified(data);

	if (!lastModifiedFromHeader) {
		logCache('missing Last-Modified header', {
			method,
			url: normalizedUrl,
			derived: Boolean(derivedLastModified)
		});
	}

	const entry: CacheEntry = {
		data,
		createdAt: cached?.createdAt ?? Date.now(),
		lastUpdated: Date.now(),
		etag,
		lastModified: derivedLastModified
	};

	setCacheEntry(key, entry);
	logCache('cache updated', {
		method,
		url: normalizedUrl,
		status: response.status,
		etag,
		lastModified: entry.lastModified
	});

	return response;
}

export function wrapFetch(fetchLike: FetchLike): FetchLike {
	return ((input: RequestInfo | URL, init?: CachedFetchInit) => cachedFetch(fetchLike, input, init)) as FetchLike;
}
