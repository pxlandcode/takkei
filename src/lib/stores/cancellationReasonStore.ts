import { get, writable } from 'svelte/store';
import {
	fallbackCancellationReasonOptions,
	type CancellationReasonOption
} from '$lib/helpers/bookingHelpers/cancellation';

type FetchLike = typeof fetch;

export const cancellationReasons = writable<CancellationReasonOption[]>([
	...fallbackCancellationReasonOptions
]);
export const allCancellationReasons = writable<CancellationReasonOption[]>([
	...fallbackCancellationReasonOptions
]);

let hasLoaded = false;
let hasLoadedAll = false;
let pendingFetch: Promise<CancellationReasonOption[]> | null = null;
let pendingFetchAll: Promise<CancellationReasonOption[]> | null = null;

function normalizeOptions(value: unknown): CancellationReasonOption[] {
	if (!Array.isArray(value)) return [...fallbackCancellationReasonOptions];

	return value
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const option = item as { value?: unknown; label?: unknown };
			const value = typeof option.value === 'string' ? option.value.trim() : '';
			const label = typeof option.label === 'string' ? option.label.trim() : '';
			if (!value || !label) return null;
			return { value, label };
		})
		.filter((item): item is CancellationReasonOption => Boolean(item));
}

export async function fetchCancellationReasons(fetchFn?: FetchLike) {
	const fetcher = fetchFn ?? fetch;
	try {
		const response = await fetcher('/api/get-cancellation-reasons');
		if (!response.ok) throw new Error('Failed to fetch cancellation reasons');
		const data = normalizeOptions(await response.json());
		cancellationReasons.set(data);
		if (!hasLoadedAll) {
			allCancellationReasons.set(data);
		}
		hasLoaded = true;
		return data;
	} catch (error) {
		console.error('Error fetching cancellation reasons:', error);
		const fallback = [...fallbackCancellationReasonOptions];
		cancellationReasons.set(fallback);
		if (!hasLoadedAll) {
			allCancellationReasons.set(fallback);
		}
		hasLoaded = true;
		return fallback;
	}
}

export async function fetchAllCancellationReasons(fetchFn?: FetchLike) {
	const fetcher = fetchFn ?? fetch;
	try {
		const response = await fetcher('/api/get-cancellation-reasons?includeInactive=true');
		if (!response.ok) throw new Error('Failed to fetch cancellation reason labels');
		const data = normalizeOptions(await response.json());
		allCancellationReasons.set(data);
		hasLoadedAll = true;
		return data;
	} catch (error) {
		console.error('Error fetching cancellation reason labels:', error);
		const fallback = [...fallbackCancellationReasonOptions];
		allCancellationReasons.set(fallback);
		hasLoadedAll = true;
		return fallback;
	}
}

export async function ensureCancellationReasonsLoaded(fetchFn?: FetchLike) {
	if (hasLoaded) return get(cancellationReasons);
	if (!pendingFetch) {
		pendingFetch = fetchCancellationReasons(fetchFn).finally(() => {
			pendingFetch = null;
		});
	}
	return pendingFetch;
}

export async function ensureAllCancellationReasonsLoaded(fetchFn?: FetchLike) {
	if (hasLoadedAll) return get(allCancellationReasons);
	if (!pendingFetchAll) {
		pendingFetchAll = fetchAllCancellationReasons(fetchFn).finally(() => {
			pendingFetchAll = null;
		});
	}
	return pendingFetchAll;
}

export function getCancellationReasonOptions() {
	return hasLoaded ? get(cancellationReasons) : [...fallbackCancellationReasonOptions];
}
