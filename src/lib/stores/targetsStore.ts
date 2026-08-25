import { writable } from 'svelte/store';
import type { OwnerType } from '$lib/services/api/targetService';
import { wrapFetch } from '$lib/services/api/apiCache';

export type TargetRow = {
	id: number;
	title: string;
	target: number;
	achieved: number;
	target_kind_name: string;
	rules: unknown;
};

export const targetStore = writable<TargetRow[]>([]);
export const targetStoreLoading = writable<boolean>(false);
export const targetStoreError = writable<string | null>(null);

export type TargetMeta = {
	year: number; // e.g., 2025
	month: number; // 1..12
	yearGoal: number | null;
	monthGoal: number | null;
	weekGoal: number | null;
	achievedYear: number;
	achievedMonth: number;
	achievedWeek: number;
	weekStart?: string | null;
	locationName?: string | null;
};

export const targetMeta = writable<TargetMeta | null>(null);

export const locationTargetMeta = writable<TargetMeta | null>(null);

// Company-wide combined targets
export const companyTargetMeta = writable<TargetMeta | null>(null);
const cachedFetch = wrapFetch(fetch);

type UpdateTargetsOptions = {
	force?: boolean;
};

function fetchOptions(options?: UpdateTargetsOptions): RequestInit | undefined {
	return options?.force ? { cache: 'no-store' } : undefined;
}

export function todayLocalISO(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function targetMonthLabel(month: number | null | undefined) {
	if (!Number.isFinite(month ?? NaN)) return '';

	const label = new Date(2000, Number(month) - 1, 1).toLocaleDateString('sv-SE', {
		month: 'long'
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function dateFromISODate(dateISO: string | null | undefined) {
	if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

	const [year, month, day] = dateISO.split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function weekNumberForDate(date: Date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function targetWeekLabel(weekStart: string | null | undefined, fallbackDate = new Date()) {
	return `Vecka ${weekNumberForDate(dateFromISODate(weekStart) ?? fallbackDate)}`;
}

export async function updateTargets(
	ownerType: OwnerType,
	ownerId: number,
	dateISO: string,
	options?: UpdateTargetsOptions
) {
	targetStoreLoading.set(true);
	targetStoreError.set(null);

	try {
		const qs = new URLSearchParams({
			ownerType,
			ownerId: String(ownerId),
			date: dateISO,
			targetKindId: ownerType === 'trainer' ? '1' : '2'
		});

		const res = await cachedFetch(
			`/api/targets/full-summary?${qs.toString()}`,
			fetchOptions(options)
		);
		if (!res.ok) throw new Error('Failed to fetch targets');
		const summary = await res.json();

		targetMeta.set({
			year: summary.year ?? null,
			yearGoal: summary.yearGoal ?? null,
			month: summary.month ?? null,
			monthGoal: summary.monthGoal ?? null,
			weekGoal: summary.weekGoal ?? null,
			achievedYear: summary.achievedYear ?? 0,
			achievedMonth: summary.achievedMonth ?? 0,
			achievedWeek: summary.achievedWeek ?? 0,
			weekStart: summary.weekStart ?? null
		});
	} catch (error) {
		console.error('Error updating targets:', error);
		targetStoreError.set(error instanceof Error ? error.message : 'Error updating targets');
		targetStore.set([]);
		targetMeta.set(null);
	} finally {
		targetStoreLoading.set(false);
	}
}

export async function updateLocationTargets(
	locationId: number,
	dateISO: string,
	options?: UpdateTargetsOptions
) {
	try {
		const qs = new URLSearchParams({
			ownerType: 'location',
			ownerId: String(locationId),
			date: dateISO,
			targetKindId: '2'
		});

		const res = await cachedFetch(
			`/api/targets/full-summary?${qs.toString()}`,
			fetchOptions(options)
		);
		if (!res.ok) throw new Error('Failed to fetch location targets');
		const summary = await res.json();

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
			weekGoal: summary.weekGoal ?? null,
			achievedYear: summary.achievedYear ?? 0,
			achievedMonth: summary.achievedMonth ?? 0,
			achievedWeek: summary.achievedWeek ?? 0,
			weekStart: summary.weekStart ?? null,
			locationName: summary.locationName ?? null
		});
	} catch (err) {
		console.error('[updateLocationTargets] failed:', err);
		locationTargetMeta.set(null);
	}
}

export async function updateCompanyTargets(dateISO: string, options?: UpdateTargetsOptions) {
	try {
		const res = await cachedFetch(
			`/api/targets/company-summary?date=${dateISO}`,
			fetchOptions(options)
		);
		if (!res.ok) throw new Error('Failed to fetch company targets');
		const summary = await res.json();

		companyTargetMeta.set({
			year: summary.year,
			month: summary.month,
			yearGoal: summary.yearGoal ?? null,
			monthGoal: summary.monthGoal ?? null,
			weekGoal: summary.weekGoal ?? null,
			achievedYear: summary.achievedYear ?? 0,
			achievedMonth: summary.achievedMonth ?? 0,
			achievedWeek: summary.achievedWeek ?? 0,
			weekStart: summary.weekStart ?? null
		});
	} catch (err) {
		console.error('[updateCompanyTargets] failed:', err);
		companyTargetMeta.set(null);
	}
}
