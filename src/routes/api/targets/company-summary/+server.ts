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
	const date = url.searchParams.get('date')!; // YYYY-MM-DD

	if (!date) {
		return json({ error: 'Missing required param: date' }, { status: 400 });
	}

	const { year, month } = yymmFromDate(date);

	// Detect column type to handle timezone safely
	const typeRow = await query(`SELECT pg_typeof(start_time) AS coltype FROM bookings LIMIT 1`);
	const coltype: string = typeRow?.[0]?.coltype || 'unknown';
	const ts_expr =
		coltype === 'timestamp with time zone'
			? `(b.start_time AT TIME ZONE 'Europe/Stockholm')`
			: `b.start_time`;

	const statusFilter = `lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled','late_cancelled')`;

	// Achieved YEAR (all bookings company-wide)
	const yearRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = $1
		   AND ${statusFilter}`,
		[year]
	);
	const achievedYear: number = yearRows?.[0]?.c ?? 0;

	// Achieved MONTH (all bookings company-wide)
	const monthRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = $1
		   AND EXTRACT(MONTH FROM ${ts_expr})::int = $2
		   AND ${statusFilter}`,
		[year, month]
	);
	const achievedMonth: number = monthRows?.[0]?.c ?? 0;

	// Achieved WEEK (current week containing the date)
	const inputDate = new Date(date);
	const weekRange = getWeekRange(inputDate);
	const weekStart = weekRange.start.toISOString().slice(0, 10);
	const weekEnd = weekRange.end.toISOString().slice(0, 10);

	const weekRows = await query(
		`SELECT COUNT(*)::int AS c FROM bookings b
		 WHERE (${ts_expr})::date >= $1::date
		   AND (${ts_expr})::date <= $2::date
		   AND ${statusFilter}`,
		[weekStart, weekEnd]
	);
	const achievedWeek: number = weekRows?.[0]?.c ?? 0;

	// Goals: Sum all trainer year goals
	const tyRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_year
		 WHERE target_owner_type='trainer' AND year=$1 AND target_kind_id=1`,
		[year]
	);
	const trainerYearGoal = tyRows?.[0]?.g ?? 0;

	// Goals: Sum all location year goals
	const lyRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_year
		 WHERE target_owner_type='location' AND year=$1 AND target_kind_id=2`,
		[year]
	);
	const locationYearGoal = lyRows?.[0]?.g ?? 0;

	// Combined year goal (use max to avoid double-counting - typically trainers is the target)
	const yearGoal = Math.max(trainerYearGoal, locationYearGoal) || null;

	// Goals: Sum all trainer month goals
	const tmRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_month
		 WHERE target_owner_type='trainer' AND year=$1 AND month=$2 AND target_kind_id=1`,
		[year, month]
	);
	const trainerMonthGoal = tmRows?.[0]?.g ?? 0;

	// Goals: Sum all location month goals
	const lmRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_month
		 WHERE target_owner_type='location' AND year=$1 AND month=$2 AND target_kind_id=2`,
		[year, month]
	);
	const locationMonthGoal = lmRows?.[0]?.g ?? 0;

	// Combined month goal
	const monthGoal = Math.max(trainerMonthGoal, locationMonthGoal) || null;

	// Goals: Sum all trainer week goals
	const twRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_week
		 WHERE target_owner_type='trainer' AND year=$1 AND month=$2 AND week_start=$3 AND target_kind_id=1`,
		[year, month, weekStart]
	);
	const trainerWeekGoal = twRows?.[0]?.g ?? 0;

	// Goals: Sum all location week goals
	const lwRows = await query(
		`SELECT COALESCE(SUM(goal_value), 0)::int AS g FROM target_goals_week
		 WHERE target_owner_type='location' AND year=$1 AND month=$2 AND week_start=$3 AND target_kind_id=2`,
		[year, month, weekStart]
	);
	const locationWeekGoal = lwRows?.[0]?.g ?? 0;

	// Combined week goal
	const weekGoal = Math.max(trainerWeekGoal, locationWeekGoal) || null;

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
			weekEnd
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
