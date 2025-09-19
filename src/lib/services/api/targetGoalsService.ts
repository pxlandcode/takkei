import type { OwnerType } from './targetService';

export type TargetGoalsResponse = {
	yearGoal: number | null;
	months: Array<{ month: number; goal_value: number | null }>;
};

function buildQuery(params: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	targetKindId: number;
}) {
	const { ownerType, ownerId, year, targetKindId } = params;
	return new URLSearchParams({
		ownerType,
		ownerId: String(ownerId),
		year: String(year),
		targetKindId: String(targetKindId)
	});
}

export async function getTargetGoals(
	ownerType: OwnerType,
	ownerId: number,
	year: number,
	targetKindId: number
): Promise<TargetGoalsResponse> {
	const qs = buildQuery({ ownerType, ownerId, year, targetKindId });
	const res = await fetch(`/api/targets/month?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch target goals');
	const body = await res.json();
	return {
		yearGoal: body?.yearGoal ?? null,
		months: (body?.months ?? []) as Array<{ month: number; goal_value: number | null }>
	};
}

/**
 * List all month goals for a year (and we’ll also use its yearGoal for getYearGoal).
 * Returns an array of { month, goal_value }.
 */
export async function getMonthGoals(
	ownerType: OwnerType,
	ownerId: number,
	year: number,
	targetKindId: number
): Promise<Array<{ month: number; goal_value: number | null }>> {
	const data = await getTargetGoals(ownerType, ownerId, year, targetKindId);
	return data.months;
}

/**
 * Return the YEAR goal as { value: number | null } to match your call-site.
 * We hit the same endpoint in list mode and read yearGoal.
 */
export async function getYearGoal(
	ownerType: OwnerType,
	ownerId: number,
	year: number,
	targetKindId: number
): Promise<{ value: number | null }> {
	const data = await getTargetGoals(ownerType, ownerId, year, targetKindId);
	return { value: data.yearGoal ?? null };
}

/** Upsert a single month goal */
export async function setMonthGoal(args: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	month: number; // 1..12
	targetKindId: number;
	goalValue: number;
	title?: string;
	description?: string;
}) {
	const res = await fetch('/api/targets/month', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(args)
	});
	if (!res.ok) throw new Error('Failed to set month goal');
	return res.json();
}

/** Upsert the year goal. If you have /api/targets/year you can point here; otherwise reuse /month (list mode isn’t POST).
 *  I’m assuming you already had a /api/targets/year POST; if not, keep your existing implementation.
 */
export async function setYearGoal(args: {
	ownerType: OwnerType;
	ownerId: number;
	year: number;
	targetKindId: number;
	goalValue: number;
	title?: string;
	description?: string;
}) {
	const res = await fetch('/api/targets/year', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(args)
	});
	if (!res.ok) throw new Error('Failed to set year goal');
	return res.json();
}

/** (If you still need it) Read-only weeks preview; unchanged here */
export async function getWeekGoals(
	ownerType: OwnerType,
	ownerId: number,
	year: number,
	month: number,
	targetKindId: number
) {
	const qs = new URLSearchParams({
		ownerType,
		ownerId: String(ownerId),
		year: String(year),
		month: String(month),
		targetKindId: String(targetKindId)
	});
	const res = await fetch(`/api/targets/weeks?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch week goals');
	return res.json();
}
