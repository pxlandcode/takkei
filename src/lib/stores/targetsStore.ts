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

export const targetMeta = writable<{
	yearGoal: number | null;
	monthGoal: number | null;
	achievedYear: number;
	achievedMonth: number;
	year: number;
	month: number;
} | null>(null);

export async function updateTargets(ownerType: OwnerType, ownerId: number, dateISO: string) {
	targetStoreLoading.set(true);
	targetStoreError.set(null);

	console.log('fetching targets for', { ownerType, ownerId, dateISO });
	try {
		// Keep loading the list (you’ll use it differently later)
		// const targets = await fetchTargets(ownerType, ownerId, dateISO);
		// console.log('targets fetched', targets);
		// const normalized: TargetRow[] = (targets ?? []).map((t: any) => ({
		// 	...t,
		// 	target: Math.trunc(Number(t.target ?? 0)),
		// 	achieved: Math.trunc(Number(t.achieved ?? 0))
		// }));
		// targetStore.set(normalized);

		console.debug('[updateTargets] args =>', { ownerType, ownerId, dateISO });
		// Pull both goals + achieved from summary
		const summary = await fetchTargetsSummary({
			ownerType,
			ownerId,
			date: dateISO,
			includeGoals: true
		});

		console.log('targets summary fetched', summary);

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
