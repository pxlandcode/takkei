import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';

function yymmFromDate(dateISO: string) {
	const [y, m] = dateISO.split('-').map(Number);
	const year = y;
	const month = m; // 1..12
	const monthStr = String(month).padStart(2, '0');
	return { year, month, monthStr };
}

export async function GET({ url, request }) {
	const ownerType = url.searchParams.get('ownerType') as 'trainer' | 'location';
	const ownerId = Number(url.searchParams.get('ownerId'));
	const date = url.searchParams.get('date')!; // YYYY-MM-DD
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

	// Detect column type to handle timezone safely
	const typeRow = await query(`SELECT pg_typeof(start_time) AS coltype FROM bookings LIMIT 1`);
	const coltype: string = typeRow?.[0]?.coltype || 'unknown';
	const ts_expr =
		coltype === 'timestamp with time zone'
			? `(b.start_time AT TIME ZONE 'Europe/Stockholm')`
			: `b.start_time`;

	// Include late_cancelled (paid) but exclude plain cancelled and non-billable session types
	const baseFilters = `
		lower(trim(COALESCE(b.status,''))) NOT IN ('cancelled')
		AND COALESCE(b.try_out, false) = false
		AND COALESCE(b.education, false) = false
		AND COALESCE(b.internal_education, false) = false
		AND COALESCE(b.internal, false) = false
	`;

	if (debug) {
		console.log('[targets/summary] params', { ownerType, ownerId, date, year, month, kind });
		console.log('[targets/summary] bookings.start_time type:', coltype);
		console.log('[targets/summary] ts_expr:', ts_expr);
	}

	// Achieved YEAR
	const yearRows = await query(
		`
    SELECT COUNT(*)::int AS c
     FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND ${baseFilters}
  `,
		[ownerId, year]
	);
	const achievedYear: number = yearRows?.[0]?.c ?? 0;

	// Achieved MONTH
	const monthRows = await query(
		`
    SELECT COUNT(*)::int AS c
      FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND EXTRACT(MONTH FROM ${ts_expr})::int = $3
       AND ${baseFilters}
  `,
		[ownerId, year, month]
	);
	const achievedMonth: number = monthRows?.[0]?.c ?? 0;

	// Per-day breakdown
	const days = await query(
		`
    SELECT to_char((${ts_expr})::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
      FROM bookings b
     WHERE b.${ownerColumn} = $1
       AND EXTRACT(YEAR FROM ${ts_expr})::int = $2
       AND EXTRACT(MONTH FROM ${ts_expr})::int = $3
       AND ${baseFilters}
     GROUP BY day
     ORDER BY day
  `,
		[ownerId, year, month]
	);

	// Goals
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

	// 🔹 Location name (only when ownerType = 'location')
	let locationName: string | null = null;
	if (ownerType === 'location') {
		try {
			const locRows = await query(`SELECT name FROM locations WHERE id = $1`, [ownerId]);
			locationName = locRows?.[0]?.name ?? null;
		} catch (e) {
			if (debug) console.error('[targets/summary] location name lookup failed:', e);
		}
	}

	const payload = {
		// core
		year,
		month,
		achievedYear,
		achievedMonth,
		yearGoal,
		monthGoal,
		monthStart: `${year}-${monthStr}-01`,
		days,
		ownerType,
		ownerId,
		locationName
	};

	if (debug) console.log('[targets/summary] payload', payload);

	return respondJsonWithEtag(request, payload, { headers: { 'Cache-Control': 'no-store' } });
}
