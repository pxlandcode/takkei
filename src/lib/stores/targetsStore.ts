import { writable } from 'svelte/store';
import { fetchTargets, type OwnerType, fetchTargetsSummary } from '$lib/services/api/targetService';

export type TargetRow = {
	id: number;
	title: string;
	target: number;
	achieved: number;
	target_kind_name: string;
	rules: any;
};

export const targetStore = writable<TargetRow[]>([]);
export const targetStoreLoading = writable<boolean>(false);
export const targetStoreError = writable<string | null>(null);

export type TargetMeta = {
	year: number; // e.g., 2025
	month: number; // 1..12
	yearGoal: number | null;
	monthGoal: number | null;
	achievedYear: number;
	achievedMonth: number;
	locationName?: string | null;
};

export const targetMeta = writable<TargetMeta | null>(null);

export const locationTargetMeta = writable<TargetMeta | null>(null);

export async function updateTargets(ownerType: OwnerType, ownerId: number, dateISO: string) {
	targetStoreLoading.set(true);
	targetStoreError.set(null);

	try {
		const summary = await fetchTargetsSummary({
			ownerType,
			ownerId,
			date: dateISO,
			includeGoals: true
		});

		targetMeta.set({
			year: summary.year ?? null,
			yearGoal: summary.yearGoal ?? null,
			month: summary.month ?? null,
			monthGoal: summary.monthGoal ?? null,
			achievedYear: summary.achievedYear ?? 0,
			achievedMonth: summary.achievedMonth ?? 0
		});
	} catch (error: any) {
		console.error('Error updating targets:', error);
		targetStoreError.set(error?.message ?? 'Error updating targets');
		targetStore.set([]);
		targetMeta.set(null);
	} finally {
		targetStoreLoading.set(false);
	}
}

export async function updateLocationTargets(locationId: number, dateISO: string) {
	try {
		const summary = await fetchTargetsSummary({
			ownerType: 'location',
			ownerId: locationId,
			date: dateISO,
			targetKindId: 2,
			includeGoals: true
		});

		let year = summary.year;
		let month = summary.month;
		if (typeof year !== 'number' || typeof month !== 'number') {
			const [yy, mm] = dateISO.split('-').map(Number);
			year = year ?? yy;
			month = month ?? mm;
		}

		locationTargetMeta.set({
			year,
			month,
			yearGoal: summary.yearGoal ?? null,
			monthGoal: summary.monthGoal ?? null,
			achievedYear: summary.achievedYear ?? 0,
			achievedMonth: summary.achievedMonth ?? 0,
			locationName: summary.locationName ?? null
		});
	} catch (err) {
		console.error('[updateLocationTargets] failed:', err);
		locationTargetMeta.set(null);
	}
}
