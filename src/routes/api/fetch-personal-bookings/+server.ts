import { query } from '$lib/db';

function parseTimestamp(value: any): number | undefined {
	if (!value) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === 'string') {
		const normalized = value.replace(' ', 'T');
		const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
		const ms = Date.parse(withZone);
		if (!Number.isNaN(ms)) return ms;
	}
	const ms = Date.parse(String(value));
	return Number.isNaN(ms) ? undefined : ms;
}

export async function GET({ url, request }) {
	const fromDate = url.searchParams.get('from');
	let toDate = url.searchParams.get('to');
	const date = url.searchParams.get('date');

	const userIds = url.searchParams.getAll('trainerId').map(Number).filter(Boolean);

	// ✅ Optional Pagination
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');

	const limit = limitParam ? parseInt(limitParam) : null;
	const offset = offsetParam ? parseInt(offsetParam) : 0;

	const params: (string | number | number[])[] = [];
	let queryStr = `
        SELECT personal_bookings.*, 
               users.firstname AS user_firstname,
               users.lastname AS user_lastname
        FROM personal_bookings
        LEFT JOIN users ON personal_bookings.user_id = users.id
        WHERE 1=1
    `;

	// ✅ Date range filtering
	if (fromDate && toDate) {
		params.push(fromDate, toDate);
		queryStr += ` AND personal_bookings.start_time BETWEEN TO_DATE($${params.length - 1}, 'YYYY-MM-DD') 
                      AND TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	} else if (date) {
		params.push(date);
		queryStr += ` AND DATE(personal_bookings.start_time) = TO_DATE($${params.length}, 'YYYY-MM-DD')`;
	}

	// ✅ Filtering by `trainerId`
	if (userIds.length > 0) {
		params.push(userIds);
		const index = params.length;
		queryStr += ` AND (
            personal_bookings.user_id = ANY($${index}::int[])
            OR personal_bookings.user_ids && $${index}::int[]
        )`;
	}

	// ✅ Apply ORDER BY
	queryStr += ` ORDER BY personal_bookings.start_time DESC`;

	// ✅ Apply pagination only if `limit` is set
	if (limit !== null) {
		params.push(limit, offset);
		queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
	}

	try {
		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const trainerIdsParam = userIds.length ? userIds : null;
			const fallbackParams: (number[] | null)[] = [];
			let latestQuery = `SELECT MAX(updated_at) AS last_updated FROM personal_bookings`;
			if (trainerIdsParam) {
				fallbackParams.push(trainerIdsParam);
				latestQuery += ` WHERE user_id = ANY($1::int[]) OR user_ids && $1::int[]`;
			}
			const [row] = await query<{ last_updated: string | null }>(latestQuery, fallbackParams);
			const latestMs = parseTimestamp(row?.last_updated);
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(latestMs) && Number.isFinite(since) && since >= latestMs) {
				const headers: Record<string, string> = { 'Content-Type': 'application/json' };
				headers['Last-Modified'] = new Date(Math.floor(latestMs / 1000) * 1000).toUTCString();
				return new Response(null, { status: 304, headers });
			}
		}

		const result = await query(queryStr, params);

		let maxUpdatedMs = result
			.map((row) => row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt)
			.map((ts) => parseTimestamp(ts))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		// If no rows matched, fall back to the latest updated_at in the table for the trainer(s)
		if (!Number.isFinite(maxUpdatedMs)) {
			const trainerIdsParam = userIds.length ? userIds : null;
			const fallbackParams: (number | string | null)[] = [];
			let fallbackQuery = `SELECT MAX(updated_at) AS last_updated FROM personal_bookings`;
			if (trainerIdsParam) {
				fallbackParams.push(trainerIdsParam);
				fallbackQuery += ` WHERE user_id = ANY($1::int[]) OR user_ids && $1::int[]`;
			}
			const [row] = await query<{ last_updated: string | null }>(fallbackQuery, fallbackParams);
			maxUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
		}

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor(maxUpdatedMs / 1000) * 1000 : 0;
		headers['Last-Modified'] = new Date(roundedMs).toUTCString();

		if (ifModifiedSince) {
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(since) && since >= roundedMs) {
				return new Response(null, { status: 304, headers });
			}
		}

		return new Response(JSON.stringify(result), { status: 200, headers });
	} catch (error) {
		console.error('Error fetching personal bookings:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
