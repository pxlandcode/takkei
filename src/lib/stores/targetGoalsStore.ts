// src/lib/stores/targetGoalsStore.ts
import { writable } from 'svelte/store';
import { getYearGoal, getMonthGoals } from '$lib/services/api/targetGoalsService';

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

function kindFor(ownerType: OwnerType) {
	return ownerType === 'trainer' ? 1 : 2;
}

export async function loadTargetGoals(params: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
}) {
	const { ownerType, ownerId, year } = params;
	const targetKindId = kindFor(ownerType);

	goalsLoading.set(true);
	goalsError.set(null);

	try {
		// YEAR
		const y = await getYearGoal(ownerType, ownerId, year, targetKindId);
		const rawYearVal = y && typeof y === 'object' && 'value' in y ? (y as any).value : null;
		const coercedYear =
			rawYearVal == null || Number.isNaN(Number(rawYearVal))
				? null
				: Math.trunc(Number(rawYearVal));
		yearGoalStore.set({ value: coercedYear });

		// MONTHS
		const m = await getMonthGoals(ownerType, ownerId, year, targetKindId);
		const maybeArray = Array.isArray(m)
			? m
			: Array.isArray((m as any)?.rows)
				? (m as any).rows
				: Array.isArray((m as any)?.data)
					? (m as any).data
					: Array.isArray((m as any)?.result)
						? (m as any).result
						: null;

		if (!maybeArray) {
			console.error('Month goals payload was not an array:', m);
			throw new Error(
				'Månadsmål-svaret var inte en lista (kontrollera API-svaret i nätverksfliken).'
			);
		}

		const rows: MonthGoal[] = maybeArray.map((r: any) => ({
			month: Number(r.month),
			goal_value: Math.trunc(Number(r.goal_value) || 0)
		}));

		monthGoalsStore.set(rows);
	} catch (e: any) {
		console.error('loadTargetGoals failed', e);
		goalsError.set(`Kunde inte hämta mål: ${e?.message ?? e}`);
		yearGoalStore.set({ value: null });
		monthGoalsStore.set([]);
	} finally {
		goalsLoading.set(false);
	}
}
