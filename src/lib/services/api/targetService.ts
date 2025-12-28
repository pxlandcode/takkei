import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

export type OwnerType = 'trainer' | 'location';

export function toTargetKindId(ownerType: OwnerType): 1 | 2 {
	return ownerType === 'trainer' ? 1 : 2;
}

/** Validate common params early with explicit errors */
function assertRequestParams(ownerType: OwnerType, ownerId: number, isoDate?: string) {
	const isValidOwnerType = ownerType === 'trainer' || ownerType === 'location';
	if (!isValidOwnerType) {
		throw new Error(`ownerType must be 'trainer' or 'location', received: ${String(ownerType)}`);
	}
	if (Number.isNaN(Number(ownerId))) {
		throw new Error(`ownerId must be a number, received: ${String(ownerId)}`);
	}
	if (isoDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
		throw new Error(`date must be in 'YYYY-MM-DD' format, received: ${String(isoDate)}`);
	}
}

/** Parse "YYYY-MM-DD" into explicit parts */
function parseIsoDateParts(isoDate: string): {
	yearFromDate: number;
	monthFromDate: number;
	dayFromDate: number;
} {
	const [yearString, monthString, dayString] = isoDate.split('-');
	const yearFromDate = Number(yearString);
	const monthFromDate = Number(monthString); // 1..12
	const dayFromDate = Number(dayString);
	return { yearFromDate, monthFromDate, dayFromDate };
}

/* ---------------------------------- */
/*               TARGETS              */
/* ---------------------------------- */

export async function fetchTargets(ownerType: OwnerType, ownerId: number, date: string) {
	assertRequestParams(ownerType, ownerId, date);
	const fetcher = wrapFetch(fetch);

	const queryString = new URLSearchParams({
		ownerType,
		ownerId: String(ownerId),
		date
	}).toString();

	const response = await fetcher(`/api/targets?${queryString}`);
	if (!response.ok) throw new Error('Failed to fetch targets');
	return response.json() as Promise<any>;
}

export async function createTarget(payload: {
	title: string;
	description?: string;
	target: number;
	ownerType: OwnerType;
	ownerIds: number[];
	start_date: string;
	end_date: string;
}) {
	const fetcher = wrapFetch(fetch);
	const requestBody = {
		title: payload.title,
		description: payload.description ?? '',
		target: Math.trunc(payload.target),
		target_kind_id: toTargetKindId(payload.ownerType),
		user_ids: payload.ownerType === 'trainer' ? payload.ownerIds : [],
		location_ids: payload.ownerType === 'location' ? payload.ownerIds : [],
		start_date: payload.start_date,
		end_date: payload.end_date
	};

	const response = await fetcher('/api/targets', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) throw new Error('Could not create target');
	invalidateByPrefix('/api/targets');
}

/** Legacy helper kept for compatibility when you already have a QS string prebuilt */
export async function fetchTargetSummary(queryString: string) {
	const fetcher = wrapFetch(fetch);
	const response = await fetcher(`/api/targets/summary?${queryString}`);
	if (!response.ok) throw new Error('Failed to fetch target summary');

	const data = await response.json();

	// Best effort: add explicit year/month if 'date' exists in the query string
	try {
		const params = new URLSearchParams(queryString);
		const dateFromQuery = params.get('date') ?? undefined;
		if (dateFromQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) {
			const { yearFromDate, monthFromDate } = parseIsoDateParts(dateFromQuery);
			return { year: yearFromDate, month: monthFromDate, ...data };
		}
	} catch {
		// ignore if parsing fails; just return the original data
	}

	return data;
}

export async function createTargetsBulk(rows: any[]) {
	const fetcher = wrapFetch(fetch);
	const response = await fetcher('/api/targets/bulk', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(rows)
	});
	if (!response.ok) throw new Error('Bulk create failed');
	invalidateByPrefix('/api/targets');
	return response.json();
}

/* ---------------------------------- */
/*           GOALS: MONTH/YEAR        */
/* ---------------------------------- */

export async function fetchMonthGoal(params: {
	ownerType: OwnerType;
	ownerId: number;
	date: string; // ISO "YYYY-MM-DD"
	targetKindId?: number; // default 1
}) {
	assertRequestParams(params.ownerType, params.ownerId, params.date);
	const fetcher = wrapFetch(fetch);

	const { yearFromDate, monthFromDate } = parseIsoDateParts(params.date);
	const targetKindIdentifier = params.targetKindId ?? 1;

	const queryString = new URLSearchParams({
		ownerType: params.ownerType,
		ownerId: String(params.ownerId),
		year: String(yearFromDate),
		month: String(monthFromDate),
		targetKindId: String(targetKindIdentifier)
	}).toString();

	const response = await fetcher(`/api/targets/month?${queryString}`);
	if (!response.ok) throw new Error('Failed to fetch month goal');

	return response.json() as Promise<{ yearGoal: number | null; monthGoal: number | null }>;
}

export async function fetchYearGoals(params: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	targetKindId?: number;
}) {
	assertRequestParams(params.ownerType, params.ownerId);
	const fetcher = wrapFetch(fetch);

	const targetKindIdentifier = params.targetKindId ?? 1;

	const queryString = new URLSearchParams({
		ownerType: params.ownerType,
		ownerId: String(params.ownerId),
		year: String(params.year),
		targetKindId: String(targetKindIdentifier)
	}).toString();

	const response = await fetcher(`/api/targets/year?${queryString}`);
	if (!response.ok) throw new Error('Failed to fetch year goals');

	// Suggested shape from server: { yearGoal, months: [{ month, goal }] }
	return response.json();
}

/* ---------------------------------- */
/*          SUMMARY: GOALS + ACH.     */
/* ---------------------------------- */

export type TargetsSummary = {
	year: number; // derived from input date
	month: number; // derived from input date (1..12)
	achievedYear: number;
	achievedMonth: number;
	yearGoal?: number | null;
	monthGoal?: number | null;
	monthStart?: string; // if server returns it
	days?: Array<{ day: string; cnt: number }>; // if server returns it
};

export async function fetchTargetsSummary(params: {
	ownerType: OwnerType;
	ownerId: number;
	date: string;
	targetKindId?: number;
	includeGoals?: boolean;
}) {
	// ⬇️ use the ownerType-aware default (not 1)
	const targetKindId = params.targetKindId ?? toTargetKindId(params.ownerType);
	const includeGoals = params.includeGoals ?? true;
	const fetcher = wrapFetch(fetch);

	const qs = new URLSearchParams({
		ownerType: params.ownerType,
		ownerId: String(params.ownerId),
		date: params.date,
		targetKindId: String(targetKindId)
	});
	if (includeGoals) qs.set('includeGoals', 'true');

	const res = await fetcher(`/api/targets/summary?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch targets summary');
	const body = await res.json();

	const [year, month] = params.date.split('-').map(Number);
	return { year, month, ...body };
}
