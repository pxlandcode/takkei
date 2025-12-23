import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function yymmFromDate(dateISO: string) {
	const [y, m] = dateISO.split('-').map(Number);
	return { year: y, month: m };
}

function getWeekRange(date: Date): { start: Date; end: Date } {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
	const start = new Date(d.setDate(diff));
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const date = url.searchParams.get('date')!; // YYYY-MM-DD
	const kind = Number(url.searchParams.get('targetKindId') || 1);

	if (!ownerType || !ownerId || !date) {
		return json({ error: 'Missing required params: ownerType, ownerId, date' }, { status: 400 });
	}

	const { year, month } = yymmFromDate(date);
	const ownerColumn = ownerType === 'trainer' ? 'trainer_id' : 'location_id';

	// Detect column type to handle timezone safely
	const typeRow = await query(`SELECT pg_typeof(start_time) AS coltype FROM bookings LIMIT 1`);
	const coltype: string = typeRow?.[0]?.coltype || 'unknown';
	const ts_expr =
		coltype === 'timestamp with time zone'
			? `(b.start_time AT TIME ZONE 'Europe/Stockholm')`
			: `b.start_time`;

	const statusFilter = `lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled','late_cancelled')`;

	// Achieved YEAR
	const yearRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE b.${ownerColumn} = $1
		   AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
		   AND ${statusFilter}`,
		[ownerId, year]
	);
	const achievedYear: number = yearRows?.[0]?.c ?? 0;

	// Achieved MONTH
	const monthRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE b.${ownerColumn} = $1
		   AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
		   AND EXTRACT(MONTH FROM ${ts_expr})::int = $3
		   AND ${statusFilter}`,
		[ownerId, year, month]
	);
	const achievedMonth: number = monthRows?.[0]?.c ?? 0;

	// Achieved WEEK (current week containing the date)
	const inputDate = new Date(date);
	const weekRange = getWeekRange(inputDate);
	const weekStart = weekRange.start.toISOString().slice(0, 10);
	const weekEnd = weekRange.end.toISOString().slice(0, 10);

	const weekRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE b.${ownerColumn} = $1
		   AND (${ts_expr})::date >= $2::date
		   AND (${ts_expr})::date <= $3::date
		   AND ${statusFilter}`,
		[ownerId, weekStart, weekEnd]
	);
	const achievedWeek: number = weekRows?.[0]?.c ?? 0;

	// Goals: Year
	const yRows = await query(
		`SELECT goal_value FROM target_goals_year
		 WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4`,
		[ownerType, ownerId, year, kind]
	);
	const yg = yRows?.[0]?.goal_value;
	const yearGoal = yg == null || Number.isNaN(Number(yg)) ? null : Math.trunc(Number(yg));

	// Goals: Month
	const mRows = await query(
		`SELECT goal_value FROM target_goals_month
		 WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5`,
		[ownerType, ownerId, year, month, kind]
	);
	const mg = mRows?.[0]?.goal_value;
	const monthGoal = mg == null || Number.isNaN(Number(mg)) ? null : Math.trunc(Number(mg));

	// Goals: Week
	const wRows = await query(
		`SELECT goal_value FROM target_goals_week
		 WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 
		   AND week_start=$5 AND target_kind_id=$6`,
		[ownerType, ownerId, year, month, weekStart, kind]
	);
	const wg = wRows?.[0]?.goal_value;
	const weekGoal = wg == null || Number.isNaN(Number(wg)) ? null : Math.trunc(Number(wg));

	// Location name (only when ownerType = 'location')
	let locationName: string | null = null;
	if (ownerType === 'location') {
		try {
			const locRows = await query(`SELECT name FROM locations WHERE id = $1`, [ownerId]);
			locationName = locRows?.[0]?.name ?? null;
		} catch {
			// ignore
		}
	}

	return json(
		{
			year,
			month,
			achievedYear,
			achievedMonth,
			achievedWeek,
			yearGoal,
			monthGoal,
			weekGoal,
			weekStart,
			weekEnd,
			ownerType,
			ownerId,
			locationName
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
