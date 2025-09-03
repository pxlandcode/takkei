export async function getYearGoal(
	ownerType: 'trainer' | 'location',
	ownerId: number,
	year: number,
	kind: number
) {
	const r = await fetch(
		`/api/targets/year?ownerType=${ownerType}&ownerId=${ownerId}&year=${year}&targetKindId=${kind}`
	);
	return r.json(); // { value: number|null }
}
export async function setYearGoal(payload: any) {
	const r = await fetch('/api/targets/year', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!r.ok) throw new Error('Failed to save year goal');
}

export async function getMonthGoals(
	ownerType: 'trainer' | 'location',
	ownerId: number,
	year: number,
	kind: number
) {
	const r = await fetch(
		`/api/targets/month?ownerType=${ownerType}&ownerId=${ownerId}&year=${year}&targetKindId=${kind}`
	);
	return r.json(); // [{month, goal_value}]
}
export async function setMonthGoal(payload: any) {
	const r = await fetch('/api/targets/month', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!r.ok) throw new Error('Failed to save month goal');
}

export async function getWeekGoals(
	ownerType: 'trainer' | 'location',
	ownerId: number,
	year: number,
	month: number,
	kind: number
) {
	const r = await fetch(
		`/api/targets/week?ownerType=${ownerType}&ownerId=${ownerId}&year=${year}&month=${month}&targetKindId=${kind}`
	);
	return r.json(); // [{week_start, week_end, goal_value}]
}
export async function setWeekGoal(payload: any) {
	const r = await fetch('/api/targets/week', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!r.ok) throw new Error('Failed to save week goal');
}
