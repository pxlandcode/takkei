// /src/routes/api/targets/summary/+server.ts
import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function yymmFromDate(dateISO: string) {
	// dateISO should be 'YYYY-MM-DD'
	const [y, m] = dateISO.split('-').map(Number);
	const year = y;
	const month = m; // 1..12
	const monthStr = String(month).padStart(2, '0');
	return { year, month, monthStr };
}

export async function GET({ url }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const date = url.searchParams.get('date')!; // expected: YYYY-MM-DD
	const kind = Number(url.searchParams.get('targetKindId') || 1);
	const includeGoals = url.searchParams.get('includeGoals') === 'true';
	const debug = url.searchParams.get('debug') === 'true';

	if (!ownerType || !ownerId || !date) {
		if (debug) {
			console.error('Missing required params', {
				ownerType,
				ownerIdRaw: url.searchParams.get('ownerId'),
				date
			});
		}
		return json({ error: 'Missing required params: ownerType, ownerId, date' }, { status: 400 });
	}

	const { year, month, monthStr } = yymmFromDate(date);
	const ownerColumn = ownerType === 'trainer' ? 'trainer_id' : 'location_id';

	// 1) Detect start_time column type to choose correct expression
	const typeRow = await query(`SELECT pg_typeof(start_time) AS coltype FROM bookings LIMIT 1`);
	const coltype: string = typeRow?.[0]?.coltype || 'unknown';

	// If timestamptz -> convert to Stockholm local time before extracting Y/M.
	// If plain timestamp -> use as-is (assumed local/naive).
	const ts_expr =
		coltype === 'timestamp with time zone'
			? `(b.start_time AT TIME ZONE 'Europe/Stockholm')`
			: `b.start_time`;

	if (debug) {
		console.log('[targets/summary] params', { ownerType, ownerId, date, year, month, kind });
		console.log('[targets/summary] bookings.start_time type:', coltype);
		console.log('[targets/summary] ts_expr:', ts_expr);
	}

	// 2) Achieved YEAR (extract year from ts_expr)
	const yearSQL = `
    SELECT COUNT(*)::int AS c
      FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled','late_cancelled')
  `;
	const yearArgs = [ownerId, year];
	const yearRows = await query(yearSQL, yearArgs);
	const achievedYear: number = yearRows?.[0]?.c ?? 0;

	// 3) Achieved MONTH (extract month+year from ts_expr)
	const monthSQL = `
    SELECT COUNT(*)::int AS c
      FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND EXTRACT(MONTH FROM ${ts_expr})::int = $3
       AND lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled','late_cancelled')
  `;
	const monthArgs = [ownerId, year, month];
	const monthRows = await query(monthSQL, monthArgs);
	const achievedMonth: number = monthRows?.[0]?.c ?? 0;

	// 4) Per-day breakdown (format as YYYY-MM-DD string)
	const daysSQL = `
    SELECT to_char((${ts_expr})::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
      FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND EXTRACT(MONTH FROM ${ts_expr})::int = $3
       AND lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled','late_cancelled')
     GROUP BY day
     ORDER BY day
  `;
	const days = await query(daysSQL, monthArgs);

	// 5) Goals (unchanged)
	let yearGoal: number | null = null;
	let monthGoal: number | null = null;

	if (includeGoals) {
		const yRows = await query(
			`SELECT goal_value
         FROM target_goals_year
        WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND target_kind_id=$4`,
			[ownerType, ownerId, year, kind]
		);
		const yg = yRows?.[0]?.goal_value;
		yearGoal = yg == null || Number.isNaN(Number(yg)) ? null : Math.trunc(Number(yg));

		const mRows = await query(
			`SELECT goal_value
         FROM target_goals_month
        WHERE target_owner_type=$1 AND target_owner_id=$2 AND year=$3 AND month=$4 AND target_kind_id=$5`,
			[ownerType, ownerId, year, month, kind]
		);
		const mg = mRows?.[0]?.goal_value;
		monthGoal = mg == null || Number.isNaN(Number(mg)) ? null : Math.trunc(Number(mg));
	}

	const payload = {
		achievedYear,
		achievedMonth,
		yearGoal,
		monthGoal,
		monthStart: `${year}-${monthStr}-01`,
		days
	};

	if (debug) {
		console.log('[targets/summary] payload', payload);
	}

	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store' // avoid any caching confusion while you debug
		}
	});
}
