// src/lib/stores/targetGoalsStore.ts
import { writable } from 'svelte/store';
import { getTargetGoals } from '$lib/services/api/targetGoalsService';
import type { TargetGoalsResponse } from '$lib/services/api/targetGoalsService';
import { loadingStore } from './loading';

export type OwnerType = 'trainer' | 'location';

export interface YearGoal {
	value: number | null;
}
export interface MonthGoal {
	month: number;
	goal_value: number;
}

export const yearGoalStore = writable<YearGoal>({ value: null });
export const monthGoalsStore = writable<MonthGoal[]>([]);
export const goalsLoading = writable(false);
export const goalsError = writable<string | null>(null);

const isBrowser = typeof window !== 'undefined';

type TargetGoalsParams = {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	targetKindId: number;
};

const cache = new Map<string, TargetGoalsResponse>();
const inflightRequests = new Map<string, Promise<TargetGoalsResponse>>();

let pendingRequests = 0;
let latestRequestId = 0;

function cacheKey(params: TargetGoalsParams) {
	return `${params.ownerType}:${params.ownerId}:${params.year}:${params.targetKindId}`;
}

function applyGoals(payload: TargetGoalsResponse) {
	const rawYearVal = payload.yearGoal;
	const coercedYear =
		rawYearVal == null || Number.isNaN(Number(rawYearVal)) ? null : Math.trunc(Number(rawYearVal));
	yearGoalStore.set({ value: coercedYear });

	const rows: MonthGoal[] = (payload.months ?? []).map((r: any) => ({
		month: Number(r.month),
		goal_value: Math.trunc(Number(r.goal_value) || 0)
	}));
	monthGoalsStore.set(rows);
}

function startLoading(text: string) {
	goalsLoading.set(true);
	if (!isBrowser) return;
	pendingRequests += 1;
	if (pendingRequests === 1) {
		loadingStore.loading(true, text);
	}
}

function stopLoading() {
	if (!isBrowser) {
		goalsLoading.set(false);
		return;
	}

	if (pendingRequests === 0) {
		goalsLoading.set(false);
		return;
	}

	pendingRequests -= 1;
	const stillPending = pendingRequests > 0;
	goalsLoading.set(stillPending);
	if (!stillPending) {
		loadingStore.loading(false);
	}
}

function kindFor(ownerType: OwnerType) {
	return ownerType === 'trainer' ? 1 : 2;
}

export async function loadTargetGoals(params: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	force?: boolean;
}) {
	const { ownerType, ownerId, year, force = false } = params;
	const targetKindId = kindFor(ownerType);
	const key = cacheKey({ ownerType, ownerId, year, targetKindId });

	goalsError.set(null);

	const cached = !force ? cache.get(key) : null;
	if (cached) {
		applyGoals(cached);
		goalsLoading.set(false);
		return;
	}

	const requestId = ++latestRequestId;
	startLoading('Hämtar mål...');

	const existingRequest = !force ? inflightRequests.get(key) : null;
	const didCreateRequest = existingRequest == null;
	const requestPromise = existingRequest ?? getTargetGoals(ownerType, ownerId, year, targetKindId);
	if (didCreateRequest) {
		inflightRequests.set(key, requestPromise);
	}

	try {
		const payload = await requestPromise;
		if (requestId !== latestRequestId) {
			return;
		}
		cache.set(key, payload);
		applyGoals(payload);
	} catch (e: any) {
		if (requestId !== latestRequestId) {
			return;
		}
		console.error('loadTargetGoals failed', e);
		goalsError.set(`Kunde inte hämta mål: ${e?.message ?? e}`);
		yearGoalStore.set({ value: null });
		monthGoalsStore.set([]);
	} finally {
		if (didCreateRequest) {
			inflightRequests.delete(key);
		}
		stopLoading();
	}
}

export function invalidateTargetGoals(params: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
}) {
	const { ownerType, ownerId, year } = params;
	const targetKindId = kindFor(ownerType);
	cache.delete(cacheKey({ ownerType, ownerId, year, targetKindId }));
}
