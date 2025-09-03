import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function csvToIntArray(s: string | null): number[] {
	if (!s) return [];
	return s
		.split(',')
		.map((x) => Number(x.trim()))
		.filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET({ url }) {
	const year = Number(url.searchParams.get('year'));
	const trainerIds = csvToIntArray(url.searchParams.get('trainerIds'));
	const locationIds = csvToIntArray(url.searchParams.get('locationIds'));
	const yearsList = csvToIntArray(url.searchParams.get('years'));
	const debug = url.searchParams.get('debug') === 'true';

	if (!year || !Number.isFinite(year)) {
		return json({ error: 'Missing/invalid `year`' }, { status: 400 });
	}
	const years = yearsList.length ? yearsList : [year];

	const hasTrainers = trainerIds.length > 0;
	const hasLocations = locationIds.length > 0;

	// If nothing selected -> zeros (and no accidental "all")
	if (!hasTrainers && !hasLocations) {
		const payload = {
			year,
			months: Array.from({ length: 12 }, (_, i) => ({
				month: i + 1,
				trainers: { goal: 0, achieved: 0 },
				locations: { goal: 0, achieved: 0 },
				combined: { goal: 0, achieved: 0 }
			})),
			yearTotals: years.map((y) => ({
				year: y,
				trainers: { goal: 0, achieved: 0 },
				locations: { goal: 0, achieved: 0 },
				combined: { goal: 0, achieved: 0 }
			})),
			selection: { trainerIds, locationIds }
		};
		return json(payload, { headers: { 'Cache-Control': 'no-store' } });
	}

	// Detect timestamp type to normalize to Stockholm local time
	const typeRow = await query(`SELECT pg_typeof(start_time) AS coltype FROM bookings LIMIT 1`);
	const coltype: string = typeRow?.[0]?.coltype || 'unknown';
	const ts_expr =
		coltype === 'timestamp with time zone'
			? `(b.start_time AT TIME ZONE 'Europe/Stockholm')`
			: `b.start_time`;

	const statusFilter = `lower(trim(coalesce(b.status,''))) NOT IN ('cancelled','late_cancelled')`;

	/* ---------------------- ACHIEVED (MONTH) ---------------------- */

	// Trainers-only achieved by month
	let achievedTrainersMonth = new Map<number, number>();
	if (hasTrainers) {
		const rows = await query(
			`
			SELECT EXTRACT(MONTH FROM ${ts_expr})::int AS month, COUNT(*)::int AS c
			  FROM bookings b
			 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = $1
			   AND b.trainer_id = ANY($2::int[])
			   AND ${statusFilter}
			 GROUP BY 1
			 ORDER BY 1
			`,
			[year, trainerIds]
		);
		achievedTrainersMonth = new Map(rows.map((r: any) => [Number(r.month), Number(r.c)]));
	}

	// Locations-only achieved by month
	let achievedLocationsMonth = new Map<number, number>();
	if (hasLocations) {
		const rows = await query(
			`
			SELECT EXTRACT(MONTH FROM ${ts_expr})::int AS month, COUNT(*)::int AS c
			  FROM bookings b
			 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = $1
			   AND b.location_id = ANY($2::int[])
			   AND ${statusFilter}
			 GROUP BY 1
			 ORDER BY 1
			`,
			[year, locationIds]
		);
		achievedLocationsMonth = new Map(rows.map((r: any) => [Number(r.month), Number(r.c)]));
	}

	// Combined achieved (distinct union) by month
	let achievedCombinedMonth = new Map<number, number>();
	{
		const rows = await query(
			`
			SELECT EXTRACT(MONTH FROM ${ts_expr})::int AS month, COUNT(DISTINCT b.id)::int AS c
			  FROM bookings b
			 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = $1
			   AND ( ($2::boolean AND b.trainer_id = ANY($3::int[]))
			      OR ($4::boolean AND b.location_id = ANY($5::int[])) )
			   AND ${statusFilter}
			 GROUP BY 1
			 ORDER BY 1
			`,
			[year, hasTrainers, trainerIds, hasLocations, locationIds]
		);
		achievedCombinedMonth = new Map(rows.map((r: any) => [Number(r.month), Number(r.c)]));
	}

	/* ---------------------- GOALS (MONTH) ------------------------- */
	let goalsTrainersMonth = new Map<number, number>();
	if (hasTrainers) {
		const rows = await query(
			`
			SELECT month::int, COALESCE(SUM(goal_value),0)::int AS g
			  FROM target_goals_month
			 WHERE target_owner_type = 'trainer'
			   AND year = $1
			   AND target_owner_id = ANY($2::int[])
			   AND target_kind_id = 1
			 GROUP BY month
			 ORDER BY month
			`,
			[year, trainerIds]
		);
		goalsTrainersMonth = new Map(rows.map((r: any) => [Number(r.month), Number(r.g)]));
	}

	let goalsLocationsMonth = new Map<number, number>();
	if (hasLocations) {
		const rows = await query(
			`
			SELECT month::int, COALESCE(SUM(goal_value),0)::int AS g
			  FROM target_goals_month
			 WHERE target_owner_type = 'location'
			   AND year = $1
			   AND target_owner_id = ANY($2::int[])
			   AND target_kind_id = 2
			 GROUP BY month
			 ORDER BY month
			`,
			[year, locationIds]
		);
		goalsLocationsMonth = new Map(rows.map((r: any) => [Number(r.month), Number(r.g)]));
	}

	/* ---------------------- Compose months ------------------------ */
	const months: Array<{
		month: number;
		trainers: { goal: number; achieved: number };
		locations: { goal: number; achieved: number };
		combined: { goal: number; achieved: number };
	}> = [];
	for (let m = 1; m <= 12; m++) {
		const gT = goalsTrainersMonth.get(m) ?? 0;
		const gL = goalsLocationsMonth.get(m) ?? 0;
		const aT = achievedTrainersMonth.get(m) ?? 0;
		const aL = achievedLocationsMonth.get(m) ?? 0;
		const aC = achievedCombinedMonth.get(m) ?? Math.max(aT, aL); // fallback

		months.push({
			month: m,
			trainers: { goal: gT, achieved: aT },
			locations: { goal: gL, achieved: aL },
			combined: { goal: gT + gL, achieved: aC }
		});
	}

	/* ---------------------- YEAR TOTALS --------------------------- */

	// Achieved per year (trainers)
	let achievedTrainersYear = new Map<number, number>();
	if (hasTrainers) {
		const rows = await query(
			`
			SELECT EXTRACT(YEAR FROM ${ts_expr})::int AS y, COUNT(*)::int AS c
			  FROM bookings b
			 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = ANY($1::int[])
			   AND b.trainer_id = ANY($2::int[])
			   AND ${statusFilter}
			 GROUP BY 1
			 ORDER BY 1
			`,
			[years, trainerIds]
		);
		achievedTrainersYear = new Map(rows.map((r: any) => [Number(r.y), Number(r.c)]));
	}

	// Achieved per year (locations)
	let achievedLocationsYear = new Map<number, number>();
	if (hasLocations) {
		const rows = await query(
			`
			SELECT EXTRACT(YEAR FROM ${ts_expr})::int AS y, COUNT(*)::int AS c
			  FROM bookings b
			 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = ANY($1::int[])
			   AND b.location_id = ANY($2::int[])
			   AND ${statusFilter}
			 GROUP BY 1
			 ORDER BY 1
			`,
			[years, locationIds]
		);
		achievedLocationsYear = new Map(rows.map((r: any) => [Number(r.y), Number(r.c)]));
	}

	// Achieved per year (combined distinct union)
	const rowsCombinedYear = await query(
		`
		SELECT EXTRACT(YEAR FROM ${ts_expr})::int AS y, COUNT(DISTINCT b.id)::int AS c
		  FROM bookings b
		 WHERE EXTRACT(YEAR FROM ${ts_expr})::int = ANY($1::int[])
		   AND ( ($2::boolean AND b.trainer_id = ANY($3::int[]))
		      OR ($4::boolean AND b.location_id = ANY($5::int[])) )
		   AND ${statusFilter}
		 GROUP BY 1
		 ORDER BY 1
		`,
		[years, hasTrainers, trainerIds, hasLocations, locationIds]
	);
	const achievedCombinedYear = new Map<number, number>(
		rowsCombinedYear.map((r: any) => [Number(r.y), Number(r.c)])
	);

	// Goals per year
	let goalsTrainersYear = new Map<number, number>();
	if (hasTrainers) {
		const rows = await query(
			`
			SELECT year::int AS y, COALESCE(SUM(goal_value),0)::int AS g
			  FROM target_goals_year
			 WHERE target_owner_type = 'trainer'
			   AND year = ANY($1::int[])
			   AND target_owner_id = ANY($2::int[])
			   AND target_kind_id = 1
			 GROUP BY 1
			 ORDER BY 1
			`,
			[years, trainerIds]
		);
		goalsTrainersYear = new Map(rows.map((r: any) => [Number(r.y), Number(r.g)]));
	}

	let goalsLocationsYear = new Map<number, number>();
	if (hasLocations) {
		const rows = await query(
			`
			SELECT year::int AS y, COALESCE(SUM(goal_value),0)::int AS g
			  FROM target_goals_year
			 WHERE target_owner_type = 'location'
			   AND year = ANY($1::int[])
			   AND target_owner_id = ANY($2::int[])
			   AND target_kind_id = 2
			 GROUP BY 1
			 ORDER BY 1
			`,
			[years, locationIds]
		);
		goalsLocationsYear = new Map(rows.map((r: any) => [Number(r.y), Number(r.g)]));
	}

	const yearTotals = years.map((y) => {
		const gT = goalsTrainersYear.get(y) ?? 0;
		const gL = goalsLocationsYear.get(y) ?? 0;
		const aT = achievedTrainersYear.get(y) ?? 0;
		const aL = achievedLocationsYear.get(y) ?? 0;
		const aC = achievedCombinedYear.get(y) ?? Math.max(aT, aL);

		return {
			year: y,
			trainers: { goal: gT, achieved: aT },
			locations: { goal: gL, achieved: aL },
			combined: { goal: gT + gL, achieved: aC }
		};
	});

	const payload = {
		year,
		months,
		yearTotals,
		selection: { trainerIds, locationIds }
	};
	if (debug) console.log('[aggregate] payload', payload);

	return json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
